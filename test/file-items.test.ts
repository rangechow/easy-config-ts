import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildFileItems } from '../src/main/file-items';

describe('buildFileItems', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-fileitems-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns empty array for empty string', () => {
    expect(buildFileItems('')).toEqual([]);
  });

  it('returns empty array for directory without xlsx files', () => {
    // Create a subdirectory without xlsx files
    fs.mkdirSync(path.join(tmpDir, 'subdir'));
    fs.writeFileSync(path.join(tmpDir, 'subdir', 'readme.txt'), 'hello');

    const items = buildFileItems(tmpDir);
    expect(items).toEqual([]);
  });

  it('finds directories containing xlsx files', () => {
    // Create dir with xlsx
    fs.mkdirSync(path.join(tmpDir, 'monster'));
    fs.writeFileSync(path.join(tmpDir, 'monster', 'monster.xlsx'), 'fake');

    const items = buildFileItems(tmpDir);
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('monster');
    expect(items[0].path).toBe('monster');
    expect(items[0].isDir).toBe(true);
    expect(items[0].level).toBe(0);
  });

  it('finds multiple directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'monster'));
    fs.writeFileSync(path.join(tmpDir, 'monster', 'monster.xlsx'), 'fake');
    fs.mkdirSync(path.join(tmpDir, 'task'));
    fs.writeFileSync(path.join(tmpDir, 'task', 'task.xlsx'), 'fake');

    const items = buildFileItems(tmpDir);
    expect(items.length).toBe(2);
    const names = items.map((i) => i.name).sort();
    expect(names).toEqual(['monster', 'task']);
  });

  it('skips hidden directories', () => {
    fs.mkdirSync(path.join(tmpDir, '.hidden'));
    fs.writeFileSync(path.join(tmpDir, '.hidden', 'data.xlsx'), 'fake');
    fs.mkdirSync(path.join(tmpDir, 'visible'));
    fs.writeFileSync(path.join(tmpDir, 'visible', 'data.xlsx'), 'fake');

    const items = buildFileItems(tmpDir);
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('visible');
  });

  it('ignores non-xlsx files', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs'));
    fs.writeFileSync(path.join(tmpDir, 'docs', 'readme.md'), 'hello');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'data.csv'), 'a,b,c');

    const items = buildFileItems(tmpDir);
    expect(items).toEqual([]);
  });

  it('only lists directories, not files directly in data dir', () => {
    // File directly in data dir (not in a subdirectory)
    fs.writeFileSync(path.join(tmpDir, 'direct.xlsx'), 'fake');

    const items = buildFileItems(tmpDir);
    expect(items).toEqual([]);
  });
});
