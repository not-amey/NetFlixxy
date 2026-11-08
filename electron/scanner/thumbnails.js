import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { Store } from '../db/store.js';
import { getFfmpegPath, getFfprobePath } from '../utils/ffmpeg-path.js';

const execFileAsync = promisify(execFile);

let isThumbnailPaused = false;
export function pauseThumbnails() {
  isThumbnailPaused = true;
}
export function resumeThumbnails() {
  isThumbnailPaused = false;
}

function runFfmpegLowPriority(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args, { windowsHide: true });
    try {
      if (child.pid && os.constants.priority?.PRIORITY_BELOW_NORMAL !== undefined) {
        os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      }
    } catch {}
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

/**
 * Generate unique cache folder hash from absolute file path, file size, and last modified time.
 * Each video file stores its thumbnails in its own dedicated folder.
 */
export function getVideoFolderHash(filePath, sizeBytes = 0, mtime = 0) {
  let size = sizeBytes;
  let modTime = mtime;

  if ((!size || !modTime) && fs.existsSync(filePath)) {
    try {
      const s = fs.statSync(filePath);
      size = size || s.size;
      modTime = modTime || s.mtimeMs;
    } catch {}
  }

  const normPath = path.resolve(filePath).toLowerCase();
  return crypto.createHash('sha256').update(`${normPath}_${size}_${modTime}`).digest('hex').slice(0, 32);
}

/**
 * Get media duration in seconds via ffprobe.
 */
export async function getVideoDuration(filePath) {
  try {
    const { stdout } = await execFileAsync(getFfprobePath(), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) || duration <= 0 ? 300 : duration;
  } catch (err) {
    return 300; // default 5 min if ffprobe fails
  }
}

/**
 * Generate thumbnail for video file at 10% runtime.
 * Stored in its own folder keyed by absolute file path, file size, and last modified time.
 * @param {string} filePath Absolute path to video
 * @param {number} sizeBytes File size in bytes
 * @param {number} mtime File modified timestamp
 * @param {string} customOutputDir Optional output directory
 * @returns {Promise<string>} Output image path
 */
export async function generateThumbnail(filePath, sizeBytes = 0, mtime = 0, customOutputDir = null) {
  const settings = Store.getSettings();
  const outputDir = customOutputDir || settings.thumbnailCacheDir;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const folderHash = getVideoFolderHash(filePath, sizeBytes, mtime);
  const videoFolder = path.join(outputDir, folderHash);
  if (!fs.existsSync(videoFolder)) {
    fs.mkdirSync(videoFolder, { recursive: true });
  }

  const outPath = path.join(videoFolder, 'thumb.jpg');

  // Return cached if exists and not empty
  if (fs.existsSync(outPath)) {
    try {
      const stat = fs.statSync(outPath);
      if (stat.size > 1000) {
        return outPath;
      }
    } catch (e) {}
  }

  if (isThumbnailPaused) {
    return null;
  }

  const duration = await getVideoDuration(filePath);
  const targetSec = Math.max(5, Math.floor(duration * 0.10));

  try {
    await runFfmpegLowPriority([
      '-ss', targetSec.toString(),
      '-threads', '2',
      '-i', filePath,
      '-vframes', '1',
      '-q:v', '3',
      '-vf', 'scale=640:-1',
      outPath,
      '-y'
    ]);
    return outPath;
  } catch (err) {
    // If 10% mark failed, try 5 seconds
    try {
      await runFfmpegLowPriority([
        '-ss', '5',
        '-threads', '2',
        '-i', filePath,
        '-vframes', '1',
        '-q:v', '3',
        '-vf', 'scale=640:-1',
        outPath,
        '-y'
      ]);
      return outPath;
    } catch (fallbackErr) {
      console.error(`Failed to generate thumbnail for: ${filePath}`, fallbackErr.message);
      return null;
    }
  }
}

/**
 * Batch generate thumbnails with concurrency control.
 * @param {Array<{ filePath: string, sizeBytes?: number, mtime?: number }>} items
 * @param {number} concurrency
 * @param {Function} onProgress
 */
export async function batchGenerateThumbnails(items, concurrency = 2, onProgress = null) {
  let completed = 0;
  const results = new Map();

  for (let i = 0; i < items.length; i += concurrency) {
    while (isThumbnailPaused) {
      await new Promise((r) => setTimeout(r, 500));
    }
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (item) => {
        const thumb = await generateThumbnail(item.filePath, item.sizeBytes || 0, item.mtime || 0);
        results.set(item.filePath, thumb);
        completed++;
        if (onProgress) {
          onProgress({ completed, total: items.length, current: item.filePath, thumb });
        }
      })
    );
  }

  return results;
}

/**
 * Remove obsolete flat cached thumbnails so every video uses its own dedicated folder.
 */
export function cleanOldThumbnailCache() {
  const settings = Store.getSettings();
  const outputDir = settings.thumbnailCacheDir;
  if (!fs.existsSync(outputDir)) return;
  try {
    const entries = fs.readdirSync(outputDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(outputDir, entry.name);
      if (entry.isFile() && (entry.name.endsWith('.jpg') || entry.name.endsWith('.png'))) {
        try {
          fs.unlinkSync(fullPath);
        } catch {}
      }
    }
  } catch {}
}
