import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn, exec, execFile } from 'child_process';
import { generateThumbnail, pauseThumbnails, resumeThumbnails } from '../scanner/thumbnails.js';
import { Store } from '../db/store.js';
import { previewGenerator, PREVIEWS_CACHE_DIR } from '../scanner/preview-generator.js';
import { getFfmpegPath, getFfprobePath } from '../utils/ffmpeg-path.js';
import { renderLibraryHtml, renderPlayerHtml } from './phone-pages.js';

const APP_DATA = Store.getPaths().appDataDir;
const SUB_CACHE_DIR = path.join(APP_DATA, 'subtitles');
if (!fs.existsSync(SUB_CACHE_DIR)) fs.mkdirSync(SUB_CACHE_DIR, { recursive: true });

const HLS_CACHE_DIR = path.join(APP_DATA, 'hls_cache');
if (!fs.existsSync(HLS_CACHE_DIR)) fs.mkdirSync(HLS_CACHE_DIR, { recursive: true });

const KEYFRAME_CACHE_DIR = path.join(APP_DATA, 'keyframe_cache');
if (!fs.existsSync(KEYFRAME_CACHE_DIR)) fs.mkdirSync(KEYFRAME_CACHE_DIR, { recursive: true });

const keyframeMemoryCache = new Map();

export async function getKeyframes(targetFile) {
  if (keyframeMemoryCache.has(targetFile)) {
    return keyframeMemoryCache.get(targetFile);
  }

  const hash = crypto.createHash('sha256').update(targetFile).digest('hex').slice(0, 32);
  const cachePath = path.join(KEYFRAME_CACHE_DIR, `${hash}.json`);

  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        keyframeMemoryCache.set(targetFile, data);
        return data;
      }
    } catch {}
  }

  const fallback = [0];
  keyframeMemoryCache.set(targetFile, fallback);
  return fallback;
}

// Use CPU libx264 ultrafast with all available threads; on integrated graphics with low VRAM (e.g. Intel HD 4600),
// QSV causes D3D11 surface exhaustion and GPU process crashes during fullscreen video rendering.
// On the 8-thread Core i7, CPU ultrafast produces 2s segments in ~340ms with 100% stability.
const hwAccelEncoder = null;

const activeLiveJobs = new Map(); // playerKey -> { child, targetFile, start, audioIndex }
const activePrefetchJobs = new Map(); // playerKey -> { child, targetFile, start, audioIndex }
const pendingTranscodes = new Map(); // segKey -> Promise

function getSegmentHash(targetFile, audioIndex, start, dur = 6) {
  const roundedStart = Math.round(start * 1000) / 1000;
  const roundedDur = Math.round(dur * 1000) / 1000;
  return crypto.createHash('sha256').update(`${targetFile}_a${audioIndex}_s${roundedStart}_d${roundedDur}`).digest('hex').slice(0, 32);
}

