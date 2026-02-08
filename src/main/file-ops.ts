import { EventEmitter } from 'events';
import { execFile, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { writeLog } from './logger';
import { exportToProtobuf } from './convert/protobuf-exporter';
import { exportToYAML } from './convert/yaml-exporter';
import { getFileToOpen, createTmpFileFromYAML } from './convert/tmp-file-manager';
import { extractExcelInfo, logExcelInfo } from './convert/extractor';
import { validateSheetName, createHeaderTemplate, getDefaultTemplate } from './convert/header-template';
import { t } from '../shared/i18n';
import {
  HEADER_ROW_COUNT,
  XLSX_EXTENSION,
  FILE_SAVE_POLL_INTERVAL,
  FILE_CLOSE_POLL_INTERVAL,
  FILE_CLOSE_TIMEOUT,
  EXPORT_DELAY,
  SAVE_DEBOUNCE_MS,
} from '../shared/constants';

// ---- Types ----

interface FileMonitor {
  sessionId: string;
  abortController: AbortController;
  startTime: Date;
  tmpFilePath: string;
}

interface ExportState {
  lastExportTime: Date | null;
  exportedOnSave: boolean;
  exportedOnClose: boolean;
  fileClosedByUser: boolean;
}

// ---- Global monitor manager ----

class FileMonitorManager {
  private monitors = new Map<string, FileMonitor>();

  register(filePath: string, sessionId: string, abortController: AbortController, tmpFilePath: string): void {
    const existing = this.monitors.get(filePath);
    if (existing) {
      writeLog(
        '',
        `[Monitor Manager] File ${path.basename(filePath)} already monitored by session ${existing.sessionId}, canceling old`,
      );
      existing.abortController.abort();
    }

    this.monitors.set(filePath, {
      sessionId,
      abortController,
      startTime: new Date(),
      tmpFilePath,
    });

    writeLog('', `[Monitor Manager] Registered new monitor for ${path.basename(filePath)} (session: ${sessionId})`);
  }

  unregister(filePath: string, sessionId: string): void {
    const monitor = this.monitors.get(filePath);
    if (monitor && monitor.sessionId === sessionId) {
      this.monitors.delete(filePath);
      writeLog('', `[Monitor Manager] Unregistered monitor for ${path.basename(filePath)} (session: ${sessionId})`);
    }
  }

  isMonitoring(filePath: string): boolean {
    return this.monitors.has(filePath);
  }
}

const globalMonitorManager = new FileMonitorManager();

// ---- Helper functions ----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileExists(filePath: string): boolean {
  try {
    fs.statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Check if a file is open using lsof (macOS/Linux) or exclusive open (Windows) */
async function isFileOpen(filePath: string): Promise<boolean> {
  if (process.platform === 'win32') {
    // Windows: try to open file with read-write; Excel locks the file exclusively
    try {
      const fd = fs.openSync(filePath, 'r+');
      fs.closeSync(fd);
      return false; // File is NOT open (we got access)
    } catch {
      return true; // File IS open (couldn't get access)
    }
  } else {
    // macOS/Linux: use lsof
    return new Promise((resolve) => {
      execFile('lsof', [filePath], (error, stdout) => {
        if (!error && stdout.length > 0) {
          resolve(true); // File IS open
        } else {
          resolve(false); // File is NOT open
        }
      });
    });
  }
}

// ---- Export functions ----

/** Export proto and yaml from an Excel file */
async function exportProtoAndYaml(
  fileToOpen: string,
  originalFilePath: string,
  currentDir: string,
  logPrefix: string,
  notifyError?: (title: string, message: string) => void,
): Promise<boolean> {
  writeLog(currentDir, `${logPrefix} Starting export process...`);
  await sleep(EXPORT_DELAY);

  let exportSuccess = true;

  // Export proto
  const protoOutputDir = path.dirname(originalFilePath);
  writeLog(currentDir, `${logPrefix} Proto output directory: ${protoOutputDir}`);

  try {
    const protoFile = await exportToProtobuf(fileToOpen, protoOutputDir);
    writeLog(currentDir, `${logPrefix} Proto exported successfully: ${protoFile}`);
  } catch (err) {
    exportSuccess = false;
    writeLog(currentDir, `${logPrefix} Proto export failed: ${err}`);
    notifyError?.(t().protoExportFailed, String(err));
    return false;
  }

  // Export yaml
  const yamlOutputDir = path.dirname(originalFilePath);
  writeLog(currentDir, `${logPrefix} YAML output directory: ${yamlOutputDir}`);

  try {
    const yamlFile = await exportToYAML(fileToOpen, yamlOutputDir);
    writeLog(currentDir, `${logPrefix} YAML exported successfully: ${yamlFile}`);
  } catch (err) {
    exportSuccess = false;
    writeLog(currentDir, `${logPrefix} YAML export failed: ${err}`);
    notifyError?.(t().yamlExportFailed, String(err));
    return false;
  }

  writeLog(currentDir, `${logPrefix} Export completed successfully`);
  return exportSuccess;
}

/** Clean Excel data after export: keep only header rows 1-5 */
async function cleanExcelDataAfterExport(filePath: string, currentDir: string): Promise<void> {
  writeLog(currentDir, `[Excel Cleanup] Starting cleanup: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let totalRowsDeleted = 0;
  let sheetsProcessed = 0;

  for (const ws of workbook.worksheets) {
    if (!validateSheetName(ws.name)) {
      writeLog(currentDir, `[Excel Cleanup] Skipping sheet '${ws.name}' (not _CONF)`);
      continue;
    }

    const rowCount = ws.rowCount;
    if (rowCount <= HEADER_ROW_COUNT) {
      writeLog(currentDir, `[Excel Cleanup] Sheet '${ws.name}' has ${rowCount} rows, no cleanup needed`);
      continue;
    }

    const rowsToDelete = rowCount - HEADER_ROW_COUNT;
    writeLog(currentDir, `[Excel Cleanup] Deleting ${rowsToDelete} rows from sheet '${ws.name}'`);

    // Delete from bottom to avoid index shifting
    for (let i = rowCount; i > HEADER_ROW_COUNT; i--) {
      ws.spliceRows(i, 1);
    }

    totalRowsDeleted += rowsToDelete;
    sheetsProcessed++;
  }

  await workbook.xlsx.writeFile(filePath);
  writeLog(currentDir, `[Excel Cleanup] Done: ${sheetsProcessed} sheets, ${totalRowsDeleted} rows deleted`);
}

/** Export, cleanup Excel, and delete tmp file */
async function exportAndCleanup(
  tmpFilePath: string,
  originalFilePath: string,
  currentDir: string,
  goroutineId: string,
  events: EventEmitter,
  notifyError?: (title: string, message: string) => void,
): Promise<boolean> {
  const logPrefix = `[G-${goroutineId}]`;

  // Step 1: Export proto and yaml
  writeLog(currentDir, `${logPrefix} [Export & Cleanup] Step 1/3: Exporting...`);
  const success = await exportProtoAndYaml(tmpFilePath, originalFilePath, currentDir, logPrefix, notifyError);

  if (!success) {
    writeLog(currentDir, `${logPrefix} [Export & Cleanup] Export failed, aborting cleanup`);
    return false;
  }

  // Step 2: Clean Excel data (keep header rows 1-5)
  writeLog(currentDir, `${logPrefix} [Export & Cleanup] Step 2/3: Cleaning Excel data...`);
  try {
    await cleanExcelDataAfterExport(originalFilePath, currentDir);
    writeLog(currentDir, `${logPrefix} [Export & Cleanup] Excel data cleaned: ${originalFilePath}`);
  } catch (err) {
    writeLog(currentDir, `${logPrefix} [Export & Cleanup] Excel cleanup failed: ${err}`);
  }

  // Step 3: Delete tmp file
  writeLog(currentDir, `${logPrefix} [Export & Cleanup] Step 3/3: Deleting tmp file: ${path.basename(tmpFilePath)}`);
  try {
    fs.unlinkSync(tmpFilePath);
    writeLog(currentDir, `${logPrefix} [Export & Cleanup] Tmp file deleted: ${path.basename(tmpFilePath)}`);
    events.emit('tmpFileDeleted');
  } catch (err) {
    writeLog(currentDir, `${logPrefix} [Export & Cleanup] Failed to delete tmp file: ${err}`);
    return false;
  }

  writeLog(currentDir, `${logPrefix} [Export & Cleanup] All steps completed!`);
  return true;
}

// ---- Monitor functions ----

/** Monitor file save (modification time changes) with debounce */
function monitorFileSave(
  signal: AbortSignal,
  sessionId: string,
  tmpFilePath: string,
  originalFilePath: string,
  currentDir: string,
  state: ExportState,
  events: EventEmitter,
  notifyError?: (title: string, message: string) => void,
): void {
  const goroutineId = `${sessionId}-SM`;
  writeLog(currentDir, `[G-${goroutineId}] [Save Monitor] Starting for: ${tmpFilePath}`);

  let lastModTime: number;
  try {
    lastModTime = fs.statSync(tmpFilePath).mtimeMs;
  } catch {
    writeLog(currentDir, `[G-${goroutineId}] [Save Monitor] Cannot stat file, stopping`);
    return;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let exporting = false;

  const interval = setInterval(async () => {
    if (signal.aborted) {
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      writeLog(currentDir, `[G-${goroutineId}] [Save Monitor] Aborted`);
      return;
    }

    try {
      const currentStat = fs.statSync(tmpFilePath);
      if (currentStat.mtimeMs > lastModTime) {
        lastModTime = currentStat.mtimeMs;
        writeLog(currentDir, `[G-${goroutineId}] [Save Monitor] File saved detected`);

        // Debounce: reset timer on each save detection
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (signal.aborted || exporting) return;
          exporting = true;
          try {
            const success = await exportProtoAndYaml(
              tmpFilePath,
              originalFilePath,
              currentDir,
              `[G-${goroutineId}] [Save Export]`,
              notifyError,
            );
            if (success) {
              state.exportedOnSave = true;
              state.lastExportTime = new Date();
              writeLog(currentDir, `[G-${goroutineId}] [Save Export] Export completed on save`);
            }
          } finally {
            exporting = false;
          }
        }, SAVE_DEBOUNCE_MS);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        clearInterval(interval);
        if (debounceTimer) clearTimeout(debounceTimer);
        writeLog(currentDir, `[G-${goroutineId}] [Save Monitor] File gone, stopping`);
        return;
      }
    }
  }, FILE_SAVE_POLL_INTERVAL);

  // Stop on events
  const cleanup = () => {
    clearInterval(interval);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
  events.once('excelClosed', cleanup);
  events.once('tmpFileDeleted', cleanup);
  signal.addEventListener('abort', cleanup, { once: true });
}

/** Monitor file close using lsof / exclusive open */
function monitorFileClose(
  signal: AbortSignal,
  sessionId: string,
  tmpFilePath: string,
  originalFilePath: string,
  currentDir: string,
  state: ExportState,
  events: EventEmitter,
  notifyError?: (title: string, message: string) => void,
): void {
  const goroutineId = `${sessionId}-FC`;
  writeLog(currentDir, `[G-${goroutineId}] [File Close Monitor] Starting for: ${path.basename(tmpFilePath)}`);

  let tmpFileOpened = false;
  let tmpFileClosed = false;

  const interval = setInterval(async () => {
    if (signal.aborted) {
      clearInterval(interval);
      return;
    }

    const open = await isFileOpen(tmpFilePath);

    if (open) {
      if (!tmpFileOpened) {
        tmpFileOpened = true;
        writeLog(currentDir, `[G-${goroutineId}] [File Close Monitor] File opened: ${path.basename(tmpFilePath)}`);
      }
      if (tmpFileClosed) {
        tmpFileClosed = false;
        writeLog(currentDir, `[G-${goroutineId}] [File Close Monitor] File reopened`);
      }
    } else {
      if (tmpFileOpened && !tmpFileClosed) {
        tmpFileClosed = true;
        writeLog(currentDir, `[G-${goroutineId}] [File Close Monitor] File closed: ${path.basename(tmpFilePath)}`);

        if (!state.exportedOnSave && !state.exportedOnClose) {
          writeLog(
            currentDir,
            `[G-${goroutineId}] [File Close Export] File closed without export, starting export and cleanup...`,
          );

          const success = await exportAndCleanup(
            tmpFilePath,
            originalFilePath,
            currentDir,
            goroutineId,
            events,
            notifyError,
          );

          if (success) {
            state.exportedOnClose = true;
            state.lastExportTime = new Date();
          }

          clearInterval(interval);
          return;
        } else {
          writeLog(currentDir, `[G-${goroutineId}] [File Close Monitor] Already exported, deleting tmp file`);
          try {
            fs.unlinkSync(tmpFilePath);
            events.emit('tmpFileDeleted');
          } catch (err) {
            writeLog(currentDir, `[G-${goroutineId}] [File Close Monitor] Failed to delete: ${err}`);
          }
          clearInterval(interval);
          return;
        }
      }
    }
  }, FILE_CLOSE_POLL_INTERVAL);

  // Handle excel closed event
  events.once('excelClosed', () => {
    writeLog(currentDir, `[G-${goroutineId}] [File Close Monitor] Excel closed signal received`);
    if (tmpFileOpened && tmpFileClosed) {
      state.fileClosedByUser = true;
      events.emit('fileCloseResult', true);
    } else {
      events.emit('fileCloseResult', false);
    }
    clearInterval(interval);
  });

  events.once('tmpFileDeleted', () => {
    clearInterval(interval);
  });

  signal.addEventListener(
    'abort',
    () => {
      clearInterval(interval);
    },
    { once: true },
  );
}

/** Monitor Excel process exit */
function monitorExcelProcess(
  signal: AbortSignal,
  sessionId: string,
  cmd: ChildProcess,
  tmpFilePath: string,
  originalFilePath: string,
  filename: string,
  currentDir: string,
  state: ExportState,
  openTime: Date,
  events: EventEmitter,
  notifyError?: (title: string, message: string) => void,
): void {
  const goroutineId = `${sessionId}-EC`;

  cmd.on('exit', async (code) => {
    if (signal.aborted) {
      writeLog(currentDir, `[G-${goroutineId}] [Process] Aborted, exiting`);
      return;
    }

    if (code !== 0) {
      writeLog(currentDir, `[G-${goroutineId}] [Process] Excel exited with code: ${code}`);
    } else {
      writeLog(currentDir, `[G-${goroutineId}] [Process] Excel exited normally`);
    }

    // Check if tmp file still exists
    if (!fileExists(tmpFilePath)) {
      writeLog(currentDir, `[G-${goroutineId}] [Process] Tmp file gone, exiting`);
      events.emit('excelClosed');
      return;
    }

    writeLog(currentDir, `[G-${goroutineId}] [Process] Excel closed, notifying monitors...`);
    events.emit('excelClosed');

    // Log timing
    const closeTime = new Date();
    const durationMs = closeTime.getTime() - openTime.getTime();
    const durationSec = Math.round(durationMs / 1000);
    writeLog(currentDir, `File closed: ${filename} (opened for ${durationSec}s)`);

    await sleep(EXPORT_DELAY);

    // Extract Excel info
    try {
      const info = await extractExcelInfo(tmpFilePath);
      logExcelInfo(info, writeLog);
    } catch (err) {
      writeLog(currentDir, `[G-${goroutineId}] [Excel Close] Error extracting Excel info: ${err}`);
    }

    // Wait for file close monitor result (with timeout)
    writeLog(currentDir, `[G-${goroutineId}] [Excel Close] Waiting for file close monitor result...`);

    const handleResult = async (fileClosed: boolean) => {
      let needExport = false;
      let exportReason = '';

      if (fileClosed) {
        if (!state.exportedOnSave && !state.exportedOnClose) {
          needExport = true;
          exportReason = 'File closed without any export';
        }
      } else {
        if (!state.exportedOnSave) {
          needExport = true;
          exportReason = 'Excel closed without file save';
        }
      }

      if (needExport) {
        writeLog(currentDir, `[G-${goroutineId}] [Excel Close Export] ${exportReason}, starting export and cleanup...`);
        await exportAndCleanup(tmpFilePath, originalFilePath, currentDir, goroutineId, events, notifyError);
      }
    };

    // Listen for file close result or timeout
    const timeout = setTimeout(async () => {
      writeLog(currentDir, `[G-${goroutineId}] [Excel Close] Timeout waiting for file close monitor`);
      if (!state.exportedOnSave && !state.exportedOnClose) {
        await exportAndCleanup(tmpFilePath, originalFilePath, currentDir, goroutineId, events, notifyError);
      }
    }, FILE_CLOSE_TIMEOUT);

    events.once('fileCloseResult', (fileClosed: boolean) => {
      clearTimeout(timeout);
      handleResult(fileClosed);
    });

    events.once('tmpFileDeleted', () => {
      clearTimeout(timeout);
      writeLog(currentDir, `[G-${goroutineId}] [Excel Close] Tmp file already deleted, skipping export`);
    });
  });
}

// ---- Public API ----

/** Open Excel file with system app and start monitoring */
export async function openExcelAndMonitor(
  tmpFilePath: string,
  originalFilePath: string,
  filename: string,
  currentDir: string,
  notifyError?: (title: string, message: string) => void,
): Promise<void> {
  // Get initial mod time
  const sessionId = String(Date.now() % 100000);
  writeLog(currentDir, `[Session-${sessionId}] Starting new monitoring session for: ${filename}`);

  const abortController = new AbortController();
  const { signal } = abortController;

  globalMonitorManager.register(originalFilePath, sessionId, abortController, tmpFilePath);

  const events = new EventEmitter();
  const state: ExportState = {
    lastExportTime: null,
    exportedOnSave: false,
    exportedOnClose: false,
    fileClosedByUser: false,
  };

  // Start file close monitor
  monitorFileClose(signal, sessionId, tmpFilePath, originalFilePath, currentDir, state, events, notifyError);

  // Spawn Excel process
  let cmd: ChildProcess;
  if (process.platform === 'darwin') {
    cmd = spawn('open', ['-W', '-a', 'Microsoft Excel', tmpFilePath], { stdio: 'ignore' });
  } else if (process.platform === 'win32') {
    cmd = spawn('cmd', ['/c', 'start', '/wait', 'excel.exe', tmpFilePath], { stdio: 'ignore' });
  } else {
    cmd = spawn('xdg-open', [tmpFilePath], { stdio: 'ignore' });
  }

  writeLog(currentDir, `Opening Excel file: ${filename}`);
  const openTime = new Date();

  // Start save monitor
  monitorFileSave(signal, sessionId, tmpFilePath, originalFilePath, currentDir, state, events, notifyError);

  // Start process exit monitor
  monitorExcelProcess(
    signal,
    sessionId,
    cmd,
    tmpFilePath,
    originalFilePath,
    filename,
    currentDir,
    state,
    openTime,
    events,
    notifyError,
  );

  // Cleanup when all done
  events.once('tmpFileDeleted', () => {
    globalMonitorManager.unregister(originalFilePath, sessionId);
  });
}

/** Open a file (find xlsx in directory if needed) and start monitoring */
export async function openFileWithDefaultApp(
  dataDir: string,
  filename: string,
  currentDir: string,
  notifyError?: (title: string, message: string) => void,
): Promise<void> {
  let filePath = path.join(dataDir, filename);

  // Check existence
  if (!fileExists(filePath)) {
    writeLog(currentDir, `Path does not exist: ${filePath}`);
    notifyError?.(t().fileNotFound, t().pathNotExist(filename));
    return;
  }

  const stat = fs.statSync(filePath);

  // If directory, find xlsx inside
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(filePath, { withFileTypes: true });
    const xlsxEntry = entries.find((e) => !e.isDirectory() && path.extname(e.name) === XLSX_EXTENSION);

    if (!xlsxEntry) {
      writeLog(currentDir, `No xlsx file found in directory: ${filePath}`);
      notifyError?.(t().noExcelFile, t().noXlsxInDir(filename));
      return;
    }

    filePath = path.join(filePath, xlsxEntry.name);
    writeLog(currentDir, `Found xlsx file in directory: ${filePath}`);
  }

  // Non-Excel: just open
  if (path.extname(filePath) !== XLSX_EXTENSION) {
    if (process.platform === 'darwin') {
      spawn('open', [filePath], { stdio: 'ignore' });
    } else if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', filePath], { stdio: 'ignore' });
    } else {
      spawn('xdg-open', [filePath], { stdio: 'ignore' });
    }
    writeLog(currentDir, `Opening file: ${filename}`);
    return;
  }

  // Excel file: get tmp file to open
  const originalFilePath = filePath;
  const tmpFilePath = await getFileToOpen(filePath);

  writeLog(currentDir, `originalFilePath: ${originalFilePath}`);
  writeLog(currentDir, `tmpFilePath: ${tmpFilePath}`);
  writeLog(currentDir, `Using tmp file for editing: ${path.basename(tmpFilePath)}`);

  await openExcelAndMonitor(tmpFilePath, originalFilePath, filename, currentDir, notifyError);
}

/** Create a new Excel file and open it */
export async function createAndOpenExcel(
  dataDir: string,
  currentDir: string,
  fileName: string,
  sheetName: string,
  useTemplate: boolean,
  notifyError?: (title: string, message: string) => void,
): Promise<void> {
  // Create subdirectory
  const subDir = path.join(dataDir, fileName);
  fs.mkdirSync(subDir, { recursive: true });

  // Create Excel file
  const xlsxFilename = `${fileName}${XLSX_EXTENSION}`;
  const filePath = path.join(subDir, xlsxFilename);
  const workbook = new ExcelJS.Workbook();

  if (useTemplate && sheetName) {
    if (!validateSheetName(sheetName)) {
      writeLog(currentDir, `Invalid sheet name: ${sheetName}`);
      notifyError?.(t().invalidSheetName, t().invalidSheetNameMessage(sheetName));
      return;
    }

    const template = getDefaultTemplate();
    template.sheetName = sheetName;
    await createHeaderTemplate(workbook, sheetName, template.columns);
  }

  await workbook.xlsx.writeFile(filePath);
  const relativePath = path.join(fileName, xlsxFilename);
  writeLog(currentDir, `Excel file created: ${relativePath}`);

  // Create tmp file
  writeLog(currentDir, 'Creating tmp file for new Excel file...');
  let tmpFilePath: string;
  try {
    tmpFilePath = await createTmpFileFromYAML(filePath);
    writeLog(currentDir, `Tmp file created: ${path.basename(tmpFilePath)}`);
  } catch (err) {
    writeLog(currentDir, `Error creating tmp file: ${err}`);
    notifyError?.(t().tmpFileError, t().tmpFileCreateFailed(String(err)));
    return;
  }

  // Open and monitor
  await openExcelAndMonitor(tmpFilePath, filePath, relativePath, currentDir, notifyError);
}

/** Delete a file or directory */
export function deleteFileOrDir(
  dataDir: string,
  filename: string,
  currentDir: string,
): { success: boolean; error?: string; isDir: boolean } {
  const filePath = path.join(dataDir, filename);

  if (!fileExists(filePath)) {
    return { success: false, error: `Path does not exist: ${filename}`, isDir: false };
  }

  const stat = fs.statSync(filePath);
  const isDir = stat.isDirectory();

  try {
    if (isDir) {
      writeLog(currentDir, `[File Delete] Deleting directory: ${filePath}`);
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      writeLog(currentDir, `[File Delete] Deleting file: ${filePath}`);
      fs.unlinkSync(filePath);
    }

    writeLog(currentDir, `[File Delete] Deleted successfully: ${filename}`);
    return { success: true, isDir };
  } catch (err) {
    writeLog(currentDir, `[File Delete] Failed: ${err}`);
    return { success: false, error: String(err), isDir };
  }
}
