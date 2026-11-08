import { parseFilename } from './parser.js';
import { scanLibrary } from './scanner.js';

console.log('--- TEST 1: RAW STRING PARSING ---');
const sampleFiles = [
  'D:\\Movies & Series\\English Movies\\Beetlejuice.Beetlejuice.2024.720p.WEB-DL.x264.Vegamovies.is.mkv',
  'D:\\Movies & Series\\English Movies\\Death of a Unicorn-480P.mp4',
  'D:\\Movies & Series\\Series\\From\\From.S01E01.1080p.AMZN.WEB-DL.DDP5.1.H.265-PrimeFix.mkv',
  'D:\\Movies & Series\\Series\\Game Of Thrones\\Season 1\\GOT - 1x05 - The Wolf and the Lion.mkv',
  'D:\\Movies & Series\\Series\\Wednesday [Hindi]  (GOAT)\\Season 1\\Wednesday.S01E01.mkv'
];

sampleFiles.forEach(file => {
  const res = parseFilename(file);
  console.log({
    file: res.rawName,
    title: res.title,
    year: res.year,
    season: res.season,
    episode: res.episode,
    res: res.resolution,
    isSeries: res.isSeries
  });
});

console.log('\n--- TEST 2: SCAN LOCAL MEDIA FOLDERS ---');
async function testScan() {
  const config = {
    movieDirs: [
      'D:\\Movies & Series\\English Movies',
      'D:\\Movies & Series\\Hindi Movies',
      'D:\\Movies & Series\\Movies'
    ],
    seriesDirs: [
      'D:\\Movies & Series\\Series'
    ]
  };

  const results = await scanLibrary(config, (progress) => {
    // console.log(`[Progress] ${progress.phase}: ${progress.currentFile}`);
  });

  console.log(`Scan completed!`);
  console.log(`Total Movies found: ${results.movies.length}`);
  results.movies.slice(0, 5).forEach(m => {
    console.log(`  Movie: "${m.title}" (${m.year || 'N/A'}) [${m.resolution || 'SD'}] -> ${m.filePath}`);
  });

  console.log(`Total Series found: ${results.series.length}`);
  results.series.forEach(s => {
    const totalEp = Object.values(s.seasons).reduce((acc, epList) => acc + epList.length, 0);
    console.log(`  Series: "${s.title}" (Seasons: ${Object.keys(s.seasons).length}, Total Episodes: ${totalEp})`);
  });
}

testScan().catch(console.error);
