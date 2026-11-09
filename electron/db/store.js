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

// Ensure base directories exist
function ensureDirs() {
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

ensureDirs();

/**
 * Atomic write helper: writes to temp file then replaces target.
 */
function atomicWriteJson(filePath, data) {
  ensureDirs();
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    // Windows renameSync fallback if target locked
    fs.copyFileSync(tempPath, filePath);
    fs.unlinkSync(tempPath);
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
      progressFile: PROGRESS_FILE
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
      phoneModePin: '1234'
    };
    return { ...defaults, ...readJsonSafe(SETTINGS_FILE, {}) };
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
    return readJsonSafe(PROGRESS_FILE, {});
  },

  getProgress(filePath) {
    const all = this.getAllProgress();
    return all[filePath] || null;
  },

  saveProgress(filePath, progressData) {
    const all = this.getAllProgress();
    const existing = all[filePath] || {};
    const duration = progressData.duration !== undefined ? progressData.duration : (existing.duration || 0);
    const currentTime = progressData.currentTime !== undefined ? progressData.currentTime : (existing.currentTime || 0);
    const percentage = duration ? Math.round((currentTime / duration) * 100) : 0;
    const completed = percentage >= 95 || progressData.completed || false;
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
    atomicWriteJson(PROGRESS_FILE, all);
    return all[filePath];
  }
};