function transcodeSegment(playerKey = 'main', targetFile, audioIndex = 0, start = 0, dur = 6, isPrefetch = false) {
  const hash = getSegmentHash(targetFile, audioIndex, start, dur);
  const segPath = path.join(HLS_CACHE_DIR, `${hash}.ts`);
  const doneMarker = `${segPath}.done`;

  if (fs.existsSync(segPath) && fs.existsSync(doneMarker)) {
    return Promise.resolve(segPath);
  }

  const segKey = hash;
  if (pendingTranscodes.has(segKey)) {
    if (!isPrefetch && activePrefetchJobs.has(playerKey)) {
      const curJob = activePrefetchJobs.get(playerKey);
      if (curJob.start === start && curJob.targetFile === targetFile) {
        activePrefetchJobs.delete(playerKey);
        activeLiveJobs.set(playerKey, curJob);
      }
    }
    return pendingTranscodes.get(segKey);
  }

  // A prefetch must never run if a live segment is currently transcoding
  if (isPrefetch && activeLiveJobs.has(playerKey)) {
    return Promise.resolve(null);
  }

  const promise = (async () => {
    // Live segment has top priority: cancel active prefetch if it is for a DIFFERENT segment
    if (!isPrefetch) {
      if (activePrefetchJobs.has(playerKey)) {
        const curJob = activePrefetchJobs.get(playerKey);
        if (curJob.targetFile !== targetFile || curJob.start !== start || curJob.audioIndex !== audioIndex) {
          try {
            curJob.child.kill();
          } catch {}
          activePrefetchJobs.delete(playerKey);
        }
      }
      // On seek, cancel old live job immediately so new seek target starts right away
      if (activeLiveJobs.has(playerKey)) {
        const curJob = activeLiveJobs.get(playerKey);
        if (curJob.targetFile !== targetFile || curJob.start !== start || curJob.audioIndex !== audioIndex) {
          try {
            curJob.child.kill();
          } catch {}
          activeLiveJobs.delete(playerKey);
        }
      }
    } else {
      // If a prefetch for a different segment was active, cancel it to avoid stale background work
      if (activePrefetchJobs.has(playerKey)) {
        const curJob = activePrefetchJobs.get(playerKey);
        if (curJob.targetFile !== targetFile || curJob.start !== start || curJob.audioIndex !== audioIndex) {
          try {
            curJob.child.kill();
          } catch {}
          activePrefetchJobs.delete(playerKey);
        }
      }
    }

    const details = await getMediaDetails(targetFile);
    const vCodec = (details?.vCodec || '').toLowerCase();
    const aCodec = (details?.aCodec || '').toLowerCase();
    const isH264 = vCodec === 'h264' || vCodec === 'avc' || vCodec === 'avc1';
    const isAac = aCodec === 'aac' || aCodec === 'mp4a';

    const tempPath = path.join(HLS_CACHE_DIR, `${hash}.tmp.ts`);

    return new Promise((resolve, reject) => {
      let args = [];
      const audioArgs = isAac
        ? ['-c:a', 'copy']
        : ['-c:a', 'aac', '-b:a', '192k', '-ac', '2'];

      if (isH264) {
        // H.264: Instant remux with copy (takes ~50ms)
        args = [
          '-y',
          '-ss', String(start),
          '-i', targetFile,
          '-t', String(dur),
          '-output_ts_offset', String(start),
          '-muxdelay', '0',
          '-map', '0:v:0',
          '-map', `0:a:${audioIndex}?`,
          '-c:v', 'copy',
          ...audioArgs,
          '-sn',
          '-f', 'mpegts',
          tempPath
        ];
      } else {
        // Fast keyframe seek (-ss before -i) + ultrafast real-time transcode with multi-threading
        const vCodecArgs = hwAccelEncoder
          ? ['-c:v', hwAccelEncoder, '-preset', 'veryfast']
          : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '22', '-threads', '0'];

        args = [
          '-y',
          '-ss', String(start),
          '-i', targetFile,
          '-t', String(dur),
          '-output_ts_offset', String(start),
          '-muxdelay', '0',
          '-map', '0:v:0',
          '-map', `0:a:${audioIndex}?`,
          ...vCodecArgs,
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ac', '2',
          '-threads', '0',
          '-sn',
          '-f', 'mpegts',
          tempPath
        ];
      }

      const child = spawn(getFfmpegPath(), args, { windowsHide: true });
      const jobInfo = { child, targetFile, start, audioIndex };

      if (isPrefetch) {
        activePrefetchJobs.set(playerKey, jobInfo);
      } else {
        activeLiveJobs.set(playerKey, jobInfo);
      }

      child.on('close', (code) => {
        if (isPrefetch) {
          if (activePrefetchJobs.get(playerKey)?.child === child) {
            activePrefetchJobs.delete(playerKey);
          }
        } else {
          if (activeLiveJobs.get(playerKey)?.child === child) {
            activeLiveJobs.delete(playerKey);
          }
        }
        pendingTranscodes.delete(segKey);

        if (code === 0 && fs.existsSync(tempPath)) {
          try {
            fs.renameSync(tempPath, segPath);
            fs.writeFileSync(doneMarker, '1', 'utf8');
            resolve(segPath);

            // While playing, prefetch the next 3 segments ahead of the playhead
            if (!isPrefetch) {
              prefetchSegments(playerKey, targetFile, audioIndex, start + dur, 3);
            }
          } catch (e) {
            reject(e);
          }
        } else {
          try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        if (isPrefetch) {
          if (activePrefetchJobs.get(playerKey)?.child === child) {
            activePrefetchJobs.delete(playerKey);
          }
        } else {
          if (activeLiveJobs.get(playerKey)?.child === child) {
            activeLiveJobs.delete(playerKey);
          }
        }
        pendingTranscodes.delete(segKey);
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
        reject(err);
      });
    });
  })();

  pendingTranscodes.set(segKey, promise);
  return promise;
}

async function prefetchSegments(playerKey, targetFile, audioIndex, startSec, count) {
  if (count <= 0) return;
  try {
    const details = await getMediaDetails(targetFile);
    if (!details || startSec >= details.duration) return;
    const nextStart = startSec;
    const nextDur = Math.min(4.0, details.duration - nextStart);
    if (nextDur <= 0.1) return;

    const hash = getSegmentHash(targetFile, audioIndex, nextStart, nextDur);
    const segPath = path.join(HLS_CACHE_DIR, `${hash}.ts`);
    const doneMarker = `${segPath}.done`;

    if (fs.existsSync(segPath) && fs.existsSync(doneMarker)) {
      prefetchSegments(playerKey, targetFile, audioIndex, nextStart + nextDur, count - 1);
      return;
    }

    if (activeLiveJobs.has(playerKey)) {
      return; // Live segment has priority
    }

    const res = await transcodeSegment(playerKey, targetFile, audioIndex, nextStart, nextDur, true);
    if (res) {
      prefetchSegments(playerKey, targetFile, audioIndex, nextStart + nextDur, count - 1);
    }
  } catch {}
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDistDir() {
  const candidates = [];
  try {
    const electron = globalThis.process?.versions?.electron;
    if (electron) {
      candidates.push(path.resolve(__dirname, '../../dist'));
    }
  } catch {}
  candidates.push(
    path.resolve(__dirname, '../dist'),
    path.resolve(__dirname, '../../dist'),
    path.resolve(process.cwd(), 'dist')
  );
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), 'dist');
}

const DIST_DIR = getDistDir();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mov': 'video/mp4',
  '.avi': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8'
};

/**
 * Basic SRT to WebVTT converter.
 */
