import { app, BrowserWindow, ipcMain, Menu, globalShortcut, screen, shell, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { exec } from 'child_process';
import { Store } from './db/store.js';
import { scanLibrary } from './scanner/scanner.js';
import { generateThumbnail, pauseThumbnails, resumeThumbnails } from './scanner/thumbnails.js';
import { startStreamServer, setPhoneMode, getPhoneModeStatus, getLanIp } from './streaming/stream-server.js';
import { previewGenerator, hasPreviewFrames } from './scanner/preview-generator.js';

const require = createRequire(import.meta.url);
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { autoUpdater } = require('electron-updater');

const APP_ID = 'com.netflixxy.player';
const APP_NAME = 'NetFlixxy';

app.name = APP_NAME;
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let miniPlayerWindow = null;
let streamServer = null;
let miniPlayerInitData = null;
let isQuitting = false;
let isRightAltHeld = false;
let miniPlayerOpenedBy = null; // 'ctrl_m' | 'alt' | null

// Single instance lock to prevent duplicate apps binding port 39281
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('[Main] Another instance of NetFlixxy is already running. Exiting duplicate instance.');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

// Remove global menu bar
Menu.setApplicationMenu(null);

function getAppIconPath() {
  const candidateIconPaths = [
    path.join(__dirname, 'assets/icon.ico'),
    path.join(__dirname, '../build/icon.ico'),
    path.join(process.cwd(), 'build/icon.ico'),
    path.join(__dirname, '../assets/icon.ico'),
    path.join(process.cwd(), 'assets/icon.ico'),
    path.join(__dirname, 'assets/icon.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(process.cwd(), 'build/icon.png')
  ];
  return candidateIconPaths.find(p => fs.existsSync(p)) || path.join(__dirname, 'assets', 'icon.ico');
}

function getAppIcon() {
  const iconPath = getAppIconPath();
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  } catch {}
  return iconPath;
}

function setupWindowsShortcuts() {
  if (process.platform !== 'win32' || app.isPackaged) return;

  try {
    const iconPath = getAppIconPath();
    const projectRoot = path.resolve(__dirname, '..');
    const startMenuDir = path.join(
      app.getPath('appData'),
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs'
    );
    const startMenuShortcut = path.join(startMenuDir, 'NetFlixxy.lnk');
    const desktopShortcut = path.join(app.getPath('desktop'), 'NetFlixxy.lnk');

    const shortcutOptions = {
      target: process.execPath,
      args: app.isPackaged ? '' : `"${projectRoot}"`,
      cwd: projectRoot,
      icon: iconPath || path.join(projectRoot, 'build', 'icon.ico'),
      iconIndex: 0,
      appUserModelId: APP_ID,
      description: 'NetFlixxy'
    };

    shell.writeShortcutLink(startMenuShortcut, fs.existsSync(startMenuShortcut) ? 'replace' : 'create', shortcutOptions);
    shell.writeShortcutLink(desktopShortcut, fs.existsSync(desktopShortcut) ? 'replace' : 'create', shortcutOptions);
  } catch (err) {
    console.warn('[Main] Failed to setup Windows shortcuts:', err);
  }
}

function createWindow() {
  const windowIcon = getAppIcon();

  mainWindow = new BrowserWindow({
    show: false,
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 650,
    backgroundColor: '#141414',
    title: 'NetFlixxy',
    icon: windowIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow streaming localhost media
    }
  });

  if (windowIcon) {
    mainWindow.setIcon(windowIcon);
  }

  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  // Maximize before showing so it does not flash at the initial small size
  mainWindow.maximize();
  mainWindow.show();

  // Load app: either Vite dev server or local production stream/web server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL('http://127.0.0.1:39281');
  }

  // F12 or Ctrl+Shift+I toggles DevTools, prevent bare Alt from activating menu bar
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      return;
    }
    if (input.key === 'Alt' && !input.control && !input.shift && !input.meta) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`Page failed to load (${errorCode}: ${errorDescription})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
      miniPlayerWindow.close();
      miniPlayerWindow = null;
    }
    if (!isQuitting) {
      isQuitting = true;
      try {
        uIOhook.stop();
      } catch {}
      if (streamServer) {
        try {
          streamServer.close();
        } catch {}
      }
      app.quit();
      process.exit(0);
    }
  });
}

function openMiniPlayer(data) {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.close();
    miniPlayerWindow = null;
  }

  miniPlayerInitData = data;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }

  const settings = Store.getSettings();
  const defaultWidth = 480;
  let width = settings.miniPlayerBounds?.width || defaultWidth;
  let height = settings.miniPlayerBounds?.height || Math.round(width * (9 / 16));

  const cursorPoint = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const workArea = currentDisplay.workArea;

  let x = settings.miniPlayerBounds?.x;
  let y = settings.miniPlayerBounds?.y;

  if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
    x = workArea.x + workArea.width - width - 24;
    y = workArea.y + workArea.height - height - 24;
  } else {
    // Keep fully on screen if display changed
    x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - width, x));
    y = Math.max(workArea.y, Math.min(workArea.y + workArea.height - height, y));
  }

  miniPlayerWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 240,
    minHeight: 135,
    title: 'NetFlixxy',
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#000000',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  const miniIcon = getAppIcon();
  if (miniIcon) {
    miniPlayerWindow.setIcon(miniIcon);
  }

  miniPlayerWindow.setAlwaysOnTop(true, 'screen-saver');
  miniPlayerWindow.setVisibleOnAllWorkspaces(true);
  miniPlayerWindow.setAspectRatio(16 / 9);
  miniPlayerWindow.on('will-resize', (_event, newBounds) => {
    newBounds.height = Math.round(newBounds.width * (9 / 16));
  });
  miniPlayerWindow.removeMenu();

  let saveBoundsTimeout = null;
  const debouncedSaveBounds = () => {
    if (saveBoundsTimeout) clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(() => {
      if (!miniPlayerWindow || miniPlayerWindow.isDestroyed()) return;
      const b = miniPlayerWindow.getBounds();
      const curr = Store.getSettings();
      Store.saveSettings({
        ...curr,
        miniPlayerBounds: b
      });
    }, 500);
  };

  miniPlayerWindow.on('resize', debouncedSaveBounds);
  miniPlayerWindow.on('move', debouncedSaveBounds);

  const clampToDisplay = () => {
    if (!miniPlayerWindow || miniPlayerWindow.isDestroyed()) return;
    const b = miniPlayerWindow.getBounds();
    const currentDisplay = screen.getDisplayMatching(b);
    const workArea = currentDisplay.workArea;
    const clampedX = Math.max(workArea.x, Math.min(workArea.x + workArea.width - b.width, b.x));
    const clampedY = Math.max(workArea.y, Math.min(workArea.y + workArea.height - b.height, b.y));
    if (clampedX !== b.x || clampedY !== b.y) {
      miniPlayerWindow.setPosition(clampedX, clampedY);
    }
  };

  screen.on('display-metrics-changed', clampToDisplay);
  screen.on('display-removed', clampToDisplay);

  miniPlayerWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      miniPlayerWindow.webContents.toggleDevTools();
      return;
    }
    if (input.key === 'Alt' && !input.control && !input.shift && !input.meta) {
      event.preventDefault();
    }
  });

  miniPlayerWindow.on('close', () => {
    if (saveBoundsTimeout) {
      clearTimeout(saveBoundsTimeout);
    }
    if (!miniPlayerWindow.isDestroyed()) {
      const b = miniPlayerWindow.getBounds();
      const curr = Store.getSettings();
      Store.saveSettings({
        ...curr,
        miniPlayerBounds: b
      });
    }
    if (isQuitting) return;
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('mini:resumeMain', {
        currentTime: miniPlayerInitData?.currentTime || 0,
        isPlaying: false
      });
    }
  });

  miniPlayerWindow.on('closed', () => {
    screen.removeListener('display-metrics-changed', clampToDisplay);
    screen.removeListener('display-removed', clampToDisplay);
    miniPlayerWindow = null;
  });

  // Load mini player route
  const targetUrl = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}#/mini`
    : `http://127.0.0.1:39281/#/mini`;

  miniPlayerWindow.loadURL(targetUrl);
}

