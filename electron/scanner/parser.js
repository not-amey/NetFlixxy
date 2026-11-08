import path from 'path';

const QUALITY_TAGS = [
  '2160p', '4k', 'uhd', '1080p', '720p', '480p', '360p',
  'bluray', 'blu-ray', 'bdrip', 'brrip', 'web-dl', 'webrip', 'web', 'hdtv', 'hdrip', 'dvdrip', 'remux',
  'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', '10bit', '8bit',
  'ddp5.1', 'dd5.1', 'ddp', 'dts', 'ac3', 'aac', 'flac', 'truehd', 'atmos',
  'amzn', 'nf', 'dsnp', 'hmax', 'atvp',
  'proper', 'repack', 'unrated', 'extended', 'directors.cut'
];

// Well-known uploader/site signatures to drop
const SITE_TAGS = [
  'vegamovies', 'primefix', 'yify', 'yts', 'eztv', 'rarbg', 'psa', 'galaxycodec', 'bone'
];

/**
 * Clean a string: replace separators with spaces and collapse whitespace.
 */
function cleanSpaces(str) {
  return str
    .replace(/[._]/g, ' ')
    .replace(/[-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses raw video filename and relative path into structured metadata.
 * Supports standard TV shows, movies, and anime naming conventions:
 * - [Group] Title - 05 [1080p][HEVC].mkv
 * - Title - 05v2.mkv, Title - 05 (1080p).mkv
 * - Title E05.mkv, Title EP05.mkv, Title_05.mkv
 * - Absolute numbering: episodes 1 to 300+
 * - Folders: Season 1, S1, Specials, OVA, Extras
 * - Strip tags: [CRC 1A2B3C4D], [Dual Audio], [Multi-Subs], [1080p], [HEVC], [x265], BD, WEB
 * - Preserves romaji titles and titles with colons, apostrophes, hyphens
 * @param {string} filePath Full or relative file path
 * @returns {object} Parsed media object
 */
export function parseFilename(filePath) {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const fullName = segments.length > 0 ? segments[segments.length - 1] : filePath;
  const dirnames = segments.slice(0, -1);

  const ext = path.extname(fullName).toLowerCase().replace('.', '');
  // Extract basename without extension safely
  let basename = '';
  const lastDot = fullName.lastIndexOf('.');
  if (lastDot > 0) {
    basename = fullName.substring(0, lastDot);
  } else if (lastDot === 0) {
    basename = ''; // File was literally ".mp4"
  } else {
    basename = fullName;
  }

  let raw = basename.trim();

  // Handle empty or dot-only basename (e.g. ".mp4")
  if (!raw) {
    return {
      rawName: fullName,
      title: '',
      year: null,
      season: null,
      episode: null,
      resolution: null,
      isSeries: false,
      extension: ext,
      filePath
    };
  }

  // 1. Detect Season from directories (Specials/OVA/Extras -> Season 0, Season X / SX -> Season X)
  let season = null;
  let episode = null;
  let isSeries = false;

  for (let i = dirnames.length - 1; i >= 0; i--) {
    const d = dirnames[i];
    if (/\b(?:specials?|ova|extras?|sp)\b/i.test(d)) {
      season = 0;
      isSeries = true;
      break;
    }
    const sMatch = d.match(/\b(?:season|s)\s*(\d{1,2})\b/i);
    if (sMatch) {
      season = parseInt(sMatch[1], 10);
      isSeries = true;
      break;
    }
  }

  // 2. Detect Resolution
  let resolution = null;
  const resMatch = raw.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i);
  if (resMatch) {
    resolution = resMatch[1].toUpperCase();
    if (resolution === '4K') resolution = '2160P';
  }

  // 3. Detect Year (1920 - 2099)
  let year = null;
  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // 4. Strip release group prefix: e.g. [SubsPlease], [Erai-raws], (Commie)
  let working = raw;
  working = working.replace(/^\[([a-zA-Z][^\]]*)\]\s*/, '').replace(/^\(([a-zA-Z][^)]*)\)\s*/, '');

  // Strip CRC hashes like [1A2B3C4D] or (1A2B3C4D)
  working = working.replace(/[\[(][0-9a-fA-F]{8}[\])]/g, ' ');

  // Strip bracketed quality/audio/sub/dub tags
  working = working.replace(
    /[\[(]\s*(?:2160p|4k|1080p|720p|480p|360p|bluray|bd|web-?dl|webrip|web|hdtv|hdrip|hevc|x265|x264|h264|h265|10bit|8bit|remux|dual[\s_-]*audio|multi[\s_-]*subs?|multi[\s_-]*audio|hindi|english|tam|tel|sub|dub|aac|flac|ac3|eac3|dts)[^\])]*[\])]/gi,
    ' '
  );

  // 5. Episode and Season detection
  const sXeMatch = working.match(/[sS](\d{1,2})\s*[-_.]?\s*[eE](\d{1,4})/i);
  const altMatch = working.match(/(\d{1,2})x(\d{1,4})/i);
  const animeDashEpMatch = working.match(/\s+-\s+(\d{1,4})(?:v\d+)?(?:\s|$|\[|\()/i);
  const epOnlyMatch = working.match(/(?:[-_.\s]|^)(?:e|ep|episode)\s*(\d{1,4})(?:v\d+)?(?:\s|$|[-_.\[(])/i);
  const animeUnderscoreEpMatch = working.match(/[_\s](\d{1,4})(?:v\d+)?(?:\s|_|\.|$)/i);
  const parensNumberMatch = working.trim().match(/^\(?(\d{1,4})\)?$/);
  const ovaMatch = working.match(/\b(?:ova|special|extra)\s*(\d{1,3})\b/i);

  let cutoffIndex = -1;

  if (sXeMatch) {
    season = parseInt(sXeMatch[1], 10);
    episode = parseInt(sXeMatch[2], 10);
    cutoffIndex = sXeMatch.index;
    isSeries = true;
  } else if (altMatch) {
    season = parseInt(altMatch[1], 10);
    episode = parseInt(altMatch[2], 10);
    cutoffIndex = altMatch.index;
    isSeries = true;
  } else if (animeDashEpMatch) {
    episode = parseInt(animeDashEpMatch[1], 10);
    cutoffIndex = animeDashEpMatch.index;
    isSeries = true;
  } else if (epOnlyMatch) {
    episode = parseInt(epOnlyMatch[1], 10);
    cutoffIndex = epOnlyMatch.index;
    isSeries = true;
  } else if (ovaMatch) {
    season = 0;
    episode = parseInt(ovaMatch[1], 10);
    cutoffIndex = ovaMatch.index;
    isSeries = true;
  } else if (parensNumberMatch) {
    episode = parseInt(parensNumberMatch[1], 10);
    cutoffIndex = 0;
    isSeries = true;
  } else if (animeUnderscoreEpMatch) {
    episode = parseInt(animeUnderscoreEpMatch[1], 10);
    cutoffIndex = animeUnderscoreEpMatch.index;
    isSeries = true;
  }

  if (isSeries && season === null) {
    season = 1;
  }

  // 6. Extract clean title
  if (cutoffIndex > 0) {
    working = working.substring(0, cutoffIndex);
  } else if (cutoffIndex === 0) {
    working = '';
  } else if (yearMatch && yearMatch.index > 0) {
    working = working.substring(0, yearMatch.index);
  } else if (resMatch && resMatch.index > 0) {
    working = working.substring(0, resMatch.index);
  }

  // Strip trailing resolution tags or bracket leftovers
  working = working.replace(/\[.*?\]/g, ' ');
  working = working.replace(/\(\s*(?:2160p|4k|1080p|720p|480p|360p|bluray|bd|web-?dl|hevc|x265)\s*\)/gi, ' ');
  working = working.replace(/[-–—_.\s]+$/, '').trim();
  working = working.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

  // If working is empty or just a number, fall back to directory name
  if (!working || working.length < 2 || /^\d+$/.test(working)) {
    if (dirnames.length > 0) {
      let candidate = dirnames[dirnames.length - 1];
      if (/(?:season|s)\s*\d+/i.test(candidate) || /(?:specials?|ova|extras?)/i.test(candidate)) {
        candidate = dirnames.length > 1 ? dirnames[dirnames.length - 2] : candidate;
      }
      working = candidate
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/\[.*?\]/g, ' ')
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // Format title (preserve apostrophes, colons, hyphens)
  let title = working
    .split(' ')
    .filter(Boolean)
    .map(w => {
      if (w.includes("'") || w.includes(':') || w.includes('/') || w.includes('-')) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

  return {
    rawName: basename,
    title: title || basename,
    year,
    season,
    episode,
    resolution,
    isSeries,
    extension: ext,
    filePath
  };
}