function srtToVtt(srtContent) {
  return (
    'WEBVTT\n\n' +
    srtContent
      .replace(/\r\n|\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  );
}

/**
 * Robust ASS / SSA to WebVTT converter.
 */
function assToVtt(assContent) {
  const lines = assContent.split(/\r?\n/);
  const vttLines = ['WEBVTT', ''];
  let inEvents = false;
  let formatFields = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inEvents = trimmed.toLowerCase() === '[events]';
      continue;
    }
    if (!inEvents) continue;

    if (trimmed.toLowerCase().startsWith('format:')) {
      formatFields = trimmed.substring(7).split(',').map((s) => s.trim().toLowerCase());
      continue;
    }

    if (trimmed.toLowerCase().startsWith('dialogue:')) {
      const parts = trimmed.substring(9).split(',');
      if (parts.length >= formatFields.length && formatFields.length > 0) {
        const startIdx = formatFields.indexOf('start');
        const endIdx = formatFields.indexOf('end');
        const textIdx = formatFields.indexOf('text');

        if (startIdx !== -1 && endIdx !== -1 && textIdx !== -1) {
          const start = parts[startIdx].trim();
          const end = parts[endIdx].trim();
          const text = parts
            .slice(textIdx)
            .join(',')
            .replace(/\\N/gi, '\n')
            .replace(/\{.*?\}/g, '') // strip ASS formatting tags
            .trim();

          if (text) {
            const formatTime = (t) => {
              const segs = t.split(':');
              const h = segs[0] || '0';
              const m = segs[1] || '00';
              const secParts = (segs[2] || '00').split('.');
              const s = secParts[0] || '00';
              const cs = (secParts[1] || '0').padEnd(3, '0').slice(0, 3);
              return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${cs}`;
            };
            vttLines.push(`${formatTime(start)} --> ${formatTime(end)}`);
            vttLines.push(text);
            vttLines.push('');
          }
        }
      }
    }
  }
  return vttLines.join('\n');
}

const LANG_MAP = {
  hin: 'Hindi',
  eng: 'English',
  ice: 'English',
  isl: 'Icelandic',
  spa: 'Spanish',
  jpn: 'Japanese',
  fra: 'French',
  fre: 'French',
  ger: 'German',
  deu: 'German',
  kor: 'Korean',
  chi: 'Chinese',
  zho: 'Chinese',
  tam: 'Tamil',
  tel: 'Telugu',
  mal: 'Malayalam',
  kan: 'Kannada',
  ben: 'Bengali',
  mar: 'Marathi',
  pan: 'Punjabi',
  guj: 'Gujarati',
  rus: 'Russian',
  ita: 'Italian',
  por: 'Portuguese',
  ara: 'Arabic',
  tur: 'Turkish'
};

function formatAudioLabel(stream, audioIndex) {
  const langCode = (stream.tags?.language || '').toLowerCase().trim();
  const rawTitle = (stream.tags?.title || '').trim();
  let lang = LANG_MAP[langCode] || (langCode && langCode !== 'und' ? langCode.toUpperCase() : `Audio Track ${audioIndex + 1}`);

  let chDesc = '';
  if (stream.channels === 6) chDesc = '5.1';
  else if (stream.channels === 8) chDesc = '7.1';
  else if (stream.channels === 2) chDesc = 'Stereo';
  else if (stream.channels === 1) chDesc = 'Mono';

  const parts = [];
  parts.push(lang);
  if (rawTitle && rawTitle.toLowerCase() !== lang.toLowerCase() && !rawTitle.toLowerCase().includes('visit')) {
    parts.push(`(${rawTitle})`);
  }
  if (chDesc) {
    parts.push(`[${chDesc}]`);
  }
  return parts.join(' ');
}

function formatSubtitleLabel(stream, subIndex) {
  const langCode = (stream.tags?.language || '').toLowerCase().trim();
  const rawTitle = (stream.tags?.title || '').trim();
  let lang = LANG_MAP[langCode] || (langCode && langCode !== 'und' ? langCode.toUpperCase() : `Subtitle Track ${subIndex + 1}`);

  const parts = [];
  parts.push(lang);
  if (rawTitle && !rawTitle.toLowerCase().includes('visit')) {
    parts.push(`[${rawTitle}]`);
  }
  return parts.join(' ');
}

// In-memory cache for media metadata (duration, codecs, audio & sub tracks)
const mediaDetailsCache = new Map();

export function isSubtitleMatch(videoPath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (!['.srt', '.vtt', '.ass', '.ssa'].includes(ext)) return false;

  const videoBase = path.basename(videoPath, path.extname(videoPath));
  const subBase = path.basename(fileName, ext);

  // Exact base match (case-insensitive)
  if (videoBase.toLowerCase() === subBase.toLowerCase()) {
    return true;
  }

  // Exact base name followed by delimiter (. _ -) and optional language tag (e.g. .en, .eng, .en-US, .forced, .sdh)
  const escaped = videoBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const langPattern = new RegExp(`^${escaped}[._-]([a-zA-Z]{2,4}(?:[._-][a-zA-Z0-9]+)?)$`, 'i');
  if (!langPattern.test(subBase)) {
    return false;
  }

  // Double check full episode code: so E02 never matches E20
  const epRegex = /(?:s\d+)?e(\d+)|(\d+)x(\d+)/gi;
  const vMatches = [...videoBase.matchAll(epRegex)].map((m) => parseInt(m[1] || m[3], 10));
  const sMatches = [...subBase.matchAll(epRegex)].map((m) => parseInt(m[1] || m[3], 10));
  if (vMatches.length > 0 && sMatches.length > 0) {
    if (vMatches[0] !== sMatches[0]) return false;
  }

  return true;
}

/**
 * Probe media format, codecs, duration, audio tracks, and subtitles using ffprobe
 */
function getMediaDetails(filePath) {
  if (mediaDetailsCache.has(filePath)) {
    return Promise.resolve(mediaDetailsCache.get(filePath));
  }

  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=index,codec_type,codec_name,channels,channel_layout:stream_tags=language,title',
      '-of', 'json',
      filePath
    ];

    execFile(getFfprobePath(), args, (err, stdout) => {
      let vCodec = 'h264';
      let aCodec = 'aac';
      let duration = 0;
      const audioTracks = [];
      const subtitleTracks = [];

      if (!err && stdout) {
        try {
          const data = JSON.parse(stdout);
          duration = parseFloat(data.format?.duration || '0') || 0;
          const streams = data.streams || [];

          const vStream = streams.find((s) => s.codec_type === 'video');
          if (vStream) {
            vCodec = (vStream.codec_name || 'h264').toLowerCase();
          }

          let aIdx = 0;
          let sIdx = 0;
          for (const s of streams) {
            if (s.codec_type === 'audio') {
              const label = formatAudioLabel(s, aIdx);
              audioTracks.push({
                index: s.index,
                audioIndex: aIdx,
                codec: (s.codec_name || '').toLowerCase(),
                channels: s.channels || 2,
                layout: s.channel_layout || '',
                language: s.tags?.language || '',
                title: s.tags?.title || '',
                label
              });
              if (aIdx === 0) {
                aCodec = (s.codec_name || 'aac').toLowerCase();
              }
              aIdx++;
            } else if (s.codec_type === 'subtitle') {
              const label = formatSubtitleLabel(s, sIdx);
              subtitleTracks.push({
                id: `embed_${s.index}`,
                type: 'embedded',
                streamIndex: s.index,
                subIndex: sIdx,
                codec: (s.codec_name || '').toLowerCase(),
                language: s.tags?.language || '',
                title: s.tags?.title || '',
                label,
                url: `/sub?file=${encodeURIComponent(filePath)}&streamIndex=${s.index}`
              });
              sIdx++;
            }
          }
        } catch (e) {
          console.error('[getMediaDetails JSON error]', e);
        }
      }

      // Also check directory for external subtitle files (.srt, .vtt, .ass, .ssa)
      // Must match exact video base name plus optional language tag, in same folder only
      try {
        const dir = path.dirname(filePath);
        const videoBase = path.basename(filePath, path.extname(filePath));
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (isSubtitleMatch(filePath, f)) {
            const fExt = path.extname(f).toLowerCase();
            const fBase = path.basename(f, fExt);
            const fullPath = path.join(dir, f);
            const label = fBase.slice(videoBase.length).replace(/^[._-]/, '').trim() || 'Default';
            subtitleTracks.push({
              id: `ext_${fullPath}`,
              type: 'external',
              path: fullPath,
              label: `External - ${label} (${fExt.replace('.', '').toUpperCase()})`,
              url: `/sub?file=${encodeURIComponent(fullPath)}&video=${encodeURIComponent(filePath)}`
            });
          }
        }
      } catch { }

      const ext = path.extname(filePath).toLowerCase();
      const nativeContainers = ['.mp4', '.webm', '.m4v', '.mov'];
      const nativeVideoCodecs = ['h264', 'avc', 'avc1', 'vp8', 'vp9', 'av1', 'av01'];
      const nativeAudioCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'wav', 'pcm_s16le', 'pcm_s24le', ''];

      const isDirectPlayable =
        nativeContainers.includes(ext) &&
        nativeVideoCodecs.includes(vCodec) &&
        nativeAudioCodecs.includes(aCodec);

      const details = {
        vCodec,
        aCodec,
        duration,
        ext,
        isDirectPlayable,
        audioTracks,
        subtitleTracks
      };

      mediaDetailsCache.set(filePath, details);
      resolve(details);
    });
  });
}

function normalizeIp(rawIp) {
  if (!rawIp) return '';
  let ip = String(rawIp).trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  return ip;
}

export function isPrivateLanIp(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  // 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  }
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  }
  // 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  }
  return false;
}

export function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (isPrivateLanIp(iface.address)) {
          const isVirtual = /virtual|vethernet|vmware|vbox|docker|loopback/i.test(name);
          candidates.push({ address: iface.address, isVirtual });
        }
      }
    }
  }
  const real = candidates.find((c) => !c.isVirtual);
  if (real) return real.address;
  if (candidates.length > 0) return candidates[0].address;
  return '127.0.0.1';
}

function getHlsJsPath() {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/hls.js/dist/hls.min.js'),
    path.join(__dirname, '../../node_modules/hls.js/dist/hls.min.js'),
    path.join(__dirname, '../node_modules/hls.js/dist/hls.min.js'),
    globalThis.process?.resourcesPath ? path.join(globalThis.process.resourcesPath, 'app.asar/node_modules/hls.js/dist/hls.min.js') : null,
    globalThis.process?.resourcesPath ? path.join(globalThis.process.resourcesPath, 'node_modules/hls.js/dist/hls.min.js') : null
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function findLibraryItem(idOrPath) {
  if (!idOrPath) return null;
  const lib = Store.getLibrary();
  const allSeries = [...(lib.series || []), ...(lib.anime || [])];

  for (const m of (lib.movies || [])) {
    if (m.id === idOrPath || m.filePath === idOrPath) return m;
  }
  for (const s of allSeries) {
    if (s.id === idOrPath) return s;
    for (const season of Object.values(s.seasons || {})) {
      if (Array.isArray(season)) {
        for (const ep of season) {
          if (ep.id === idOrPath || ep.filePath === idOrPath) {
            return {
              ...ep,
              seriesTitle: s.title,
              title: `${s.title} - S${ep.season}:E${ep.episode} • ${ep.title || `Episode ${ep.episode}`}`
            };
          }
        }
      }
    }
  }
  if (fs.existsSync(idOrPath)) {
    return {
      id: idOrPath,
      title: path.basename(idOrPath, path.extname(idOrPath)),
      filePath: idOrPath
    };
  }
  return null;
}

function serveDirectRangeStream(req, res, targetFile) {
  try {
    const stat = fs.statSync(targetFile);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(targetFile).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mkv') contentType = 'video/x-matroska';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.m4v') contentType = 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        return res.end();
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(targetFile, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(targetFile).pipe(res);
    }
  } catch (err) {
    console.error('[StreamServer Range Error]', err);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end(`Streaming error: ${err.message}`);
    }
  }
}

let phoneServer = null;
let isPhoneModeEnabled = false;
let phonePort = 8080;

export function getPhoneModeStatus() {
  const lanIp = getLanIp();
  return {
    enabled: isPhoneModeEnabled,
    ip: lanIp,
    port: phonePort,
    url: `http://${lanIp}:${phonePort}`
  };
}

export function setPhoneMode(enabled, port = 8080) {
  isPhoneModeEnabled = !!enabled;
  phonePort = port;
  const lanIp = getLanIp();

  if (isPhoneModeEnabled) {
    if (!phoneServer) {
      phoneServer = http.createServer(handleRequest);
      phoneServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[PhoneServer] Port ${phonePort} already in use. Reusing socket.`);
        } else {
          console.error('[PhoneServer Error]', err);
        }
      });
      phoneServer.listen(phonePort, '0.0.0.0', () => {
        console.log(`Phone streaming server active on http://${lanIp}:${phonePort}`);
      });
    }
  } else {
    if (phoneServer) {
      try {
        phoneServer.close();
      } catch {}
      phoneServer = null;
      console.log('[PhoneServer] Phone streaming server stopped.');
    }
  }
  return getPhoneModeStatus();
}

/**
 * Start lightweight local streaming and static web server.
 */
export function startStreamServer(port = 39281) {
  const server = http.createServer(handleRequest);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[StreamServer] Port ${port} is already bound by an existing instance. Reusing socket.`);
    } else {
      console.error('[StreamServer] Fatal server error:', err);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Stream and web server active on http://127.0.0.1:${port}`);
  });

  return server;
}

