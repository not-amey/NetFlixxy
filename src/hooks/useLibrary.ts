import { useState, useEffect, useCallback } from 'react';
import { LibraryData, WatchProgress, Settings } from '../types/media';

const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

export function useLibrary() {
  const [library, setLibrary] = useState<LibraryData>({ movies: [], series: [], anime: [], scannedAt: null });
  const [progressMap, setProgressMap] = useState<Record<string, WatchProgress>>({});
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
      const [lib, prog, sets] = await Promise.all([
        (window as any).electronAPI.getLibrary(),
        (window as any).electronAPI.getAllProgress(),
        (window as any).electronAPI.getSettings()
      ]);
      setLibrary(lib || { movies: [], series: [], anime: [], scannedAt: null });
      setProgressMap(prog || {});
      setSettings(sets || null);

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
    const completed = total > 0 && current / total >= 0.95;
    const updated = await (window as any).electronAPI.saveProgress(filePath, {
      currentTime: current,
      duration: total,
      completed
    });
    setProgressMap(prev => ({ ...prev, [filePath]: updated }));
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<Settings>) => {
    if (!isElectron) return;
    const saved = await (window as any).electronAPI.saveSettings(newSettings);
    setSettings(saved);
  }, []);

  return {
    library,
    progressMap,
    settings,
    scanning,
    scanStatus,
    loading,
    rescan,
    scanNewShows,
    updateProgress,
    saveSettings
  };
}
