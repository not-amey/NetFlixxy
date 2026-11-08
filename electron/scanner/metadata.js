import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { Store } from '../db/store.js';

const APP_DATA = Store.getPaths().appDataDir;
const POSTERS_DIR = path.join(APP_DATA, 'posters');
const BACKDROPS_DIR = path.join(APP_DATA, 'backdrops');
const EPISODES_DIR = path.join(APP_DATA, 'episodes');

if (!fs.existsSync(POSTERS_DIR)) fs.mkdirSync(POSTERS_DIR, { recursive: true });
if (!fs.existsSync(BACKDROPS_DIR)) fs.mkdirSync(BACKDROPS_DIR, { recursive: true });
if (!fs.existsSync(EPISODES_DIR)) fs.mkdirSync(EPISODES_DIR, { recursive: true });

/**
 * Delete wrong cached thumbnails and metadata images so they regenerate accurately.
 */
export function cleanWrongMetadataCache() {
  const dirsToClean = [POSTERS_DIR, BACKDROPS_DIR, EPISODES_DIR];
  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          try {
            if (fs.statSync(fullPath).isFile()) {
              fs.unlinkSync(fullPath);
            }
          } catch {}
        }
      } catch {}
    }
  }
}

/**
 * Normalize title strings for comparison: lowercase, remove punctuation and articles.
 */
