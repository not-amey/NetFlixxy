import { useState, useEffect, useCallback, useRef } from 'react';
import { LibraryData, WatchProgress, Settings, SeriesItem, WatchedShowItem } from '../types/media';
import { getAllSeriesEpisodes, isSeriesFullyWatched } from '../utils/progress';

const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

export function useLibrary() {
  const [library, setLibrary] = useState<LibraryData>({ movies: [], series: [], anime: [], scannedAt: null });
  const [progressMap, setProgressMap] = useState<Record<string, WatchProgress>>({});
  const [watchedShows, setWatchedShows] = useState<WatchedShowItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Load initial data
  const loadData = useCallback(async () => {
    if (!isElectron) {
      setLoading(false);
      return;
    }
    try {
      const [lib, prog, sets, watched] = await Promise.all([
        (window as any).electronAPI.getLibrary(),
        (window as any).electronAPI.getAllProgress(),
        (window as any).electronAPI.getSettings(),
        (window as any).electronAPI.getWatchedShows()
      ]);
      setLibrary(lib || { movies: [], series: [], anime: [], scannedAt: null });
      setProgressMap(prog || {});
      setSettings(sets || null);

      let currentWatched: WatchedShowItem[] = watched || [];

      // Auto-detect completed series in library that haven't been added yet
      const allShows: SeriesItem[] = [...(lib?.series || []), ...(lib?.anime || [])];
      let hasNewAutoWatched = false;
      for (const show of allShows) {
        const alreadyInWatched = currentWatched.some(
          (w) => w.id === show.id || (w.title && w.title.toLowerCase() === show.title?.toLowerCase())
        );
        if (!alreadyInWatched && isSeriesFullyWatched(show, prog || {})) {
          const totalEps = getAllSeriesEpisodes(show).length;
          await (window as any).electronAPI.saveWatchedShow({
            id: show.id,
            type: 'series',
            title: show.title,
            year: show.year || null,
            poster: show.poster || null,
            backdrop: show.backdrop || null,
            banner: show.backdrop || show.poster || null,
            overview: show.overview || '',
            genres: show.genres || [],
            totalSeasons: Object.keys(show.seasons || {}).length || 1,
            totalEpisodes: totalEps || 1
          });
          hasNewAutoWatched = true;
        }
      }

      // Auto-detect completed movies in library that haven't been added yet
      for (const movie of lib?.movies || []) {
        const alreadyInWatched = currentWatched.some(
          (w) => w.id === movie.id || (w.title && w.title.toLowerCase() === movie.title?.toLowerCase())
        );
        const p = prog?.[movie.filePath];
        const isMovieDone = p && (p.completed || p.percentage >= 88 || (p.duration > 0 && p.currentTime / p.duration >= 0.88) || (p.duration > 300 && p.duration - p.currentTime <= 180));
        if (!alreadyInWatched && isMovieDone) {
          await (window as any).electronAPI.saveWatchedShow({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            year: movie.year || null,
            poster: movie.poster || null,
            backdrop: movie.backdrop || null,
            banner: movie.backdrop || movie.poster || null,
            overview: movie.overview || '',
            genres: movie.genres || [],
            totalSeasons: null,
            totalEpisodes: 1
          });
          hasNewAutoWatched = true;
        }
      }

      if (hasNewAutoWatched) {
        currentWatched = (await (window as any).electronAPI.getWatchedShows()) || [];
      }

      setWatchedShows(currentWatched);

      // Auto scan on startup if library is empty
      if (!lib || (!lib.movies?.length && !lib.series?.length && !lib.anime?.length)) {
        rescan();
      }
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const rescan = useCallback(async (options?: { showsOnly?: boolean; type?: 'all' | 'shows' }) => {
    if (!isElectron || scanning) return;
    setScanning(true);
    const isShows = Boolean(options && (options.showsOnly || options.type === 'shows'));
    setScanStatus(isShows ? 'Scanning for new shows...' : 'Starting full library scan...');

    try {
      const result = await (window as any).electronAPI.scanLibrary(options);
      setLibrary(result);
      const updatedProg = await (window as any).electronAPI.getAllProgress();
      setProgressMap(updatedProg);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
      setScanStatus('');
    }
  }, [scanning]);

  const scanNewShows = useCallback(async () => {
    return rescan({ showsOnly: true, type: 'shows' });
  }, [rescan]);

  useEffect(() => {
    loadData();

    if (isElectron) {
      const unsubscribe = (window as any).electronAPI.onScanProgress((prog: any) => {
        setScanStatus(`${prog.phase || 'Scanning'}: ${prog.currentFile || ''}`);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [loadData]);

  const updateProgress = useCallback(async (filePath: string, current: number, total: number) => {
    if (!isElectron) return;
    // Credit threshold: credits typically start at >= 88% or within final 180s (3m) of an episode
    const isNearEnd = (total > 0 && current / total >= 0.88) || (total > 300 && total - current <= 180);
    const completed = isNearEnd || (total > 0 && current / total >= 0.88);
    const updated = await (window as any).electronAPI.saveProgress(filePath, {
      currentTime: current,
      duration: total,
      completed
    });
    setProgressMap(prev => {
      const nextMap = { ...prev, [filePath]: updated };

      // Check if this completed an entire series or movie
      if (completed) {
        // Check movies
        const matchedMovie = library.movies?.find((m) => m.filePath === filePath);
        if (matchedMovie) {
          (window as any).electronAPI.saveWatchedShow({
            id: matchedMovie.id,
            type: 'movie',
            title: matchedMovie.title,
            year: matchedMovie.year || null,
            poster: matchedMovie.poster || null,
            backdrop: matchedMovie.backdrop || null,
            banner: matchedMovie.backdrop || matchedMovie.poster || null,
            overview: matchedMovie.overview || '',
            genres: matchedMovie.genres || [],
            totalSeasons: null,
            totalEpisodes: 1
          }).then(() => {
            (window as any).electronAPI.getWatchedShows().then((wList: WatchedShowItem[]) => {
              if (wList) setWatchedShows(wList);
            });
          });
        }

        // Check series
        const allShows: SeriesItem[] = [...library.series, ...(library.anime || [])];
        for (const show of allShows) {
          const eps = getAllSeriesEpisodes(show);
          const hasThisEp = eps.some((e) => e.filePath === filePath);
          if (hasThisEp && isSeriesFullyWatched(show, nextMap)) {
            (window as any).electronAPI.saveWatchedShow({
              id: show.id,
              type: 'series',
              title: show.title,
              year: show.year || null,
              poster: show.poster || null,
              backdrop: show.backdrop || null,
              banner: show.backdrop || show.poster || null,
              overview: show.overview || '',
              genres: show.genres || [],
              totalSeasons: Object.keys(show.seasons || {}).length || 1,
              totalEpisodes: eps.length || 1
            }).then(() => {
              (window as any).electronAPI.getWatchedShows().then((wList: WatchedShowItem[]) => {
                if (wList) setWatchedShows(wList);
              });
            });
            break;
          }
        }
      }

      return nextMap;
    });
  }, [library]);

  const markShowAsWatched = useCallback(async (item: MediaItem | WatchedShowItem, rating?: number | null) => {
    if (!isElectron) return;
    const isSeries = 'seasons' in item;
    const isMovie = item.type === 'movie' || (!isSeries && !(item as any).totalSeasons);
    const totalSeasons = isSeries ? Object.keys((item as SeriesItem).seasons || {}).length : ((item as WatchedShowItem).totalSeasons || null);
    let totalEpisodes = 1;
    if (isSeries) {
      totalEpisodes = getAllSeriesEpisodes(item as SeriesItem).length;
    } else if ((item as WatchedShowItem).totalEpisodes) {
      totalEpisodes = (item as WatchedShowItem).totalEpisodes || 1;
    }

    const payload: any = {
      id: item.id,
      type: isMovie ? 'movie' : 'series',
      title: item.title,
      year: item.year || null,
      poster: item.poster || null,
      backdrop: item.backdrop || (item as any).banner || null,
      banner: (item as any).banner || item.backdrop || item.poster || null,
      overview: item.overview || '',
      genres: item.genres || [],
      totalSeasons: isMovie ? null : totalSeasons,
      totalEpisodes: isMovie ? 1 : totalEpisodes
    };
    if (rating !== undefined) {
      payload.rating = rating;
    }

    await (window as any).electronAPI.saveWatchedShow(payload);
    const updatedList = await (window as any).electronAPI.getWatchedShows();
    setWatchedShows(updatedList || []);

    // Also mark its episodes or movie as completed locally so continue-watching cleans up
    if (isSeries) {
      const eps = getAllSeriesEpisodes(item as SeriesItem);
      for (const ep of eps) {
        const dur = ep.duration || 1800;
        await (window as any).electronAPI.saveProgress(ep.filePath, {
          currentTime: dur,
          duration: dur,
          completed: true
        });
      }
      const updatedProg = await (window as any).electronAPI.getAllProgress();
      setProgressMap(updatedProg || {});
    } else if (isMovie && (item as any).filePath) {
      const dur = (item as any).runtime ? (item as any).runtime * 60 : 7200;
      await (window as any).electronAPI.saveProgress((item as any).filePath, {
        currentTime: dur,
        duration: dur,
        completed: true
      });
      const updatedProg = await (window as any).electronAPI.getAllProgress();
      setProgressMap(updatedProg || {});
    }
  }, []);

  const setWatchedRating = useCallback(async (id: string, rating: number | null) => {
    if (!isElectron) return;
    await (window as any).electronAPI.setWatchedRating(id, rating);
    const updatedList = await (window as any).electronAPI.getWatchedShows();
    setWatchedShows(updatedList || []);
  }, []);

  const removeWatchedShow = useCallback(async (id: string) => {
    if (!isElectron) return;
    await (window as any).electronAPI.removeWatchedShow(id);
    const updatedList = await (window as any).electronAPI.getWatchedShows();
    setWatchedShows(updatedList || []);
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<Settings>) => {
    if (!isElectron) return;
    const saved = await (window as any).electronAPI.saveSettings(newSettings);
    setSettings(saved);
  }, []);

  return {
    library,
    progressMap,
    watchedShows,
    settings,
    scanning,
    scanStatus,
    loading,
    rescan,
    scanNewShows,
    updateProgress,
    markShowAsWatched,
    setWatchedRating,
    removeWatchedShow,
    saveSettings
  };
}
