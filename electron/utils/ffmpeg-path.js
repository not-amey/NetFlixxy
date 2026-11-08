import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let isPackaged = false;
try {
  const electron = require('electron');
  const app = electron?.app || electron;
  if (app && typeof app.isPackaged === 'boolean') {
    isPackaged = app.isPackaged;
  }
} catch {}

export function getFfmpegPath() {
  if (isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'ffmpeg.exe');
  }
  const localBin = path.join(process.cwd(), 'resources', 'bin', 'ffmpeg.exe');
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return 'ffmpeg';
}

export function getFfprobePath() {
  if (isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'ffprobe.exe');
  }
  const localBin = path.join(process.cwd(), 'resources', 'bin', 'ffprobe.exe');
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return 'ffprobe';
}
