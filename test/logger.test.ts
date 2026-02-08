import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeLog } from '../src/main/logger';

describe('writeLog', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-logger-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates log directory and writes log', () => {
    writeLog(tmpDir, 'Test message');

    const logDir = path.join(tmpDir, 'logs');
    expect(fs.existsSync(logDir)).toBe(true);

    const logFile = path.join(logDir, 'app.log');
    expect(fs.existsSync(logFile)).toBe(true);

    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('Test message');
  });

  it('appends to existing log file', () => {
    writeLog(tmpDir, 'First message');
    writeLog(tmpDir, 'Second message');

    const logFile = path.join(tmpDir, 'logs', 'app.log');
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('First message');
    expect(content).toContain('Second message');
  });

  it('includes timestamp in log entries', () => {
    writeLog(tmpDir, 'Timestamped');

    const logFile = path.join(tmpDir, 'logs', 'app.log');
    const content = fs.readFileSync(logFile, 'utf-8');

    // Timestamp format: [YYYY-MM-DD HH:MM:SS]
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
  });

  it('each entry ends with newline', () => {
    writeLog(tmpDir, 'Single entry');

    const logFile = path.join(tmpDir, 'logs', 'app.log');
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content.endsWith('\n')).toBe(true);
  });

  it('rotates log file when it exceeds max size', () => {
    const logDir = path.join(tmpDir, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'app.log');

    // Write a file larger than 5MB
    const bigContent = 'x'.repeat(6 * 1024 * 1024);
    fs.writeFileSync(logFile, bigContent);

    // Write a new log entry which should trigger rotation
    writeLog(tmpDir, 'After rotation');

    // Old log should be renamed to .old
    expect(fs.existsSync(logFile + '.old')).toBe(true);
    const oldContent = fs.readFileSync(logFile + '.old', 'utf-8');
    expect(oldContent).toBe(bigContent);

    // New log should contain the new entry
    const newContent = fs.readFileSync(logFile, 'utf-8');
    expect(newContent).toContain('After rotation');
    expect(newContent.length).toBeLessThan(1000);
  });
});
