import { Store } from '../electron/db/store.js';
import { fetchSeriesEpisodes } from '../electron/scanner/metadata.js';

async function main() {
  console.log('Loading library...');
  const library = Store.getLibrary();
  const seriesList = library.series || [];
  console.log(`Found ${seriesList.length} series in library.`);

  for (const show of seriesList) {
    console.log(`\nFetching official episode details for: ${show.title}`);
    try {
      const epMetaMap = await fetchSeriesEpisodes(show.title);
      const keys = Object.keys(epMetaMap);
      console.log(`  Found ${keys.length} episodes on TVmaze for ${show.title}`);

      let updatedCount = 0;
      for (const sNum of Object.keys(show.seasons)) {
        for (const ep of show.seasons[sNum]) {
          const key = `${ep.season}_${ep.episode}`;
          const epData = epMetaMap[key];
          if (epData) {
            ep.episodeTitle = epData.title;
            ep.title = epData.title;
            if (epData.overview) ep.overview = epData.overview;
            if (epData.thumbnail) ep.thumbnail = epData.thumbnail;
            if (epData.runtime && !ep.duration) ep.duration = epData.runtime;
            updatedCount++;
            console.log(`    S${ep.season}E${ep.episode}: "${ep.title}"`);
          } else {
            console.log(`    S${ep.season}E${ep.episode}: No TVmaze match, keeping ${ep.title}`);
          }
        }
      }
      console.log(`  Updated ${updatedCount} episodes for ${show.title}`);
    } catch (err) {
      console.error(`  Error enriching ${show.title}:`, err.message);
    }
  }

  Store.saveLibrary(library);
  console.log('\nSuccessfully saved enriched library to library.json!');
}

main().catch(console.error);
