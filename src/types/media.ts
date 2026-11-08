export interface SubtitleTrack {
  path: string;
  label: string;
  ext: string;
}

export interface MovieItem {
  id: string;
  type: 'movie';
  title: string;
  year?: number | null;
  resolution?: string | null;
  filePath: string;
  folderPath: string;
  poster?: string | null;
  backdrop?: string | null;
  subtitles: SubtitleTrack[];
  sizeBytes: number;
  mtime: number;
  addedAt: number;
  overview?: string;
  genres?: string[];
  runtime?: number;
}

export interface EpisodeItem {
  id: string;
  season: number;
  episode: number;
  title: string;
  rawName: string;
  filePath: string;
  resolution?: string | null;
  subtitles: SubtitleTrack[];
  sizeBytes: number;
  mtime: number;
  duration?: number;
  thumbnail?: string;
  overview?: string;
  episodeTitle?: string;
}

export interface SeriesItem {
  id: string;
  type: 'series';
  title: string;
  year?: number | null;
  folderPath: string;
  poster?: string | null;
  backdrop?: string | null;
  seasons: { [seasonNum: number]: EpisodeItem[] };
  addedAt: number;
  overview?: string;
  genres?: string[];
}

export type MediaItem = MovieItem | SeriesItem;

export interface WatchProgress {
  filePath: string;
  currentTime: number;
  duration: number;
  percentage: number;
  completed: boolean;
  updatedAt: number;
}

export interface ScanReportItem {
  filePath: string;
  title: string;
  season: number | null;
  episode: number | null;
  category: 'movie' | 'series' | 'anime';
  resolution?: string | null;
  poster?: string | null;
  posterSource?: string | null;
  metadataSource?: string | null;
}

export interface SkippedFileItem {
  filePath: string;
  reason: string;
}

export interface ScanReport {
  parsedFiles: ScanReportItem[];
  skippedFiles: SkippedFileItem[];
  totalVideos: number;
  totalSkipped: number;
  generatedAt: string;
}

export interface Settings {
  movieDirs: string[];
  seriesDirs: string[];
  animeDirs: string[];
  thumbnailCacheDir: string;
  tmdbApiKey: string;
  autoPlayNext: boolean;
  openInExternalPlayer: boolean;
  externalPlayerPath: string;
  miniPlayerShortcut?: string;
  miniPlayerSize?: 'S' | 'M' | 'L';
}

export interface LibraryData {
  movies: MovieItem[];
  series: SeriesItem[];
  anime: SeriesItem[];
  scanReport?: ScanReport;
  scannedAt: string | null;
}
