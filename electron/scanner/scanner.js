import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseFilename } from './parser.js';
import { fetchOnlineMetadata, fetchSeriesEpisodes, cleanWrongMetadataCache } from './metadata.js';
import { cleanOldThumbnailCache } from './thumbnails.js';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v']);
const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt', '.sub', '.ass', '.ssa']);
const POSTER_NAMES = ['poster.jpg', 'poster.png', 'folder.jpg', 'folder.png', 'cover.jpg', 'cover.png'];
const BACKDROP_NAMES = ['backdrop.jpg', 'backdrop.png', 'fanart.jpg', 'fanart.png'];

/**
 * Scan directory recursively for video files.
 * @param {string} dir Directory to scan
 * @param {Function} onProgress Progress callback (scannedCount, currentFile)
 * @returns {Promise<Array>} Array of media file info
 */
export async function walkDirectory(dir, onProgress = null) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      console.error(`Cannot read directory: ${currentDir}`, err);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          results.push(fullPath);
          if (onProgress) {
            onProgress(results.length, fullPath);
          }
        }
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Safe local movie poster/cover image lookup.
 * Only look in the movie's own folder. Never look in a parent folder that holds multiple movies.
 */
function findSafeLocalMovieImage(videoPath, movieRootDir, names) {
  if (!videoPath || !fs.existsSync(videoPath)) return null;
  const folderPath = path.dirname(videoPath);
  const normalizedRoot = movieRootDir ? path.resolve(movieRootDir).toLowerCase() : '';
  const normalizedFolder = path.resolve(folderPath).toLowerCase();
  const videoBaseName = path.basename(videoPath, path.extname(videoPath));

  // If movie file sits directly in movieRootDir (a parent folder holding multiple movies):
  if (normalizedFolder === normalizedRoot) {
    // Only accept image named specifically after the movie
    for (const ext of ['.jpg', '.png', '.jpeg', '.webp']) {
      const specificCandidates = [
        path.join(folderPath, `${videoBaseName}${ext}`),
        path.join(folderPath, `${videoBaseName}-poster${ext}`),
        path.join(folderPath, `${videoBaseName}-cover${ext}`)
      ];
      for (const cand of specificCandidates) {
        if (fs.existsSync(cand)) return cand;
      }
    }
    return null; // Never use generic poster.jpg/folder.jpg in shared root folder
  }

  // If movie is in its own dedicated subfolder:
  for (const ext of ['.jpg', '.png', '.jpeg', '.webp']) {
    const cand = path.join(folderPath, `${videoBaseName}${ext}`);
    if (fs.existsSync(cand)) return cand;
  }
  for (const name of names) {
    const cand = path.join(folderPath, name);
    if (fs.existsSync(cand)) return cand;
  }

  return null; // Never look in parent folder
}

/**
 * Safe local series poster/cover image lookup.
 * Only look in the video's own folder or its show folder. Never look in a parent folder that holds multiple shows.
 */
function findSafeLocalSeriesImage(videoPath, showRootFolder, seriesRootDir, names) {
  const normalizedRoot = seriesRootDir ? path.resolve(seriesRootDir).toLowerCase() : '';
  const normalizedShowRoot = showRootFolder ? path.resolve(showRootFolder).toLowerCase() : '';
  const videoFolder = path.dirname(videoPath);
  const normalizedVideoFolder = path.resolve(videoFolder).toLowerCase();

  // If showRootFolder is the shared series directory itself, never use generic poster.jpg
  if (normalizedShowRoot === normalizedRoot) {
    return null;
  }

  // 1. Look in the show's own root folder (e.g. Series/One Piece/poster.jpg)
  if (normalizedShowRoot && fs.existsSync(showRootFolder)) {
    for (const name of names) {
      const cand = path.join(showRootFolder, name);
      if (fs.existsSync(cand)) return cand;
    }
  }

  // 2. Look in the video's own folder (e.g. Season 1) if different from showRoot and not root
  if (normalizedVideoFolder !== normalizedShowRoot && normalizedVideoFolder !== normalizedRoot && fs.existsSync(videoFolder)) {
    for (const name of names) {
      const cand = path.join(videoFolder, name);
      if (fs.existsSync(cand)) return cand;
    }
  }

  return null; // Never look in seriesRootDir or any parent
}

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
 * Find matching subtitles (.srt, .vtt, .ass, .ssa) that match exact base name plus optional language tag.
 * Never falls back to another file.
 */
function findSubtitles(videoPath) {
  const dir = path.dirname(videoPath);
  const baseWithoutExt = path.basename(videoPath, path.extname(videoPath));
  const subs = [];

  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (isSubtitleMatch(videoPath, file)) {
        const ext = path.extname(file).toLowerCase();
        const subBase = path.basename(file, ext);
        const label = subBase.slice(baseWithoutExt.length).replace(/^[._-]/, '').trim() || 'Default';
        subs.push({
          path: path.join(dir, file),
          label,
          ext: ext.replace('.', '')
        });
      }
    }
  } catch (e) {
    // ignore
  }

  return subs;
}