/**
 * Main HTTP request handler used by both internal desktop server (port 39281)
 * and home Wi-Fi phone server (port 8080).
 */
async function handleRequest(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Security check: Allow requests only from private LAN addresses (10.x, 172.16-31.x, 192.168.x, and 127.0.0.1)
  const clientIp = req.socket.remoteAddress;
  if (!isPrivateLanIp(clientIp)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: Requests allowed only from private LAN addresses.');
    return;
  }

  // Also check for spoofed public IPs in headers
  const forwardedHdr = req.headers['x-forwarded-for'];
  const realIpHdr = req.headers['x-real-ip'];
  const clientIpHdr = req.headers['client-ip'];
  for (const h of [forwardedHdr, realIpHdr, clientIpHdr]) {
    if (h) {
      const ipToCheck = h.split(',')[0].trim();
      if (!isPrivateLanIp(ipToCheck)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden: Requests allowed only from private LAN addresses.');
        return;
      }
    }
  }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname || '/';
    const targetFile = parsedUrl.query.file || parsedUrl.query.path;

    // 0. Serve local hls.min.js for completely offline phone playback (no CDN)
    if (pathname === '/hls.min.js' || pathname === '/js/hls.min.js') {
      const hlsPath = getHlsJsPath();
      if (hlsPath && fs.existsSync(hlsPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=604800'
        });
        fs.createReadStream(hlsPath).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end('hls.min.js not found');
      return;
    }

    // 0.1. Phone Library JSON API: GET /api/library
    if (pathname === '/api/library') {
      const lib = Store.getLibrary();
      const allProg = Store.getAllProgress();

      const attachProgress = (item) => ({
        ...item,
        progress: allProg[item.filePath] || null
      });

      const movies = (lib.movies || []).map(attachProgress);
      const series = (lib.series || []).map((s) => {
        const seasons = {};
        for (const [k, eps] of Object.entries(s.seasons || {})) {
          seasons[k] = (eps || []).map(attachProgress);
        }
        return {
          ...s,
          seasons,
          progress: allProg[s.filePath] || null
        };
      });
      const anime = (lib.anime || []).map((a) => {
        const seasons = {};
        for (const [k, eps] of Object.entries(a.seasons || {})) {
          seasons[k] = (eps || []).map(attachProgress);
        }
        return {
          ...a,
          seasons,
          progress: allProg[a.filePath] || null
        };
      });

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify({ movies, series, anime }));
      return;
    }

    // 0.2. Watch Progress API: GET /api/progress/:id and POST /api/progress
    if (pathname.startsWith('/api/progress')) {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            let targetPath = data.filePath;
            if (!targetPath && data.id) {
              const it = findLibraryItem(data.id);
              if (it) targetPath = it.filePath;
            }
            if (targetPath) {
              const saved = Store.saveProgress(targetPath, {
                currentTime: data.currentTime,
                duration: data.duration,
                completed: data.completed
              });
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: true, progress: saved }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: 'Missing target file path or valid id' }));
            }
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // GET /api/progress/:id
      const idMatch = pathname.match(/^\/api\/progress\/(.+)$/);
      const reqId = idMatch ? decodeURIComponent(idMatch[1]) : (parsedUrl.query.id || parsedUrl.query.file);
      if (reqId) {
        let targetPath = reqId;
        const it = findLibraryItem(reqId);
        if (it && it.filePath) targetPath = it.filePath;

        const prog = Store.getProgress(targetPath);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(prog || { currentTime: 0, duration: 0, percentage: 0, completed: false }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Missing id parameter' }));
      return;
    }

    // 0.3. Media Info API: GET /api/media-info/:id
    const infoMatch = pathname.match(/^\/api\/media-info\/(.+)$/);
    if (infoMatch) {
      const reqId = decodeURIComponent(infoMatch[1]);
      let targetPath = reqId;
      const it = findLibraryItem(reqId);
      if (it && it.filePath) targetPath = it.filePath;

      if (!targetPath || !fs.existsSync(targetPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      try {
        const details = await getMediaDetails(targetPath);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(details));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 0.4. Phone Player Page: GET /watch/:id
    const watchMatch = pathname.match(/^\/watch\/(.+)$/);
    if (watchMatch || pathname === '/watch') {
      const mediaId = watchMatch ? decodeURIComponent(watchMatch[1]) : (parsedUrl.query.id || '');
      const item = findLibraryItem(mediaId);
      if (!item || !item.filePath || !fs.existsSync(item.filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1 style="color:#fff;background:#141414;padding:40px;font-family:sans-serif;">Video not found. <a href="/" style="color:#e50914;">Return to library</a></h1>');
        return;
      }

      const prog = Store.getProgress(item.filePath);
      const initialProgress = prog?.currentTime || 0;
      const details = await getMediaDetails(item.filePath);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderPlayerHtml(item, initialProgress, details.isDirectPlayable));
      return;
    }

    // 0.5. Dedicated Video Route: GET /video/:id (streams MP4/WebM with Range 206, or redirects MKV to HLS)
    const videoRouteMatch = pathname.match(/^\/video\/(.+)$/);
    if (videoRouteMatch) {
      const vId = decodeURIComponent(videoRouteMatch[1]);
      let resolvedVideoFile = vId;
      const it = findLibraryItem(vId);
      if (it && it.filePath) resolvedVideoFile = it.filePath;

      if (!resolvedVideoFile || !fs.existsSync(resolvedVideoFile)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }

      const details = await getMediaDetails(resolvedVideoFile);
      if (!details.isDirectPlayable) {
        res.writeHead(302, { Location: `/hls/playlist.m3u8?file=${encodeURIComponent(resolvedVideoFile)}&player=phone` });
        res.end();
        return;
      }

      serveDirectRangeStream(req, res, resolvedVideoFile);
      return;
    }

    // 1. Thumbnail endpoint
    if (pathname === '/thumb') {
      let resolvedFile = targetFile;
      if (!resolvedFile && parsedUrl.query.id) {
        const it = findLibraryItem(parsedUrl.query.id);
        if (it) resolvedFile = it.poster || it.filePath;
      }
      if (!resolvedFile || !fs.existsSync(resolvedFile)) {
        // Handle files transferred from another user profile (e.g. C:\Users\<OtherUser>\AppData\Roaming\NetFlixxy\...)
        if (resolvedFile) {
          const match = resolvedFile.match(/NetFlixxy[\\/](posters|backdrops|thumbnails|episodes)[\\/]([^\\/]+)$/i);
          if (match) {
            const localCandidate = path.join(APP_DATA, match[1], match[2]);
            if (fs.existsSync(localCandidate)) {
              resolvedFile = localCandidate;
            }
          }
        }
      }

      if (!resolvedFile || !fs.existsSync(resolvedFile)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      try {
        const stat = fs.statSync(resolvedFile);
        let thumbPath = resolvedFile;
        const ext = path.extname(resolvedFile).toLowerCase();
        if (['.mp4', '.mkv', '.avi', '.webm', '.mov'].includes(ext)) {
          // Check if library has official clean poster or backdrop for this file
          try {
            const lib = Store.getLibrary();
            const movieMatch = lib.movies?.find((m) => m.filePath === resolvedFile);
            if (movieMatch && movieMatch.poster && fs.existsSync(movieMatch.poster)) {
              thumbPath = movieMatch.poster;
            } else {
              // Find matching series if this is an episode
              let seriesMatch = null;
              for (const s of [...(lib.series || []), ...(lib.anime || [])]) {
                for (const season of Object.values(s.seasons || {})) {
                  if (Array.isArray(season) && season.some((ep) => ep.filePath === resolvedFile)) {
                    seriesMatch = s;
                    break;
                  }
                }
                if (seriesMatch) break;
              }

              try {
                thumbPath = await generateThumbnail(resolvedFile, stat.mtimeMs);
              } catch {
                thumbPath = null;
              }

              // Fallback to series backdrop or poster if FFmpeg is missing or failed
              if (!thumbPath || !fs.existsSync(thumbPath)) {
                if (seriesMatch && seriesMatch.backdrop && fs.existsSync(seriesMatch.backdrop)) {
                  thumbPath = seriesMatch.backdrop;
                } else if (seriesMatch && seriesMatch.poster && fs.existsSync(seriesMatch.poster)) {
                  thumbPath = seriesMatch.poster;
                }
              }
            }
          } catch {
            try {
              thumbPath = await generateThumbnail(resolvedFile, stat.mtimeMs);
            } catch {
              thumbPath = null;
            }
          }
        }
        if (thumbPath && fs.existsSync(thumbPath)) {
          const thumbExt = path.extname(thumbPath).toLowerCase();
          const contentType = thumbExt === '.png' ? 'image/png' : thumbExt === '.webp' ? 'image/webp' : 'image/jpeg';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400'
          });
          fs.createReadStream(thumbPath).pipe(res);
        } else {
          res.writeHead(404);
          res.end('Thumbnail unavailable');
        }
      } catch (e) {
        res.writeHead(500);
        res.end(e.message);
      }
      return;
    }

    // 1.5. Preview Frame endpoint (1 frame per 10s at 160px wide)
    if (pathname === '/preview') {
      const videoId = parsedUrl.query.id;
      if (!videoId) {
        res.writeHead(400);
        res.end('Missing video id');
        return;
      }
      const time = parseFloat(parsedUrl.query.time || '0');
      const frameIndex = parsedUrl.query.frame ? parseInt(parsedUrl.query.frame, 10) : Math.max(1, Math.floor(time / 10) + 1);
      const frameFileName = `${String(frameIndex).padStart(5, '0')}.jpg`;
      const framePath = path.join(PREVIEWS_CACHE_DIR, videoId, frameFileName);

      if (fs.existsSync(framePath)) {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400'
        });
        fs.createReadStream(framePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Frame not available');
      }
      return;
    }

    // 2. Subtitle endpoint (auto converts SRT/ASS to VTT, extracts embedded subtitles)
    if (pathname === '/sub') {
      if (!targetFile || !fs.existsSync(targetFile)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      try {
        const streamParam = parsedUrl.query.streamIndex !== undefined ? parsedUrl.query.streamIndex : parsedUrl.query.stream;
        if (streamParam !== undefined && streamParam !== null && streamParam !== '') {
          // Extract embedded subtitle track using ffprobe stream index
          const streamIndex = parseInt(streamParam, 10);
          // Key parsed cache by video's absolute path plus subtitle stream
          const hashKey = crypto.createHash('sha256').update(targetFile + '::stream_' + streamIndex).digest('hex').slice(0, 32);
          const cachedPath = path.join(SUB_CACHE_DIR, `${hashKey}.vtt`);

          if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 100) {
            res.writeHead(200, {
              'Content-Type': 'text/vtt; charset=utf-8',
              'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(cachedPath).pipe(res);
            return;
          }

          const tempCachedPath = `${cachedPath}.part.vtt`;
          execFile(getFfmpegPath(), ['-v', 'error', '-y', '-i', targetFile, '-map', `0:${streamIndex}`, '-c:s', 'webvtt', tempCachedPath], (err) => {
            if (err || !fs.existsSync(tempCachedPath)) {
              console.warn('[StreamServer] Failed to extract sub track at stream index', streamIndex, err);
              res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8' });
              res.end('WEBVTT\n\n');
              return;
            }
            try {
              fs.renameSync(tempCachedPath, cachedPath);
            } catch {}
            res.writeHead(200, {
              'Content-Type': 'text/vtt; charset=utf-8',
              'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(cachedPath).pipe(res);
          });
          return;
        }

        // External subtitle file
        const videoParam = parsedUrl.query.video || targetFile;
        // Key parsed cache by video's absolute path plus subtitle's absolute path
        const hashKey = crypto.createHash('sha256').update(videoParam + '::' + targetFile).digest('hex').slice(0, 32);
        const cachedPath = path.join(SUB_CACHE_DIR, `${hashKey}.vtt`);

        const ext = path.extname(targetFile).toLowerCase();
        if (ext === '.vtt') {
          res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8' });
          fs.createReadStream(targetFile).pipe(res);
          return;
        }

        if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 10) {
          res.writeHead(200, {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Cache-Control': 'public, max-age=86400'
          });
          fs.createReadStream(cachedPath).pipe(res);
          return;
        }

        const content = fs.readFileSync(targetFile, 'utf-8');
        let vttOutput = '';
        if (ext === '.srt') {
          vttOutput = srtToVtt(content);
        } else if (ext === '.ass' || ext === '.ssa') {
          vttOutput = assToVtt(content);
        } else {
          vttOutput = content;
        }
        try {
          fs.writeFileSync(cachedPath, vttOutput, 'utf-8');
        } catch {}

        res.writeHead(200, {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(vttOutput);
      } catch (e) {
        res.writeHead(500);
        res.end(e.message);
      }
      return;
    }

    // 3. Media info / duration endpoint
    if (pathname === '/info') {
      if (!targetFile || !fs.existsSync(targetFile)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      try {
        const details = await getMediaDetails(targetFile);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(details));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 3.5. Playback status endpoint to pause/resume previews and thumbnails
    if (pathname === '/playback-status') {
      const state = parsedUrl.query.state;
      if (state === 'playing' || state === 'loading' || state === 'buffering') {
        previewGenerator.pauseForPlayback();
        pauseThumbnails();
      } else if (state === 'paused' || state === 'stopped') {
        previewGenerator.resumeAfterPlayback();
        resumeThumbnails();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, state }));
      return;
    }

    // 4. HLS Playlist endpoint (Fast uniform 4.0s VOD segments, EXT-X-ENDLIST)
    if (pathname === '/hls/playlist.m3u8') {
      if (!targetFile || !fs.existsSync(targetFile)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      try {
        const details = await getMediaDetails(targetFile);
        const audioIndex = parsedUrl.query.audio !== undefined && parsedUrl.query.audio !== ''
          ? parseInt(parsedUrl.query.audio, 10)
          : 0;
        const player = parsedUrl.query.player || 'main';
        const duration = details.duration || 3600;

        // Fast uniform segments: First segment 2.0s for instant startup, subsequent segments 4.0s
        const segments = [];
        let curStart = 0;
        if (duration > 0) {
          const firstDur = Math.min(2.0, duration);
          segments.push({ start: 0, dur: firstDur });
          curStart = firstDur;
          const segDur = 4.0;
          while (curStart < duration) {
            const dur = Math.min(segDur, duration - curStart);
            segments.push({ start: curStart, dur });
            curStart += dur;
          }
        }

        const targetDur = 5;
        let m3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${targetDur}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n`;
        for (const seg of segments) {
          const sStr = seg.start.toFixed(3);
          const dStr = seg.dur.toFixed(3);
          m3u8 += `#EXTINF:${dStr},\n`;
          m3u8 += `/hls/segment.ts?file=${encodeURIComponent(targetFile)}&start=${sStr}&t=${dStr}&audio=${audioIndex}&player=${encodeURIComponent(player)}\n`;
        }
        m3u8 += '#EXT-X-ENDLIST\n';

        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(m3u8);
      } catch (e) {
        res.writeHead(500);
        res.end(e.message);
      }
      return;
    }

    // 4.5. HLS Segment endpoint (transcoded on-demand, single active job per player, prefetch next 2)
    if (pathname === '/hls/segment.ts') {
      if (!targetFile || !fs.existsSync(targetFile)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      const start = parseFloat(parsedUrl.query.start || '0') || 0;
      const audioIndex = parsedUrl.query.audio !== undefined && parsedUrl.query.audio !== ''
        ? parseInt(parsedUrl.query.audio, 10)
        : 0;
      const player = parsedUrl.query.player || 'main';
      const segDur = parseFloat(parsedUrl.query.t || '6') || 6;

      try {
        const segPath = await transcodeSegment(player, targetFile, audioIndex, start, segDur);
        const stat = fs.statSync(segPath);
        res.writeHead(200, {
          'Content-Type': 'video/mp2t',
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(segPath).pipe(res);
      } catch (err) {
        console.error('[HLS Segment error]', err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Segment transcode failed');
        }
      }
      return;
    }

    // 4.6. Direct Native Media Stream (MP4/WebM served directly with HTTP Range 206, no ffmpeg)
    if (pathname === '/stream') {
      if (!targetFile || !fs.existsSync(targetFile)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }

      try {
        const stat = fs.statSync(targetFile);
        const fileSize = stat.size;
        const range = req.headers.range;
        const ext = path.extname(targetFile).toLowerCase();
        let contentType = 'video/mp4';
        if (ext === '.webm') contentType = 'video/webm';
        else if (ext === '.mkv') contentType = 'video/x-matroska';
        else if (ext === '.mov') contentType = 'video/quicktime';
        else if (ext === '.m4v') contentType = 'video/mp4';

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

          if (start >= fileSize || end >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
          }

          const chunksize = end - start + 1;
          const fileStream = fs.createReadStream(targetFile, { start, end });

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });

          fileStream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(targetFile).pipe(res);
        }
        return;
      } catch (err) {
        console.error('[StreamServer Error]', err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end(`Streaming error: ${err.message}`);
        }
        return;
      }
    }

    // 5. Root Library endpoint: GET / or /index.html
    if (pathname === '/' || pathname === '/index.html') {
      const isHost8080 = req.headers.host && req.headers.host.includes(':8080');
      const isElectron = (req.headers['user-agent'] || '').includes('Electron');

      // Port 8080 OR non-Electron browser: serve Phone Library HTML
      if (isHost8080 || !isElectron) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(renderLibraryHtml());
        return;
      }
      // Otherwise Desktop Electron App: falls through to serve dist/index.html
    }

    // 6. Static Frontend File Server (serves dist/ directory)
    let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }
    let staticFilePath = path.join(DIST_DIR, safePath);

    // If static file doesn't exist, fallback to index.html (SPA)
    if (!fs.existsSync(staticFilePath) || fs.statSync(staticFilePath).isDirectory()) {
      staticFilePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(staticFilePath)) {
      const ext = path.extname(staticFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(staticFilePath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  }
