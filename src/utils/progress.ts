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

/**
 * Checks whether an episode is considered completed, factoring in end credits
 * (typically starting at >= 88% or within final 180 seconds).
 */
export function isEpisodeWatchedCompleted(p?: WatchProgress | null): boolean {
  if (!p) return false;
  if (p.completed) return true;
  if (p.percentage >= 88) return true;
  if (p.duration > 0 && p.currentTime / p.duration >= 0.88) return true;
  if (p.duration > 300 && p.duration - p.currentTime <= 180) return true;
  return false;
}

/**
 * Checks if a series has been completed (i.e. every episode is watched, or the final episode is completed).
 */
export function isSeriesFullyWatched(
  series: SeriesItem,
  progressMap: Record<string, WatchProgress>
): boolean {
  const allEpisodes = getAllSeriesEpisodes(series);
  if (allEpisodes.length === 0) return false;

  // If every episode has been watched to the completion threshold
  const allFinished = allEpisodes.every((ep) => isEpisodeWatchedCompleted(progressMap[ep.filePath]));
  if (allFinished) return true;

  // Or if the final episode has been watched to completion
  const lastEp = allEpisodes[allEpisodes.length - 1];
  if (lastEp && isEpisodeWatchedCompleted(progressMap[lastEp.filePath])) {
    return true;
  }

  return false;
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
  const isWatchedCompleted = isEpisodeWatchedCompleted(p);

  if (isWatchedCompleted) {
    // If that episode is completed (including credit threshold), open the next episode from the start
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
