import fs from 'fs';
import path from 'path';
import { LOG_DIR_NAME, LOG_FILE_NAME, LOG_MAX_SIZE_BYTES } from '../shared/constants';

/**
 * Rotate log file if it exceeds the max size.
 * Renames current log to app.log.old (overwriting previous backup).
 */
function rotateLogIfNeeded(logFile: string): void {
  try {
    const stat = fs.statSync(logFile);
    if (stat.size >= LOG_MAX_SIZE_BYTES) {
      const backupFile = logFile + '.old';
      fs.renameSync(logFile, backupFile);
    }
  } catch {
    // File doesn't exist yet or stat failed, no rotation needed
  }
}

/**
 * Write a timestamped log message to logs/app.log and stdout.
 */
export function writeLog(currentDir: string, message: string): void {
  const logDir = path.join(currentDir, LOG_DIR_NAME);
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create log directory: ${err}`);
    return;
  }

  const logFile = path.join(logDir, LOG_FILE_NAME);

  rotateLogIfNeeded(logFile);

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(logFile, logMessage, 'utf-8');
  } catch (err) {
    console.error(`Failed to write log: ${err}`);
    return;
  }

  process.stdout.write(logMessage);
}
