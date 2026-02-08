import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { deleteFileOrDir } from '../src/main/file-ops';

describe('deleteFileOrDir', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-fileops-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes a file successfully', () => {
    const fileName = 'test.xlsx';
    fs.writeFileSync(path.join(tmpDir, fileName), 'test content');

    const result = deleteFileOrDir(tmpDir, fileName, tmpDir);
    expect(result.success).toBe(true);
    expect(result.isDir).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, fileName))).toBe(false);
  });

  it('deletes a directory successfully', () => {
    const dirName = 'testdir';
    const dirPath = path.join(tmpDir, dirName);
    fs.mkdirSync(dirPath);
    fs.writeFileSync(path.join(dirPath, 'file.txt'), 'content');

    const result = deleteFileOrDir(tmpDir, dirName, tmpDir);
    expect(result.success).toBe(true);
    expect(result.isDir).toBe(true);
    expect(fs.existsSync(dirPath)).toBe(false);
  });

  it('deletes a directory with nested contents', () => {
    const dirName = 'nested';
    const dirPath = path.join(tmpDir, dirName);
    fs.mkdirSync(path.join(dirPath, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dirPath, 'sub', 'deep.txt'), 'deep');

    const result = deleteFileOrDir(tmpDir, dirName, tmpDir);
    expect(result.success).toBe(true);
    expect(result.isDir).toBe(true);
    expect(fs.existsSync(dirPath)).toBe(false);
  });

  it('returns error for non-existent path', () => {
    const result = deleteFileOrDir(tmpDir, 'nonexistent', tmpDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path does not exist');
    expect(result.isDir).toBe(false);
  });

  it('handles empty filename', () => {
    // Empty filename resolves to the data dir itself
    const result = deleteFileOrDir(tmpDir, 'missing', tmpDir);
    expect(result.success).toBe(false);
  });
});
