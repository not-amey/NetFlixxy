const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  getScanReport: () => ipcRenderer.invoke('library:scanReport'),
  scanLibrary: () => ipcRenderer.invoke('library:scan'),
  onScanProgress: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('scan:progress', subscription);
    return () => ipcRenderer.removeListener('scan:progress', subscription);
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getProgress: (filePath) => ipcRenderer.invoke('progress:get', filePath),
  getAllProgress: () => ipcRenderer.invoke('progress:getAll'),
  saveProgress: (filePath, data) => ipcRenderer.invoke('progress:save', filePath, data),
  openInExternalPlayer: (filePath) => ipcRenderer.invoke('player:external', filePath),
  generateThumbnail: (filePath) => ipcRenderer.invoke('thumbnail:generate', filePath),
  getStreamUrl: (filePath, start = 0, audio = 0) =>
    `http://127.0.0.1:39281/stream?file=${encodeURIComponent(filePath)}${start > 0 ? `&start=${Math.floor(start)}` : ''}${audio > 0 ? `&audio=${audio}` : ''}`,
  getHlsUrl: (filePath, audio = 0, player = 'main') =>
    `http://127.0.0.1:39281/hls/playlist.m3u8?file=${encodeURIComponent(filePath)}${audio > 0 ? `&audio=${audio}` : ''}&player=${player}`,
  notifyPlaybackStatus: (status) => {
    try {
      fetch(`http://127.0.0.1:39281/playback-status?state=${status}`).catch(() => {});
      ipcRenderer.invoke('player:playbackStatus', status).catch(() => {});
    } catch {}
  },
  getThumbUrl: (filePath) => `http://127.0.0.1:39281/thumb?file=${encodeURIComponent(filePath)}`,
  getSubUrl: (filePath, stream = null) =>
    `http://127.0.0.1:39281/sub?file=${encodeURIComponent(filePath)}${stream !== null && stream !== undefined ? `&stream=${stream}` : ''}`,
  getMediaInfo: (filePath) =>
    fetch(`http://127.0.0.1:39281/info?file=${encodeURIComponent(filePath)}`).then((r) => r.json()),
  
  // Hover preview frames API
  hasPreviewFrames: (videoId) => ipcRenderer.invoke('preview:hasFrames', videoId),
  getPreviewFrameUrl: (videoId, time) =>
    `http://127.0.0.1:39281/preview?id=${encodeURIComponent(videoId)}&time=${encodeURIComponent(time)}`,

  // Mini player IPC APIs
  openMiniPlayer: (data) => ipcRenderer.invoke('mini:open', data),
  closeMiniPlayer: (data) => ipcRenderer.invoke('mini:close', data),
  getMiniInitData: () => ipcRenderer.invoke('mini:getInitData'),
  syncVolume: (volData) => ipcRenderer.invoke('volume:sync', volData),
  onVolumeUpdate: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('volume:update', subscription);
    return () => ipcRenderer.removeListener('volume:update', subscription);
  },
  onMiniCloseResume: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('mini:resumeMain', subscription);
    return () => ipcRenderer.removeListener('mini:resumeMain', subscription);
  },
  onGlobalToggleMini: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('mini:toggleGlobal', subscription);
    return () => ipcRenderer.removeListener('mini:toggleGlobal', subscription);
  },
  onRequestCloseMini: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('mini:requestClose', subscription);
    return () => ipcRenderer.removeListener('mini:requestClose', subscription);
  },

  // Auto-updater API
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppVersion: () => ipcRenderer.invoke('updater:version'),
  onUpdaterStatus: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('updater:status', subscription);
    return () => ipcRenderer.removeListener('updater:status', subscription);
  },

  // Phone Streaming Mode API
  getPhoneModeStatus: () => ipcRenderer.invoke('phone-mode:get-status'),
  refreshPhoneMode: () => ipcRenderer.invoke('phone-mode:refresh'),
  togglePhoneMode: (enabled) => ipcRenderer.invoke('phone-mode:toggle', enabled),
  updatePhoneConfig: (data) => ipcRenderer.invoke('phone-mode:update-config', data)
});
