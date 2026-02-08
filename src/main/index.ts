import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { loadConfig, saveConfigAsync } from './config';
import { writeLog } from './logger';
import { buildFileItems } from './file-items';
import { openFileWithDefaultApp, createAndOpenExcel, deleteFileOrDir } from './file-ops';
import { Config } from '../shared/types';
import { t } from '../shared/i18n';
import {
  CONFIG_FILE_NAME,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  INVALID_FILENAME_CHARS,
} from '../shared/constants';

let mainWindow: BrowserWindow | null = null;

// ---- Window state persistence ----

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT };
  }
}

function saveWindowState(win: BrowserWindow): void {
  const isMaximized = win.isMaximized();
  const bounds = win.getBounds();

  const state: WindowState = {
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  };

  if (!isMaximized) {
    state.x = bounds.x;
    state.y = bounds.y;
  }

  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch {
    // ignore write errors
  }
}

// Application state
interface AppState {
  currentDataDir: string;
  configFilePath: string;
  currentDir: string;
  selectedFile: string;
}

const appState: AppState = {
  currentDataDir: '',
  configFilePath: '',
  currentDir: '',
  selectedFile: '',
};

/** Validate that a relative path stays within the data directory (prevent traversal) */
function isPathSafe(dataDir: string, relativePath: string): boolean {
  const resolved = path.resolve(dataDir, relativePath);
  return resolved.startsWith(dataDir + path.sep) || resolved === dataDir;
}

function createWindow(): void {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    ...(windowState.x !== undefined && windowState.y !== undefined ? { x: windowState.x, y: windowState.y } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'EasyConfig',
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // In dev mode, load from vite dev server; in production, load from dist
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sendNotification(type: 'info' | 'success' | 'error' | 'warning', title: string, message: string): void {
  mainWindow?.webContents.send('notification', { type, title, message });
}

function notifyError(title: string, message: string): void {
  sendNotification('error', title, message);
}

function initializeApp(): void {
  // Determine current directory
  if (app.isPackaged) {
    appState.currentDir = path.dirname(app.getPath('exe'));
    // Handle macOS .app bundle
    if (process.platform === 'darwin') {
      const parentDir = path.dirname(appState.currentDir);
      if (path.basename(parentDir) === 'Contents') {
        appState.currentDir = path.dirname(path.dirname(parentDir));
      }
    }
  } else {
    appState.currentDir = path.resolve(__dirname, '../..');
  }

  appState.configFilePath = path.join(appState.currentDir, CONFIG_FILE_NAME);

  // Load config
  const config = loadConfig(appState.configFilePath);
  if (config.data_directory) {
    appState.currentDataDir = config.data_directory;
    writeLog(appState.currentDir, `Loaded data directory from config: ${appState.currentDataDir}`);
  } else {
    writeLog(appState.currentDir, 'No data directory configured');
  }
}

function registerIpcHandlers(): void {
  // Get config
  ipcMain.handle('get-config', () => {
    return {
      success: true,
      data: {
        data_directory: appState.currentDataDir,
      } as Config,
    };
  });

  // Get file items
  ipcMain.handle('get-file-items', () => {
    const items = buildFileItems(appState.currentDataDir);
    return { success: true, data: items };
  });

  // Set data directory
  ipcMain.handle('set-data-dir', async () => {
    if (!mainWindow) {
      return { success: false, error: t().noActiveWindow };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: t().selectDataDirectory,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }

    const dirPath = result.filePaths[0];
    appState.currentDataDir = dirPath;
    appState.selectedFile = '';

    await saveConfigAsync(appState.configFilePath, { data_directory: dirPath });
    writeLog(appState.currentDir, `Data directory changed to: ${dirPath}`);

    const items = buildFileItems(dirPath);
    return { success: true, data: { dirPath, items } };
  });

  // Unset data directory
  ipcMain.handle('unset-data-dir', async () => {
    appState.currentDataDir = '';
    appState.selectedFile = '';

    await saveConfigAsync(appState.configFilePath, { data_directory: '' });
    writeLog(appState.currentDir, 'Data directory unset');

    return { success: true };
  });

  // Edit file
  ipcMain.handle('edit-file', async (_event, filePath: string) => {
    if (!appState.currentDataDir) {
      return { success: false, error: t().dataDirNotSet };
    }
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: t().noFileSelected };
    }
    if (!isPathSafe(appState.currentDataDir, filePath)) {
      return { success: false, error: t().invalidPath };
    }

    try {
      await openFileWithDefaultApp(appState.currentDataDir, filePath, appState.currentDir, notifyError);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Create file
  ipcMain.handle('create-file', async (_event, req: { name: string; sheetName: string; useTemplate: boolean }) => {
    if (!appState.currentDataDir) {
      return { success: false, error: t().dataDirNotSet };
    }
    if (!req || !req.name || typeof req.name !== 'string') {
      return { success: false, error: t().fileNameEmpty };
    }
    if (INVALID_FILENAME_CHARS.test(req.name)) {
      return { success: false, error: t().fileNameEmpty };
    }
    if (!isPathSafe(appState.currentDataDir, req.name)) {
      return { success: false, error: t().invalidPath };
    }
    if (req.useTemplate && !req.sheetName) {
      return { success: false, error: t().sheetNameRequiredForTemplate };
    }

    try {
      await createAndOpenExcel(
        appState.currentDataDir,
        appState.currentDir,
        req.name,
        req.sheetName,
        req.useTemplate,
        notifyError,
      );

      const items = buildFileItems(appState.currentDataDir);
      return { success: true, data: items };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Delete file
  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    if (!appState.currentDataDir) {
      return { success: false, error: t().dataDirNotSet };
    }
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: t().noFileSelected };
    }
    if (!isPathSafe(appState.currentDataDir, filePath)) {
      return { success: false, error: t().invalidPath };
    }

    // Show confirm dialog
    if (!mainWindow) {
      return { success: false, error: t().noActiveWindow };
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: [t().cancel, t().delete],
      defaultId: 0,
      cancelId: 0,
      title: t().confirmDelete,
      message: t().confirmDeleteMessage(filePath),
    });

    if (result.response === 0) {
      return { success: false, error: 'User cancelled' };
    }

    const deleteResult = deleteFileOrDir(appState.currentDataDir, filePath, appState.currentDir);
    if (!deleteResult.success) {
      return { success: false, error: deleteResult.error };
    }

    const items = buildFileItems(appState.currentDataDir);
    sendNotification('success', t().deleted, t().deletedMessage(filePath));
    return { success: true, data: items };
  });
}

// ---- App lifecycle ----

app.whenReady().then(() => {
  initializeApp();
  registerIpcHandlers();

  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:",
        ],
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ---- Global error handlers ----

process.on('uncaughtException', (error) => {
  writeLog(appState.currentDir, `[FATAL] Uncaught exception: ${error.stack || error.message}`);
  dialog.showErrorBox(t().unexpectedError, t().unexpectedErrorMessage(error.message));
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
  writeLog(appState.currentDir, `[ERROR] Unhandled rejection: ${msg}`);
});