function registerMiniShortcut() {
  globalShortcut.unregisterAll();
  const settings = Store.getSettings();
  const shortcut = settings.miniPlayerShortcut || 'CommandOrControl+M';

  try {
    globalShortcut.register(shortcut, () => {
      if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
        miniPlayerOpenedBy = null; // Ctrl+M requested close
        // Send close & resume to main
        if (miniPlayerWindow.webContents) {
          miniPlayerWindow.webContents.send('mini:requestClose');
        }
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        miniPlayerOpenedBy = 'ctrl_m'; // Ctrl+M requested open
        mainWindow.webContents.send('mini:toggleGlobal');
      }
    });
  } catch (err) {
    console.warn(`Failed to register global shortcut ${shortcut}:`, err);
  }
}

function setupGlobalHooks() {
  uIOhook.on('keydown', (e) => {
    // Log keycode on each press so we can confirm which code is Right Alt on this keyboard
    console.log(`[uIOhook] keydown code: ${e.keycode}`);

    // Only Right Alt counts (3640 / UiohookKey.AltRight), NOT Left Alt (56)
    if (e.keycode === UiohookKey.AltRight || e.keycode === 3640) {
      if (isRightAltHeld) return; // Ignore auto-repeat keydowns while key is held
      isRightAltHeld = true;

      if (!miniPlayerWindow || miniPlayerWindow.isDestroyed()) {
        miniPlayerOpenedBy = 'alt';
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mini:toggleGlobal');
        }
      }
    }
  });

  uIOhook.on('keyup', (e) => {
    console.log(`[uIOhook] keyup code: ${e.keycode}`);

    if (e.keycode === UiohookKey.AltRight || e.keycode === 3640) {
      isRightAltHeld = false;

      // If Ctrl+M opened the mini player, releasing Alt doesn't close it. Alt only closes a mini player that Alt opened.
      if (miniPlayerOpenedBy === 'alt') {
        miniPlayerOpenedBy = null;
        if (miniPlayerWindow && !miniPlayerWindow.isDestroyed() && miniPlayerWindow.webContents) {
          miniPlayerWindow.webContents.send('mini:requestClose');
        }
      }
    }
  });

  try {
    uIOhook.start();
  } catch (err) {
    console.warn('[Main] Failed to start uIOhook:', err);
  }
}

