import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let APP_DATA_DIR;
try {
  const electron = require('electron');
  const app = electron?.app || electron;
  if (app && typeof app.getPath === 'function') {
    APP_DATA_DIR = app.getPath('userData');
  }
} catch {}
if (!APP_DATA_DIR) {
  APP_DATA_DIR = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'NetFlixxy'
  );
}

const THUMBNAILS_DIR = path.join(APP_DATA_DIR, 'thumbnails');
const SETTINGS_FILE = path.join(APP_DATA_DIR, 'settings.json');
const LIBRARY_FILE = path.join(APP_DATA_DIR, 'library.json');
const PROGRESS_FILE = path.join(APP_DATA_DIR, 'progress.json');
const WATCHED_FILE = path.join(APP_DATA_DIR, 'watched.json');

// Ensure base directories exist
function ensureDirs() {
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

ensureDirs();

let progressCache = null;
let progressFlushTimer = null;

function flushProgressNow() {
  if (progressFlushTimer) {
    clearTimeout(progressFlushTimer);
    progressFlushTimer = null;
  }
  if (progressCache) {
    atomicWriteJson(PROGRESS_FILE, progressCache);
  }
}

try {
  process.on('beforeExit', flushProgressNow);
  process.on('exit', flushProgressNow);
} catch {}

/**
 * Atomic write helper: writes to temp file then replaces target.
 */
function atomicWriteJson(filePath, data) {
  ensureDirs();
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try {
      // Windows renameSync fallback if target locked
      fs.copyFileSync(tempPath, filePath);
      fs.unlinkSync(tempPath);
    } catch {}
  }
}

function readJsonSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return fallback;
  }
}

