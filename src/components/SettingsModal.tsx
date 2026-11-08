import React, { useState, useEffect } from 'react';
import { X, Save, FileText, CheckCircle, AlertTriangle, Copy, Check, RefreshCw, Download } from 'lucide-react';
import { Settings, ScanReport } from '../types/media';

interface SettingsModalProps {
  settings: Settings | null;
  onClose: () => void;
  onSave: (settings: Partial<Settings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'report'>('settings');
  const [movieDirs, setMovieDirs] = useState<string>(
    settings?.movieDirs ? settings.movieDirs.join('\n') : ''
  );
  const [seriesDirs, setSeriesDirs] = useState<string>(
    settings?.seriesDirs ? settings.seriesDirs.join('\n') : ''
  );
  const [animeDirs, setAnimeDirs] = useState<string>(
    settings?.animeDirs ? settings.animeDirs.join('\n') : 'D:\\Movies & Series\\Anime'
  );
  const [thumbDir, setThumbDir] = useState<string>(
    settings?.thumbnailCacheDir || ''
  );
  const [tmdbKey, setTmdbKey] = useState<string>(
    settings?.tmdbApiKey || ''
  );
  const [extPlayer, setExtPlayer] = useState<string>(
    settings?.externalPlayerPath || 'vlc'
  );
  const [miniShortcut, setMiniShortcut] = useState<string>(
    settings?.miniPlayerShortcut || 'CommandOrControl+M'
  );
  const [miniSize, setMiniSize] = useState<'S' | 'M' | 'L'>(
    settings?.miniPlayerSize || 'M'
  );
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(
    settings?.autoPlayNext ?? true
  );
  const [openInExternal, setOpenInExternal] = useState<boolean>(
    settings?.openInExternalPlayer ?? false
  );

  // Sync state whenever settings prop updates
  useEffect(() => {
    if (settings) {
      setMovieDirs(settings.movieDirs ? settings.movieDirs.join('\n') : '');
      setSeriesDirs(settings.seriesDirs ? settings.seriesDirs.join('\n') : '');
      setAnimeDirs(settings.animeDirs ? settings.animeDirs.join('\n') : 'D:\\Movies & Series\\Anime');
      setThumbDir(settings.thumbnailCacheDir || '');
      setTmdbKey(settings.tmdbApiKey || '');
      setExtPlayer(settings.externalPlayerPath || 'vlc');
      setMiniShortcut(settings.miniPlayerShortcut || 'CommandOrControl+M');
      setMiniSize(settings.miniPlayerSize || 'M');
      setAutoPlayNext(settings.autoPlayNext ?? true);
      setOpenInExternal(settings.openInExternalPlayer ?? false);
    }
  }, [settings]);

  // Auto-updater state
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode';
    version?: string;
    percent?: number;
    message?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const api = (window as any).electronAPI;
      if (api.getAppVersion) {
        api.getAppVersion().then((v: string) => {
          if (v) setAppVersion(v);
        }).catch(() => {});
      }
      if (api.onUpdaterStatus) {
        const cleanup = api.onUpdaterStatus((data: any) => {
          if (data) {
            setUpdateStatus(data);
            if (data.status !== 'checking') {
              setIsCheckingUpdate(false);
            }
          }
        });
        return cleanup;
      }
    }
  }, []);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus({ status: 'checking' });
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.checkForUpdates) {
        const res = await (window as any).electronAPI.checkForUpdates();
        if (res && res.status === 'dev-mode') {
          setUpdateStatus({ status: 'dev-mode', message: res.message });
          setIsCheckingUpdate(false);
        } else if (res && res.status === 'error') {
          setUpdateStatus({ status: 'error', message: res.message });
          setIsCheckingUpdate(false);
        }
      }
    } catch (err: any) {
      setUpdateStatus({ status: 'error', message: err?.message || 'Check failed' });
      setIsCheckingUpdate(false);
    }
  };

  const handleQuitAndInstall = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.quitAndInstallUpdate) {
      (window as any).electronAPI.quitAndInstallUpdate();
    }
  };

  // Scan Report state
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [reportFilter, setReportFilter] = useState('');
  const [reportTab, setReportTab] = useState<'parsed' | 'skipped'>('parsed');
  const [copied, setCopied] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (activeTab === 'report') {
      loadReport();
    }
  }, [activeTab]);

  const loadReport = async () => {
    setLoadingReport(true);
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getScanReport) {
        const report = await (window as any).electronAPI.getScanReport();
        setScanReport(report);
      }
    } catch (e) {
      console.error('Failed to load scan report:', e);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      movieDirs: movieDirs.split('\n').map((s) => s.trim()).filter(Boolean),
      seriesDirs: seriesDirs.split('\n').map((s) => s.trim()).filter(Boolean),
      animeDirs: animeDirs.split('\n').map((s) => s.trim()).filter(Boolean),
      thumbnailCacheDir: thumbDir.trim(),
      tmdbApiKey: tmdbKey.trim(),
      externalPlayerPath: extPlayer.trim(),
      miniPlayerShortcut: miniShortcut.trim() || 'CommandOrControl+M',
      miniPlayerSize: miniSize,
      autoPlayNext,
      openInExternalPlayer: openInExternal
    });
    onClose();
  };

  const handleCopyReport = () => {
    if (!scanReport) return;
    const lines: string[] = [];
    lines.push(`# NetFlixxy Scan Report`);
    lines.push(`Generated: ${scanReport.generatedAt || 'N/A'}`);
    lines.push(`Total Parsed Videos: ${scanReport.totalVideos}`);
    lines.push(`Total Skipped Files: ${scanReport.totalSkipped}`);
    lines.push('');
    lines.push(`## Parsed Files (${scanReport.parsedFiles?.length || 0})`);
    scanReport.parsedFiles?.forEach((f, idx) => {
      lines.push(`${idx + 1}. [${f.category.toUpperCase()}] ${f.title} ${f.season !== null ? `S${f.season}` : ''}${f.episode !== null ? `E${f.episode}` : ''} | Path: ${f.filePath}`);
    });
    lines.push('');
    lines.push(`## Skipped Files (${scanReport.skippedFiles?.length || 0})`);
    scanReport.skippedFiles?.forEach((f, idx) => {
      lines.push(`${idx + 1}. Reason: ${f.reason} | Path: ${f.filePath}`);
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredParsed = (scanReport?.parsedFiles || []).filter((f) => {
    if (!reportFilter) return true;
    const q = reportFilter.toLowerCase();
    return f.title.toLowerCase().includes(q) || f.filePath.toLowerCase().includes(q);
  });

  const filteredSkipped = (scanReport?.skippedFiles || []).filter((f) => {
    if (!reportFilter) return true;
    const q = reportFilter.toLowerCase();
    return f.reason.toLowerCase().includes(q) || f.filePath.toLowerCase().includes(q);
  });

  // Escape key handler: closes SettingsModal first
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc, true);
    window.addEventListener('keydown', handleEsc, true);
    return () => {
      document.removeEventListener('keydown', handleEsc, true);
      window.removeEventListener('keydown', handleEsc, true);
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 9999,
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: activeTab === 'report' ? '900px' : '640px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 28px',
          transition: 'max-width 0.2s ease'
        }}
      >
        {/* Header with Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Library Settings</h2>
            <div style={{ display: 'flex', background: '#222', borderRadius: '6px', padding: '3px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'settings' ? '#e50914' : 'transparent',
                  color: '#fff',
                  transition: 'background 0.2s'
                }}
              >
                Folders & Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'report' ? '#e50914' : 'transparent',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
              >
                <FileText size={14} />
                <span>Scan Report</span>
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Tab 1: Settings Form */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', paddingRight: '4px' }}>
            {/* Movie Folders */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bbb', marginBottom: '6px' }}>
                Movie Folders (one per line)
              </label>
              <textarea
                rows={2}
                value={movieDirs}
                onChange={(e) => setMovieDirs(e.target.value)}
                placeholder="D:\Movies & Series\Movies"
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            {/* TV Series Folders */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bbb', marginBottom: '6px' }}>
                TV Series Folders (one per line)
              </label>
              <textarea
                rows={2}
                value={seriesDirs}
                onChange={(e) => setSeriesDirs(e.target.value)}
                placeholder="D:\Movies & Series\Series"
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            {/* Anime Folders */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e50914', marginBottom: '6px' }}>
                Anime Folders (one per line - scanned recursively)
              </label>
              <textarea
                rows={2}
                value={animeDirs}
                onChange={(e) => setAnimeDirs(e.target.value)}
                placeholder="D:\Movies & Series\Anime"
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            {/* Thumbnail Cache Dir */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bbb', marginBottom: '6px' }}>
                Thumbnail Cache Folder
              </label>
              <input
                type="text"
                value={thumbDir}
                onChange={(e) => setThumbDir(e.target.value)}
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* External Player Command */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bbb', marginBottom: '6px' }}>
                External Player Executable Name or Path
              </label>
              <input
                type="text"
                value={extPlayer}
                onChange={(e) => setExtPlayer(e.target.value)}
                placeholder="vlc or mpv or C:\Program Files\VideoLAN\VLC\vlc.exe"
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* TMDB API Key */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bbb', marginBottom: '6px' }}>
                Optional TMDB API Key (Fetches & caches metadata when online)
              </label>
              <input
                type="password"
                value={tmdbKey}
                onChange={(e) => setTmdbKey(e.target.value)}
                placeholder="Enter TMDB v3 API Key"
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* Mini Player Shortcut */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bbb', marginBottom: '6px' }}>
                Mini Player Global Shortcut (e.g. CommandOrControl+M, Alt+M)
              </label>
              <input
                type="text"
                value={miniShortcut}
                onChange={(e) => setMiniShortcut(e.target.value)}
                placeholder="CommandOrControl+M"
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* Mini Player Size */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bbb', marginBottom: '6px' }}>
                Mini Player Default Size
              </label>
              <select
                value={miniSize}
                onChange={(e) => setMiniSize(e.target.value as 'S' | 'M' | 'L')}
                style={{
                  width: '100%',
                  background: '#242424',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <option value="S">Small (360 × 202)</option>
                <option value="M">Medium (480 × 270)</option>
                <option value="L">Large (640 × 360)</option>
              </select>
            </div>

            {/* Playback Preferences */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#ddd' }}>
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  style={{ accentColor: '#e50914', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Auto-play next episode when countdown finishes</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#ddd' }}>
                <input
                  type="checkbox"
                  checked={openInExternal}
                  onChange={(e) => setOpenInExternal(e.target.checked)}
                  style={{ accentColor: '#e50914', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Open videos directly in External Player (VLC / MPV)</span>
              </label>
            </div>

            {/* Software Updates */}
            <div style={{ marginTop: '16px', padding: '16px', background: '#1c1c1c', borderRadius: '6px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#fff' }}>Software Updates</h3>
                    <span style={{ fontSize: '11px', background: '#2c2c2c', padding: '2px 8px', borderRadius: '10px', color: '#aaa', border: '1px solid #444' }}>
                      v{appVersion}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: updateStatus.status === 'error' ? '#e50914' : updateStatus.status === 'downloaded' ? '#46d369' : '#888', margin: '4px 0 0' }}>
                    {updateStatus.status === 'idle' && 'Check GitHub Releases for new updates'}
                    {updateStatus.status === 'checking' && 'Checking for updates...'}
                    {updateStatus.status === 'available' && `New update v${updateStatus.version || ''} available! Downloading...`}
                    {updateStatus.status === 'downloading' && `Downloading update: ${updateStatus.percent || 0}%`}
                    {updateStatus.status === 'downloaded' && `Update v${updateStatus.version || ''} downloaded and ready to install!`}
                    {updateStatus.status === 'not-available' && 'You are already on the latest version.'}
                    {updateStatus.status === 'dev-mode' && (updateStatus.message || 'Development mode')}
                    {updateStatus.status === 'error' && (updateStatus.message || 'Update check failed')}
                  </p>
                </div>

                {updateStatus.status === 'downloaded' ? (
                  <button
                    type="button"
                    onClick={handleQuitAndInstall}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '4px',
                      border: 'none',
                      background: '#46d369',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} />
                    Restart & Update
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate || updateStatus.status === 'downloading'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '4px',
                      border: '1px solid #555',
                      background: isCheckingUpdate ? '#333' : '#282828',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: isCheckingUpdate ? 'wait' : 'pointer',
                      opacity: isCheckingUpdate ? 0.7 : 1
                    }}
                  >
                    <RefreshCw size={13} style={{ animation: isCheckingUpdate ? 'spin 1s linear infinite' : 'none' }} />
                    {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                  </button>
                )}
              </div>

              {/* Progress bar when downloading */}
              {updateStatus.status === 'downloading' && (
                <div style={{ marginTop: '12px', background: '#333', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${updateStatus.percent || 0}%`,
                      height: '100%',
                      background: '#e50914',
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid #555',
                  color: '#ddd',
                  padding: '8px 18px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  background: '#e50914',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 22px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Save size={16} />
                <span>Save Settings</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Scan Report */}
        {activeTab === 'report' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '16px' }}>
            {/* Top Bar Summary & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ background: '#1c361e', border: '1px solid #2e7d32', padding: '6px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} color="#4caf50" />
                  <span style={{ fontSize: '13px', color: '#c8e6c9', fontWeight: 600 }}>
                    Parsed Videos: <strong>{scanReport?.totalVideos || 0}</strong>
                  </span>
                </div>
                <div style={{ background: '#3b2219', border: '1px solid #b71c1c', padding: '6px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} color="#ff5252" />
                  <span style={{ fontSize: '13px', color: '#ffcdd2', fontWeight: 600 }}>
                    Skipped Files: <strong>{scanReport?.totalSkipped || 0}</strong>
                  </span>
                </div>
                {scanReport?.generatedAt && (
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    Scanned: {new Date(scanReport.generatedAt).toLocaleString()}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={loadReport}
                  title="Reload Report"
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    color: '#ddd',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px'
                  }}
                >
                  <RefreshCw size={14} className={loadingReport ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  style={{
                    background: copied ? '#2e7d32' : '#e50914',
                    border: 'none',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied Report!' : 'Copy Report'}</span>
                </button>
              </div>
            </div>

            {/* Filter and Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReportTab('parsed')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: reportTab === 'parsed' ? '#333' : 'transparent',
                    color: reportTab === 'parsed' ? '#fff' : '#888'
                  }}
                >
                  Parsed Videos ({scanReport?.parsedFiles?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setReportTab('skipped')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: reportTab === 'skipped' ? '#333' : 'transparent',
                    color: reportTab === 'skipped' ? '#fff' : '#888'
                  }}
                >
                  Skipped Files ({scanReport?.skippedFiles?.length || 0})
                </button>
              </div>

              <input
                type="text"
                placeholder="Search file path or title..."
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value)}
                style={{
                  background: '#222',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '5px 10px',
                  fontSize: '12px',
                  width: '240px'
                }}
              />
            </div>

            {/* Report Content Table */}
            <div style={{ flex: 1, minHeight: '320px', maxHeight: '480px', overflowY: 'auto', background: '#191919', border: '1px solid #333', borderRadius: '6px' }}>
              {reportTab === 'parsed' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#222', color: '#aaa', textAlign: 'left', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', width: '80px' }}>Category</th>
                      <th style={{ padding: '8px 12px' }}>Title</th>
                      <th style={{ padding: '8px 12px', width: '90px' }}>Season/Ep</th>
                      <th style={{ padding: '8px 12px', width: '70px' }}>Res</th>
                      <th style={{ padding: '8px 12px', width: '130px' }}>Poster Source</th>
                      <th style={{ padding: '8px 12px', width: '120px' }}>Metadata Source</th>
                      <th style={{ padding: '8px 12px' }}>File Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParsed.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#777' }}>
                          No parsed files found. Click "Rescan" in the top bar to scan your library.
                        </td>
                      </tr>
                    ) : (
                      filteredParsed.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #282828', background: index % 2 === 0 ? '#191919' : '#1e1e1e' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: item.category === 'anime' ? '#6200ea' : item.category === 'movie' ? '#00695c' : '#1565c0',
                              color: '#fff'
                            }}>
                              {item.category}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#fff' }}>{item.title}</td>
                          <td style={{ padding: '8px 12px', color: '#bbb' }}>
                            {item.season !== null ? `S${item.season} ` : ''}
                            {item.episode !== null ? `E${item.episode}` : '-'}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#888' }}>{item.resolution || '-'}</td>
                          <td style={{ padding: '8px 12px', color: '#aaa', fontSize: '11px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: '#282828',
                              color: item.posterSource?.startsWith('Local') ? '#4caf50' : item.posterSource && item.posterSource !== 'None' ? '#2196f3' : '#777'
                            }}>
                              {item.posterSource || 'None'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#aaa', fontSize: '11px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: '#282828',
                              color: item.metadataSource === 'TMDB' || item.metadataSource === 'Cinemeta' ? '#00e676' : '#bbb'
                            }}>
                              {item.metadataSource || 'Local file'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#999', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                            {item.filePath}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#222', color: '#aaa', textAlign: 'left', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', width: '220px' }}>Skip Reason</th>
                      <th style={{ padding: '8px 12px' }}>File Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSkipped.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ padding: '24px', textAlign: 'center', color: '#777' }}>
                          No skipped files recorded.
                        </td>
                      </tr>
                    ) : (
                      filteredSkipped.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #282828', background: index % 2 === 0 ? '#191919' : '#1e1e1e' }}>
                          <td style={{ padding: '8px 12px', color: '#ff8a80', fontWeight: 600 }}>
                            {item.reason}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#aaa', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                            {item.filePath}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
