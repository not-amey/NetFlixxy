import { Store } from './store.js';
import { generateThumbnail } from '../scanner/thumbnails.js';
import fs from 'fs';

async function run() {
  console.log('Testing Store...');
  const paths = Store.getPaths();
  console.log('Storage Paths:', paths);

  const settings = Store.getSettings();
  console.log('Current Settings Movie Dirs:', settings.movieDirs);

  // Test save watch progress
  const testFile = 'D:\\Movies & Series\\English Movies\\Death of a Unicorn-480P.mp4';
  const progress = Store.saveProgress(testFile, { currentTime: 240, duration: 1800 });
  console.log('Saved Progress:', progress);

  // Test thumbnail generation
  if (fs.existsSync(testFile)) {
    console.log(`Generating thumbnail for: ${testFile}`);
    const thumb = await generateThumbnail(testFile, 0);
    console.log(`Thumbnail generated at: ${thumb}`);
    if (thumb && fs.existsSync(thumb)) {
      const stat = fs.statSync(thumb);
      console.log(`Thumbnail file size: ${stat.size} bytes`);
    }
  } else {
    console.log(`File not found on disk: ${testFile}`);
  }
}

run().catch(console.error);