export function cleanTitleForCompare(str) {
  return (str || '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\b(2160p|4k|1080p|720p|480p|360p|bluray|bd|web-?dl|webrip|web|hdtv|hdrip|hevc|x265|x264|h264|h265|10bit|8bit|remux)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Check if local media title strictly matches remote metadata title.
 */
export function titlesMatch(localTitle, remoteTitle) {
  const c1 = cleanTitleForCompare(localTitle);
  const c2 = cleanTitleForCompare(remoteTitle);
  if (!c1 || !c2) return false;
  return c1 === c2;
}

/**
 * Check if years match within a 1-year margin (accounting for air date differences).
 */
export function yearsMatch(localYear, remoteYear) {
  if (!localYear || !remoteYear) return true;
  return Math.abs(parseInt(localYear, 10) - parseInt(remoteYear, 10)) <= 1;
}

/**
 * Download an image from URL to local file path.
 */
function downloadImage(imageUrl, destPath) {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(null);
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
      return resolve(destPath);
    }

    const client = imageUrl.startsWith('https') ? https : http;
    const req = client.get(imageUrl, { timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, destPath).then(resolve);
      }

      if (res.statusCode !== 200) {
        return resolve(null);
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });
      fileStream.on('error', () => {
        fs.unlink(destPath, () => {});
        resolve(null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Fetch online metadata and download official poster & backdrop.
 * Matches strictly on title and year, rejecting matches when title differs.
 */
export async function fetchOnlineMetadata(title, type = 'movie', year = null) {
  const settings = Store.getSettings();
  const safeId = Buffer.from(`${title}_${type}`).toString('base64url').slice(0, 20);

  let meta = null;

  // 1. Try TMDB if API key configured
  if (settings.tmdbApiKey) {
    try {
      const tmdbType = type === 'series' ? 'tv' : 'movie';
      let tmdbUrl = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${settings.tmdbApiKey}&query=${encodeURIComponent(title)}`;
      if (year) {
        tmdbUrl += type === 'series' ? `&first_air_date_year=${year}` : `&year=${year}`;
      }

      const res = await fetch(tmdbUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const match = data.results.find((item) => {
            const itemTitle = item.title || item.name || '';
            const itemYear = item.release_date
              ? parseInt(item.release_date.slice(0, 4), 10)
              : (item.first_air_date ? parseInt(item.first_air_date.slice(0, 4), 10) : null);
            return titlesMatch(title, itemTitle) && yearsMatch(year, itemYear);
          });

          if (match) {
            meta = {
              source: 'tmdb',
              title: match.title || match.name || title,
              year: match.release_date
                ? parseInt(match.release_date.slice(0, 4), 10)
                : (match.first_air_date ? parseInt(match.first_air_date.slice(0, 4), 10) : year),
              overview: match.overview || '',
              posterUrl: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
              backdropUrl: match.backdrop_path ? `https://image.tmdb.org/t/p/w1280${match.backdrop_path}` : null
            };
          }
        }
      }
    } catch (e) {}
  }

  // 2. Cinemeta fallback (requires strict title & year match)
  if (!meta) {
    try {
      const cinemetaType = type === 'series' ? 'series' : 'movie';
      const cleanTitle = title
        .replace(/\b(2160p|4k|1080p|720p|480p|360p|bluray|bd|web-?dl|webrip|web|hdtv|hdrip|hevc|x265|x264|h264|h265)\b/gi, ' ')
        .replace(/[-–—_.]+/g, ' ')
        .replace(/[()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const cinemetaUrl = `https://v3-cinemeta.strem.io/catalog/${cinemetaType}/top/search=${encodeURIComponent(cleanTitle)}.json`;

      const res = await fetch(cinemetaUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        if (data.metas && data.metas.length > 0) {
          let match = data.metas.find((item) => {
            const itemTitle = item.name || '';
            const itemYear = item.year ? parseInt(item.year, 10) : (item.releaseInfo ? parseInt(item.releaseInfo, 10) : null);
            return titlesMatch(title, itemTitle) && yearsMatch(year, itemYear);
          });

          // Fallback: check substring match or top search result from Cinemeta
          if (!match && data.metas.length > 0) {
            match = data.metas.find((item) => {
              const itemTitle = item.name || '';
              const c1 = cleanTitleForCompare(title);
              const c2 = cleanTitleForCompare(itemTitle);
              const itemYear = item.year ? parseInt(item.year, 10) : (item.releaseInfo ? parseInt(item.releaseInfo, 10) : null);
              return (c1.includes(c2) || c2.includes(c1)) && yearsMatch(year, itemYear);
            });
            if (!match && year) {
              match = data.metas.find((item) => {
                const itemYear = item.year ? parseInt(item.year, 10) : (item.releaseInfo ? parseInt(item.releaseInfo, 10) : null);
                return yearsMatch(year, itemYear);
              });
            }
            if (!match) {
              match = data.metas[0];
            }
          }

          if (match) {
            const matchedYear = match.year ? parseInt(match.year, 10) : (match.releaseInfo ? parseInt(match.releaseInfo, 10) : year);
            meta = {
              source: 'cinemeta',
              title: match.name || title,
              year: matchedYear,
              overview: match.description || '',
              posterUrl: match.poster || null,
              backdropUrl: match.background || null
            };
          }
        }
      }
    } catch (e) {}
  }

  // Reject match when title differs (meta is null)
  if (!meta) return null;

  // Download and cache poster and backdrop locally
  const posterLocal = meta.posterUrl
    ? await downloadImage(meta.posterUrl, path.join(POSTERS_DIR, `${safeId}_poster.jpg`))
    : null;

  const backdropLocal = meta.backdropUrl
    ? await downloadImage(meta.backdropUrl, path.join(BACKDROPS_DIR, `${safeId}_backdrop.jpg`))
    : null;

  return {
    source: meta.source,
    title: meta.title,
    year: meta.year,
    overview: meta.overview,
    poster: posterLocal,
    backdrop: backdropLocal
  };
}

/**
 * Fetch official episode titles and overviews from TVmaze API.
 * Preview frames come only from video files on disk; no internet image downloads for episodes.
 * Returns Record keyed by `${season}_${episode}`
 */
export async function fetchSeriesEpisodes(title) {
  const cleanTitle = title
    .replace(/\[.*?\]/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const episodeMap = {};

  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}&embed=episodes`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return episodeMap;

    const data = await res.json();
    // Validate show title matches
    if (!titlesMatch(title, data.name || cleanTitle)) {
      return episodeMap;
    }

    const episodes = data._embedded?.episodes || [];

    for (const ep of episodes) {
      if (!ep.season || !ep.number) continue;
      const key = `${ep.season}_${ep.number}`;
      const rawSummary = ep.summary || '';
      const cleanSummary = rawSummary.replace(/<[^>]+>/g, '').trim();

      // No external preview image downloads: preview frames come only from video file on disk
      episodeMap[key] = {
        title: ep.name || `Episode ${ep.number}`,
        overview: cleanSummary,
        runtime: ep.runtime ? ep.runtime * 60 : undefined
      };
    }
  } catch (err) {
    console.error(`Error fetching episodes for series ${title}:`, err.message);
  }

  return episodeMap;
}
