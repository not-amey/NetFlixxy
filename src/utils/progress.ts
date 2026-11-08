import { SeriesItem, EpisodeItem, WatchProgress } from '../types/media';

/**
 * Returns all episodes in a series ordered by season and episode number.
 */
export function getAllSeriesEpisodes(series: SeriesItem): EpisodeItem[] {
  const allEpisodes: EpisodeItem[] = [];
  if (!series || !series.seasons) return allEpisodes;
  const seasonNums = Object.keys(series.seasons)
    .map(Number)
    .sort((a, b) => a - b);

  for (const sNum of seasonNums) {
    const eps = [...(series.seasons[sNum] || [])].sort((a, b) => a.episode - b.episode);
    allEpisodes.push(...eps);
  }
  return allEpisodes;
}

export interface SeriesResumeResult {
  episode: EpisodeItem | null;
  progress: WatchProgress | null;
  lastUpdatedAt: number;
  isNextEpisode: boolean;
}

/**
 * Queries the progress table for the series' most recently updated episode,
 * sorted by last-updated time (updatedAt), not by episode number.
 * If that episode is 95% or more watched, returns the next episode from the start.
 */
export function getSeriesResumeEpisode(
  series: SeriesItem,
  progressMap: Record<string, WatchProgress>
): SeriesResumeResult {
  const allEpisodes = getAllSeriesEpisodes(series);
  if (allEpisodes.length === 0) {
    return { episode: null, progress: null, lastUpdatedAt: 0, isNextEpisode: false };
  }

  // Find all episodes with recorded watch progress
  const watchedEpisodes: { episode: EpisodeItem; progress: WatchProgress }[] = [];
  for (const ep of allEpisodes) {
    const p = progressMap[ep.filePath];
    if (p && ((p.updatedAt && p.updatedAt > 0) || p.currentTime > 0)) {
      watchedEpisodes.push({ episode: ep, progress: p });
    }
  }

  // If no watch progress exists anywhere in the series, start from episode 1
  if (watchedEpisodes.length === 0) {
    return { episode: allEpisodes[0], progress: null, lastUpdatedAt: 0, isNextEpisode: false };
  }

  // Sort by last-updated time descending (most recently updated first)
  watchedEpisodes.sort((a, b) => (b.progress.updatedAt || 0) - (a.progress.updatedAt || 0));

  const mostRecent = watchedEpisodes[0];
  const p = mostRecent.progress;
  const isWatched95 =
    p.completed ||
    p.percentage >= 95 ||
    (p.duration > 0 && p.currentTime / p.duration >= 0.95);

  if (isWatched95) {
    // If that episode is 95% or more watched, open the next episode from the start
    const currentIndex = allEpisodes.findIndex((e) => e.filePath === mostRecent.episode.filePath);
    if (currentIndex >= 0 && currentIndex + 1 < allEpisodes.length) {
      const nextEp = allEpisodes[currentIndex + 1];
      return {
        episode: nextEp,
        progress: null, // Start from the beginning (time = 0)
        lastUpdatedAt: p.updatedAt || 0,
        isNextEpisode: true
      };
    } else {
      // Completed last episode of series
      return {
        episode: mostRecent.episode,
        progress: p,
        lastUpdatedAt: p.updatedAt || 0,
        isNextEpisode: false
      };
    }
  }

  return {
    episode: mostRecent.episode,
    progress: p,
    lastUpdatedAt: p.updatedAt || 0,
    isNextEpisode: false
  };
}
