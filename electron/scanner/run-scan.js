import { scanLibrary } from './scanner.js';
import { Store } from '../db/store.js';

async function main() {
  console.log('Starting full library rescan with online metadata and safe cover art...');
  const settings = Store.getSettings();
  const results = await scanLibrary(settings, (p) => {
    console.log(`[Scan] ${p.phase}: ${p.currentFile}`);
  });

  Store.saveLibrary(results);
  console.log(`Rescan complete! Processed ${results.movies.length} movies, ${results.series.length} shows.`);

  const openWater = results.movies.find(m => m.title.toLowerCase().includes('open water'));
  if (openWater) {
    console.log('Open Water Metadata:', {
      title: openWater.title,
      year: openWater.year,
      poster: openWater.poster,
      backdrop: openWater.backdrop,
      overview: openWater.overview
    });
  }
}

main().catch(console.error);
