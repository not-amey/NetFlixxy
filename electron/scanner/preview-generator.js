import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { Store } from '../db/store.js';
import { getFfmpegPath } from '../utils/ffmpeg-path.js';

const APP_DATA_DIR = Store.getPaths().appDataDir;
export const PREVIEWS_CACHE_DIR = path.join(APP_DATA_DIR, 'previews');

if (!fs.existsSync(PREVIEWS_CACHE_DIR)) {
  fs.mkdirSync(PREVIEWS_CACHE_DIR, { recursive: true });
}

/**
 * Remove obsolete 160px preview cache folders that lack manifest.json or have wrong resolution.
 */
export function cleanOldPreviewCache() {
  if (!fs.existsSync(PREVIEWS_CACHE_DIR)) return;
  try {
    const entries = fs.readdirSync(PREVIEWS_CACHE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(PREVIEWS_CACHE_DIR, entry.name);
        const manifestPath = path.join(dirPath, 'manifest.json');
        let isValid = false;
        if (fs.existsSync(manifestPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (data.width === 480 && data.interval === 5) {
              isValid = true;
            }
          } catch {}
        }
        if (!isValid) {
          try {
            fs.rmSync(dirPath, { recursive: true, force: true });
          } catch {}
        }
      }
    }
  } catch {}
}

// Clean old 160px previews on startup
try {
  cleanOldPreviewCache();
} catch {}

/**
 * Check if high-resolution preview frames and manifest exist for this video.
 */
export function hasPreviewFrames(videoId) {
  if (!videoId) return false;
  const videoDir = path.join(PREVIEWS_CACHE_DIR, videoId);
  const manifestPath = path.join(videoDir, 'manifest.json');
  const firstFrame = path.join(videoDir, '00001.jpg');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(firstFrame)) {
    return false;
  }
  try {
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return data.width === 480 && data.interval === 5;
  } catch {
    return false;
  }
}

class PreviewGeneratorQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentProcess = null;
    this.isPausedForPlayback = false;
  }

  enqueue(videoItem) {
    if (!videoItem || !videoItem.filePath || !videoItem.id) return;
    if (hasPreviewFrames(videoItem.id)) return;
    if (!this.queue.some((q) => q.id === videoItem.id)) {
      this.queue.push(videoItem);
      this.processNext();
    }
  }

  enqueueList(videoList) {
    if (!Array.isArray(videoList)) return;
    for (const v of videoList) {
      this.enqueue(v);
    }
  }

  enqueueLibrary(library) {
    if (!library) return;
    const items = [];
    if (Array.isArray(library.movies)) {
      items.push(...library.movies);
    }
    if (Array.isArray(library.series)) {
      for (const s of library.series) {
        if (s.seasons) {
          for (const sNum of Object.keys(s.seasons)) {
            items.push(...(s.seasons[sNum] || []));
          }
        }
      }
    }
    if (Array.isArray(library.anime)) {
      for (const a of library.anime) {
        if (a.seasons) {
          for (const sNum of Object.keys(a.seasons)) {
            items.push(...(a.seasons[sNum] || []));
          }
        }
      }
    }
    this.enqueueList(items);
  }

  pauseForPlayback() {
    this.isPausedForPlayback = true;
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
      } catch {}
      this.currentProcess = null;
    }
  }

  resumeAfterPlayback() {
    this.isPausedForPlayback = false;
    this.processNext();
  }

  processNext() {
    if (this.isProcessing || this.isPausedForPlayback || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item || !fs.existsSync(item.filePath)) {
      this.processNext();
      return;
    }

    if (hasPreviewFrames(item.id)) {
      this.processNext();
      return;
    }

    this.isProcessing = true;
    const videoDir = path.join(PREVIEWS_CACHE_DIR, item.id);
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    const outputPattern = path.join(videoDir, '%05d.jpg');
    const manifestPath = path.join(videoDir, 'manifest.json');

    // Run ffmpeg: 1 frame every 5s, 480px wide, high quality (-q:v 2), 2 threads, below-normal priority
    const args = [
      '-y',
      '-threads', '2',
      '-i', item.filePath,
      '-vf', 'fps=1/5,scale=480:-2',
      '-q:v', '2',
      outputPattern
    ];

    try {
      this.currentProcess = spawn(getFfmpegPath(), args, {
        windowsHide: true,
        stdio: 'ignore'
      });

      try {
        if (this.currentProcess.pid && os.constants.priority?.PRIORITY_BELOW_NORMAL !== undefined) {
          os.setPriority(this.currentProcess.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
        }
      } catch {}

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;
        this.isProcessing = false;
        if (code === 0) {
          try {
            const manifest = {
              videoId: item.id,
              filePath: item.filePath,
              width: 480,
              interval: 5,
              pattern: '%05d.jpg',
              createdAt: new Date().toISOString()
            };
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
          } catch {}
        }
        // Small delay between videos to avoid thrashing disk
        setTimeout(() => {
          this.processNext();
        }, 500);
      });

      this.currentProcess.on('error', (err) => {
        console.warn(`[PreviewGenerator] Failed on ${item.filePath}:`, err.message);
        this.currentProcess = null;
        this.isProcessing = false;
        setTimeout(() => {
          this.processNext();
        }, 1000);
      });
    } catch (err) {
      this.isProcessing = false;
      this.processNext();
    }
  }
}

export const previewGenerator = new PreviewGeneratorQueue();