/**
 * Scan media libraries (Movies, Series, and Anime folders).
 * Generates comprehensive Scan Report listing all parsed and skipped files.
 * @param {object} config { movieDirs: string[], seriesDirs: string[], animeDirs: string[] }
 * @param {Function} onProgress
 */
export async function scanLibrary(config, onProgress = null) {
  // Purge any invalid metadata or old flat thumbnail caches before scanning
  try {
    cleanWrongMetadataCache();
    cleanOldThumbnailCache();
  } catch {}

  const { movieDirs = [], seriesDirs = [], animeDirs = [] } = config;
  const movies = [];
  const seriesMap = new Map();
  const animeMap = new Map();

  const scanReport = {
    parsedFiles: [],
    skippedFiles: [],
    totalVideos: 0,
    totalSkipped: 0,
    generatedAt: new Date().toISOString()
  };

  let totalProcessed = 0;

  // 1. Scan Movies
  for (const movieDir of movieDirs) {
    if (!fs.existsSync(movieDir)) continue;
    const videoFiles = await walkDirectory(movieDir, (count, current) => {
      if (onProgress) onProgress({ phase: 'scanning_movies', currentFile: current, count });
    });

    for (const videoPath of videoFiles) {
      totalProcessed++;
      let stat = null;
      try {
        stat = fs.statSync(videoPath);
      } catch (e) {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: `File unreadable: ${e.message}` });
        continue;
      }

      if (!stat || stat.size === 0) {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: 'Zero-byte file (empty or corrupt)' });
        continue;
      }

      const parsed = parseFilename(videoPath);
      if (!parsed || !parsed.title || parsed.title.trim() === '') {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: 'Could not extract valid title from filename' });
        continue;
      }

      const folderPath = path.dirname(videoPath);
      let poster = findSafeLocalMovieImage(videoPath, movieDir, POSTER_NAMES);
      let backdrop = findSafeLocalMovieImage(videoPath, movieDir, BACKDROP_NAMES);
      let posterSource = poster ? `Local (${path.basename(poster)})` : 'None';
      let metadataSource = 'Local file';
      let overview = '';
      const subtitles = findSubtitles(videoPath);

      // Fetch clean official movie cover and description
      try {
        if (onProgress) onProgress({ phase: 'fetching_details', currentFile: parsed.title });
        const onlineMeta = await fetchOnlineMetadata(parsed.title, 'movie', parsed.year);
        if (onlineMeta) {
          metadataSource = onlineMeta.source || 'Online';
          if (!poster && onlineMeta.poster) {
            poster = onlineMeta.poster;
            posterSource = onlineMeta.source || 'Online';
          }
          if (!backdrop && onlineMeta.backdrop) backdrop = onlineMeta.backdrop;
          if (onlineMeta.overview) overview = onlineMeta.overview;
        }
      } catch (err) {
        console.error(`Metadata fetch error for ${parsed.title}:`, err.message);
      }

      scanReport.parsedFiles.push({
        filePath: videoPath,
        title: parsed.title,
        season: null,
        episode: null,
        category: 'movie',
        resolution: parsed.resolution,
        poster,
        posterSource,
        metadataSource
      });

      movies.push({
        id: `movie_${crypto.createHash('md5').update(videoPath).digest('hex').slice(0, 16)}`,
        type: 'movie',
        title: parsed.title,
        year: parsed.year,
        resolution: parsed.resolution,
        filePath: videoPath,
        folderPath,
        poster,
        posterSource,
        metadataSource,
        backdrop,
        overview,
        subtitles,
        sizeBytes: stat?.size || 0,
        mtime: stat?.mtimeMs || 0,
        addedAt: Date.now()
      });
    }
  }

  // 2. Scan Series
  for (const seriesDir of seriesDirs) {
    if (!fs.existsSync(seriesDir)) continue;
    const videoFiles = await walkDirectory(seriesDir, (count, current) => {
      if (onProgress) onProgress({ phase: 'scanning_series', currentFile: current, count });
    });

    for (const videoPath of videoFiles) {
      totalProcessed++;
      let stat = null;
      try {
        stat = fs.statSync(videoPath);
      } catch (e) {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: `File unreadable: ${e.message}` });
        continue;
      }

      if (!stat || stat.size === 0) {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: 'Zero-byte file (empty or corrupt)' });
        continue;
      }

      const parsed = parseFilename(videoPath);
      if (!parsed || !parsed.title || parsed.title.trim() === '') {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: 'Could not extract valid title from filename' });
        continue;
      }

      const folderPath = path.dirname(videoPath);
      const relative = path.relative(seriesDir, videoPath);
      const segments = relative.split(/[/\\]/);
      let canonicalShowTitle = segments.length > 1 ? segments[0] : parsed.title;
      canonicalShowTitle = canonicalShowTitle
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/\[.*?\]/g, ' ')
        .replace(/\(.*?\)/g, ' ')
        .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const showTitle = canonicalShowTitle || parsed.title;
      const seasonNum = parsed.season !== null && parsed.season !== undefined ? parsed.season : 1;
      const episodeNum = parsed.episode || 1;
      const subtitles = findSubtitles(videoPath);

      if (!seriesMap.has(showTitle)) {
        const showRootFolder = segments.length > 1 ? path.join(seriesDir, segments[0]) : folderPath;
        let poster = findSafeLocalSeriesImage(videoPath, showRootFolder, seriesDir, POSTER_NAMES);
        let backdrop = findSafeLocalSeriesImage(videoPath, showRootFolder, seriesDir, BACKDROP_NAMES);
        let posterSource = poster ? `Local (${path.basename(poster)})` : 'None';
        let metadataSource = 'Local file';
        let overview = '';

        try {
          if (onProgress) onProgress({ phase: 'fetching_details', currentFile: showTitle });
          const onlineMeta = await fetchOnlineMetadata(showTitle, 'series', parsed.year);
          if (onlineMeta) {
            metadataSource = onlineMeta.source || 'Online';
            if (!poster && onlineMeta.poster) {
              poster = onlineMeta.poster;
              posterSource = onlineMeta.source || 'Online';
            }
            if (!backdrop && onlineMeta.backdrop) backdrop = onlineMeta.backdrop;
            if (onlineMeta.overview) overview = onlineMeta.overview;
          }
        } catch (e) {}

        seriesMap.set(showTitle, {
          id: `series_${Buffer.from(showTitle).toString('base64url').slice(0, 24)}`,
          type: 'series',
          title: showTitle,
          year: parsed.year,
          folderPath: showRootFolder,
          poster,
          posterSource,
          metadataSource,
          backdrop,
          overview,
          seasons: {},
          addedAt: Date.now()
        });
      }

      const show = seriesMap.get(showTitle);
      scanReport.parsedFiles.push({
        filePath: videoPath,
        title: showTitle,
        season: seasonNum,
        episode: episodeNum,
        category: 'series',
        resolution: parsed.resolution,
        poster: show.poster || null,
        posterSource: show.posterSource || 'None',
        metadataSource: show.metadataSource || 'Local file'
      });

      if (!show.seasons[seasonNum]) {
        show.seasons[seasonNum] = [];
      }

      show.seasons[seasonNum].push({
        id: `ep_${crypto.createHash('md5').update(videoPath).digest('hex').slice(0, 16)}`,
        season: seasonNum,
        episode: episodeNum,
        title: `Episode ${episodeNum}`,
        rawName: parsed.rawName,
        filePath: videoPath,
        resolution: parsed.resolution,
        subtitles,
        sizeBytes: stat?.size || 0,
        mtime: stat?.mtimeMs || 0
      });
    }
  }

  // 3. Scan Anime
  for (const animeDir of animeDirs) {
    if (!fs.existsSync(animeDir)) continue;
    const videoFiles = await walkDirectory(animeDir, (count, current) => {
      if (onProgress) onProgress({ phase: 'scanning_anime', currentFile: current, count });
    });

    for (const videoPath of videoFiles) {
      totalProcessed++;
      let stat = null;
      try {
        stat = fs.statSync(videoPath);
      } catch (e) {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: `File unreadable: ${e.message}` });
        continue;
      }

      if (!stat || stat.size === 0) {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: 'Zero-byte file (empty or corrupt)' });
        continue;
      }

      const parsed = parseFilename(videoPath);
      if (!parsed || !parsed.title || parsed.title.trim() === '') {
        scanReport.skippedFiles.push({ filePath: videoPath, reason: 'Filename has no title or episode number (e.g. .mp4)' });
        continue;
      }

      const folderPath = path.dirname(videoPath);
      const relative = path.relative(animeDir, videoPath);
      const segments = relative.split(/[/\\]/);
      let canonicalShowTitle = segments.length > 1 ? segments[0] : parsed.title;
      canonicalShowTitle = canonicalShowTitle
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/\[.*?\]/g, ' ')
        .replace(/\(.*?\)/g, ' ')
        .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const showTitle = canonicalShowTitle || parsed.title;
      const seasonNum = parsed.season !== null && parsed.season !== undefined ? parsed.season : 1;
      const episodeNum = parsed.episode || 1;
      const subtitles = findSubtitles(videoPath);

      if (!animeMap.has(showTitle)) {
        const showRootFolder = segments.length > 1 ? path.join(animeDir, segments[0]) : folderPath;
        let poster = findSafeLocalSeriesImage(videoPath, showRootFolder, animeDir, POSTER_NAMES);
        let backdrop = findSafeLocalSeriesImage(videoPath, showRootFolder, animeDir, BACKDROP_NAMES);
        let posterSource = poster ? `Local (${path.basename(poster)})` : 'None';
        let metadataSource = 'Local file';
        let overview = '';

        try {
          if (onProgress) onProgress({ phase: 'fetching_details', currentFile: showTitle });
          const onlineMeta = await fetchOnlineMetadata(showTitle, 'series', parsed.year);
          if (onlineMeta) {
            metadataSource = onlineMeta.source || 'Online';
            if (!poster && onlineMeta.poster) {
              poster = onlineMeta.poster;
              posterSource = onlineMeta.source || 'Online';
            }
            if (!backdrop && onlineMeta.backdrop) backdrop = onlineMeta.backdrop;
            if (onlineMeta.overview) overview = onlineMeta.overview;
          }
        } catch (e) {}

        animeMap.set(showTitle, {
          id: `anime_${Buffer.from(showTitle).toString('base64url').slice(0, 24)}`,
          type: 'series',
          category: 'anime',
          title: showTitle,
          year: parsed.year,
          folderPath: showRootFolder,
          poster,
          posterSource,
          metadataSource,
          backdrop,
          overview,
          seasons: {},
          addedAt: Date.now()
        });
      }

      const show = animeMap.get(showTitle);
      scanReport.parsedFiles.push({
        filePath: videoPath,
        title: showTitle,
        season: seasonNum,
        episode: episodeNum,
        category: 'anime',
        resolution: parsed.resolution,
        poster: show.poster || null,
        posterSource: show.posterSource || 'None',
        metadataSource: show.metadataSource || 'Local file'
      });

      if (!show.seasons[seasonNum]) {
        show.seasons[seasonNum] = [];
      }

      show.seasons[seasonNum].push({
        id: `ep_${crypto.createHash('md5').update(videoPath).digest('hex').slice(0, 16)}`,
        season: seasonNum,
        episode: episodeNum,
        title: `Episode ${episodeNum}`,
        rawName: parsed.rawName,
        filePath: videoPath,
        resolution: parsed.resolution,
        subtitles,
        sizeBytes: stat?.size || 0,
        mtime: stat?.mtimeMs || 0
      });
    }
  }

  // Sort episodes within seasons and enrich series
  const seriesList = [];
  for (const show of seriesMap.values()) {
    let epMetaMap = {};
    try {
      if (onProgress) onProgress({ phase: 'fetching_episodes', currentFile: show.title });
      epMetaMap = await fetchSeriesEpisodes(show.title);
    } catch (e) {}

    for (const sNum of Object.keys(show.seasons)) {
      show.seasons[sNum].sort((a, b) => a.episode - b.episode);
      for (const ep of show.seasons[sNum]) {
        const key = `${ep.season}_${ep.episode}`;
        const epData = epMetaMap[key];
        if (epData) {
          ep.episodeTitle = epData.title;
          ep.title = epData.title;
          if (epData.overview) ep.overview = epData.overview;
          if (epData.thumbnail) ep.thumbnail = epData.thumbnail;
          if (epData.runtime && !ep.duration) ep.duration = epData.runtime;
        }
      }
    }
    seriesList.push(show);
  }

  // Sort episodes within anime seasons
  const animeList = [];
  for (const show of animeMap.values()) {
    let epMetaMap = {};
    try {
      if (onProgress) onProgress({ phase: 'fetching_episodes', currentFile: show.title });
      epMetaMap = await fetchSeriesEpisodes(show.title);
    } catch (e) {}

    for (const sNum of Object.keys(show.seasons)) {
      show.seasons[sNum].sort((a, b) => a.episode - b.episode);
      for (const ep of show.seasons[sNum]) {
        const key = `${ep.season}_${ep.episode}`;
        const epData = epMetaMap[key];
        if (epData) {
          ep.episodeTitle = epData.title;
          ep.title = epData.title;
          if (epData.overview) ep.overview = epData.overview;
          if (epData.thumbnail) ep.thumbnail = epData.thumbnail;
          if (epData.runtime && !ep.duration) ep.duration = epData.runtime;
        }
      }
    }
    animeList.push(show);
  }

  scanReport.totalVideos = scanReport.parsedFiles.length;
  scanReport.totalSkipped = scanReport.skippedFiles.length;

  return {
    movies,
    series: seriesList,
    anime: animeList,
    scanReport,
    totalFiles: totalProcessed,
    scannedAt: new Date().toISOString()
  };
}