export const Store = {
  getPaths() {
    return {
      appDataDir: APP_DATA_DIR,
      thumbnailsDir: THUMBNAILS_DIR,
      settingsFile: SETTINGS_FILE,
      libraryFile: LIBRARY_FILE,
      progressFile: PROGRESS_FILE,
      watchedFile: WATCHED_FILE
    };
  },

  // Settings
  getSettings() {
    const defaults = {
      movieDirs: [
        'D:\\Movies & Series\\Movies',
        'D:\\Movies & Series\\English Movies',
        'D:\\Movies & Series\\Hindi Movies'
      ],
      seriesDirs: [
        'D:\\Movies & Series\\Series'
      ],
      animeDirs: [
        'D:\\Movies & Series\\Anime'
      ],
      thumbnailCacheDir: THUMBNAILS_DIR,
      tmdbApiKey: '',
      autoPlayNext: true,
      openInExternalPlayer: false,
      externalPlayerPath: 'vlc', // or 'mpv'
      miniPlayerShortcut: 'CommandOrControl+M',
      miniPlayerSize: 'M',
      miniPlayerBounds: null,
      volume: 1.0,
      isMuted: false,
      lastNonZeroVolume: 0.5,
      phoneModeEnabled: false,
      phoneModePort: 8080,
      phoneModeCustomIp: '',
      phoneModePin: '1234',
      discordRpcEnabled: true,
      discordClientId: '868487355114323968'
    };
    const settings = { ...defaults, ...readJsonSafe(SETTINGS_FILE, {}) };
    if (!settings.discordClientId || settings.discordClientId === '1392902149163319398') {
      settings.discordClientId = '868487355114323968';
    }
    return settings;
  },

  saveSettings(newSettings) {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    atomicWriteJson(SETTINGS_FILE, merged);
    return merged;
  },

  // Library
  getLibrary() {
    return readJsonSafe(LIBRARY_FILE, {
      movies: [],
      series: [],
      anime: [],
      scanReport: { parsedFiles: [], skippedFiles: [], totalVideos: 0, totalSkipped: 0, generatedAt: null },
      scannedAt: null
    });
  },

  saveLibrary(libraryData) {
    atomicWriteJson(LIBRARY_FILE, libraryData);
    return libraryData;
  },

  getScanReport() {
    const lib = this.getLibrary();
    return lib.scanReport || { parsedFiles: [], skippedFiles: [], totalVideos: 0, totalSkipped: 0, generatedAt: null };
  },

  // Watch Progress
  getAllProgress() {
    if (!progressCache) {
      progressCache = readJsonSafe(PROGRESS_FILE, {});
    }
    return progressCache;
  },

  getProgress(filePath) {
    const all = this.getAllProgress();
    return all[filePath] || null;
  },

  flushProgress() {
    flushProgressNow();
  },

  saveProgress(filePath, progressData) {
    const all = this.getAllProgress();
    const existing = all[filePath] || {};
    const duration = progressData.duration !== undefined ? progressData.duration : (existing.duration || 0);
    const currentTime = progressData.currentTime !== undefined ? progressData.currentTime : (existing.currentTime || 0);
    const percentage = duration ? Math.round((currentTime / duration) * 100) : 0;
    // Credit threshold: credits typically start at >= 88% or within final 180s (3m) of an episode
    const isNearEnd = (duration > 0 && currentTime / duration >= 0.88) || (duration > 300 && (duration - currentTime) <= 180);
    const completed = percentage >= 88 || isNearEnd || progressData.completed || false;
    const subDelay = progressData.subDelay !== undefined ? progressData.subDelay : (existing.subDelay ?? 0);
    all[filePath] = {
      filePath,
      currentTime,
      duration,
      percentage,
      completed,
      subDelay,
      updatedAt: Date.now()
    };

    // Immediate flush if finished or explicitly requested; otherwise debounce write by 2 seconds
    if (completed || progressData.immediateFlush) {
      flushProgressNow();
    } else if (!progressFlushTimer) {
      progressFlushTimer = setTimeout(() => {
        progressFlushTimer = null;
        if (progressCache) {
          atomicWriteJson(PROGRESS_FILE, progressCache);
        }
      }, 2000);
    }

    return all[filePath];
  },

  // Watched Shows (Persistent - even if deleted from disk)
  getWatchedShows() {
    const list = readJsonSafe(WATCHED_FILE, []);
    if (!Array.isArray(list)) return [];
    // Ensure stable locked position
    return [...list].sort((a, b) => {
      const posA = a.position !== undefined ? a.position : (a.completedAt || 0);
      const posB = b.position !== undefined ? b.position : (b.completedAt || 0);
      return posA - posB;
    });
  },

  saveWatchedShow(showData) {
    if (!showData || !showData.id) return null;
    const list = this.getWatchedShows();
    const existingIndex = list.findIndex(
      (item) => item.id === showData.id || (item.title && item.title.toLowerCase() === showData.title?.toLowerCase())
    );

    if (existingIndex >= 0) {
      // Show is ALREADY in watched list:
      // USER RULE: "if we rewatch anything dont add it on top like it locks the position rewatch doesnt change the position"
      // Retain existing position and completedAt, do NOT move to top
      const existing = list[existingIndex];
      list[existingIndex] = {
        ...existing,
        ...showData,
        id: existing.id,
        completedAt: existing.completedAt, // Keep original completedAt
        position: existing.position !== undefined ? existing.position : existingIndex, // Keep locked position
        rating: showData.rating !== undefined ? showData.rating : existing.rating // Preserve or update rating
      };
      atomicWriteJson(WATCHED_FILE, list);
      return list[existingIndex];
    } else {
      // Newly completed show: assign next locked position
      const maxPos = list.reduce((max, item) => Math.max(max, item.position ?? 0), -1);
      const newEntry = {
        id: showData.id,
        type: showData.type || (showData.totalSeasons ? 'series' : 'movie'),
        title: showData.title || 'Untitled',
        year: showData.year || null,
        poster: showData.poster || null,
        backdrop: showData.backdrop || showData.banner || null,
        banner: showData.banner || showData.backdrop || null,
        overview: showData.overview || '',
        genres: showData.genres || [],
        totalSeasons: showData.totalSeasons !== undefined ? showData.totalSeasons : null,
        totalEpisodes: showData.totalEpisodes || 1,
        rating: showData.rating !== undefined ? showData.rating : null,
        completedAt: Date.now(),
        position: maxPos + 1
      };
      list.push(newEntry);
      atomicWriteJson(WATCHED_FILE, list);
      return newEntry;
    }
  },

  setWatchedRating(id, rating) {
    const list = this.getWatchedShows();
    const target = list.find((item) => item.id === id);
    if (target) {
      target.rating = rating;
      atomicWriteJson(WATCHED_FILE, list);
      return target;
    }
    return null;
  },

  removeWatchedShow(id) {
    let list = this.getWatchedShows();
    list = list.filter((item) => item.id !== id);
    atomicWriteJson(WATCHED_FILE, list);
    return list;
  }
};