// App lifecycle
app.whenReady().then(() => {
  setupWindowsShortcuts();
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_ID);
  }

  // Start local streaming server
  streamServer = startStreamServer(39281);
  const initialSettings = Store.getSettings();
  if (initialSettings.phoneModeEnabled) {
    setPhoneMode(true, initialSettings.phoneModePort || 8080);
  }

  // Setup IPC handlers
  ipcMain.handle('phone-mode:get-status', async () => {
    return getPhoneModeStatus();
  });

  ipcMain.handle('phone-mode:toggle', async (_event, enabled) => {
    const status = setPhoneMode(enabled);
    Store.saveSettings({ phoneModeEnabled: !!enabled });
    return status;
  });

  ipcMain.handle('library:get', async () => {
    return Store.getLibrary();
  });

  ipcMain.handle('library:scanReport', async () => {
    return Store.getScanReport();
  });

  ipcMain.handle('library:scan', async () => {
    const settings = Store.getSettings();
    const result = await scanLibrary(settings, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan:progress', progress);
      }
    });
    Store.saveLibrary(result);
    // Queue preview frame generation in background after library scan
    previewGenerator.enqueueLibrary(result);
    return result;
  });

  ipcMain.handle('settings:get', async () => {
    return Store.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, newSettings) => {
    const saved = Store.saveSettings(newSettings);
    registerMiniShortcut();
    if (newSettings && newSettings.phoneModeEnabled !== undefined) {
      setPhoneMode(newSettings.phoneModeEnabled, saved.phoneModePort || 8080);
    }
    return saved;
  });

  ipcMain.handle('progress:get', async (_event, filePath) => {
    return Store.getProgress(filePath);
  });

  ipcMain.handle('progress:getAll', async () => {
    return Store.getAllProgress();
  });

  ipcMain.handle('progress:save', async (_event, filePath, data) => {
    return Store.saveProgress(filePath, data);
  });

  ipcMain.handle('thumbnail:generate', async (_event, filePath) => {
    return generateThumbnail(filePath);
  });

  ipcMain.handle('player:playbackStatus', async (_event, status) => {
    if (status === 'playing') {
      pauseThumbnails();
      previewGenerator.pauseForPlayback();
    } else {
      resumeThumbnails();
      previewGenerator.resumeAfterPlayback();
    }
    return true;
  });

  ipcMain.handle('player:external', async (_event, filePath) => {
    const settings = Store.getSettings();
    const player = settings.externalPlayerPath || 'vlc';
    exec(`"${player}" "${filePath}"`, (err) => {
      if (err) {
        exec(`start "" "${filePath}"`);
      }
    });
    return true;
  });

  // Preview frames IPC
  ipcMain.handle('preview:hasFrames', async (_event, videoId) => {
    return hasPreviewFrames(videoId);
  });

  // Mini player IPC
  ipcMain.handle('mini:open', async (_event, data) => {
    if (miniPlayerOpenedBy !== 'alt') {
      miniPlayerOpenedBy = 'ctrl_m';
    }
    openMiniPlayer(data);
    return true;
  });

  // Volume sync IPC between main window and mini player
  ipcMain.handle('volume:sync', async (event, volData) => {
    if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
      mainWindow.webContents.send('volume:update', volData);
    }
    if (miniPlayerWindow && !miniPlayerWindow.isDestroyed() && event.sender !== miniPlayerWindow.webContents) {
      miniPlayerWindow.webContents.send('volume:update', volData);
    }
    if (volData && typeof volData.volume === 'number') {
      const curr = Store.getSettings();
      Store.saveSettings({
        volume: volData.volume,
        isMuted: !!volData.isMuted,
        lastNonZeroVolume: volData.volume > 0 ? volData.volume : (curr.lastNonZeroVolume ?? 0.5)
      });
    }
    return true;
  });

  ipcMain.handle('mini:close', async (_event, data) => {
    miniPlayerOpenedBy = null;
    isRightAltHeld = false;
    // 1. Close mini window first
    if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
      miniPlayerWindow.removeAllListeners('close');
      miniPlayerWindow.destroy();
      miniPlayerWindow = null;
    }

    // 2. Call mainWindow.show() and focus it
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      // 3. After the main window shows, send resume data
      mainWindow.webContents.send('mini:resumeMain', data);
    }
    return true;
  });

  ipcMain.handle('mini:getInitData', async () => {
    return miniPlayerInitData;
  });

  // Auto-updater IPC handlers
  ipcMain.handle('updater:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      return {
        status: 'dev-mode',
        version: app.getVersion(),
        message: 'Running in development mode. Updates only download in the installed app.'
      };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: 'ok', updateInfo: result?.updateInfo };
    } catch (err) {
      return { status: 'error', message: err.message || 'Check failed' };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) return false;
    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('updater:install', () => {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall();
    }
  });

  // Configure autoUpdater
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { status: 'checking' });
      }
    });

    autoUpdater.on('update-available', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', {
          status: 'available',
          version: info.version,
          releaseDate: info.releaseDate
        });
      }
    });

    autoUpdater.on('update-not-available', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', {
          status: 'not-available',
          version: app.getVersion()
        });
      }
    });

    autoUpdater.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', {
          status: 'error',
          message: err.message || 'Update check failed'
        });
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', {
          status: 'downloading',
          percent: Math.round(progressObj.percent)
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', {
          status: 'downloaded',
          version: info.version
        });
      }
    });
  } catch (err) {
    console.warn('[AutoUpdater] Init error:', err);
  }

  createWindow();
  registerMiniShortcut();
  setupGlobalHooks();

  // Enqueue existing library for background preview frame generation
  try {
    const existingLib = Store.getLibrary();
    previewGenerator.enqueueLibrary(existingLib);
  } catch {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  try {
    uIOhook.stop();
  } catch {}
  if (streamServer) {
    try {
      streamServer.close();
    } catch {}
  }
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.destroy();
    miniPlayerWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  setPhoneMode(false);
  if (streamServer) {
    try {
      streamServer.close();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    try {
      uIOhook.stop();
    } catch {}
    setPhoneMode(false);
    if (streamServer) {
      try {
        streamServer.close();
      } catch {}
    }
    app.quit();
    process.exit(0);
  }
});
