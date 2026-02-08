import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getTmpFilePath,
  tmpFileExists,
  deleteTmpFile,
  getOriginalPathFromTmp,
  isTmpFile,
} from '../../src/main/convert/tmp-file-manager';

describe('getTmpFilePath', () => {
  it('inserts _tmp before extension', () => {
    expect(getTmpFilePath('/data/game.xlsx')).toBe('/data/game_tmp.xlsx');
    expect(getTmpFilePath('/data/config.xlsx')).toBe('/data/config_tmp.xlsx');
  });

  it('handles paths without extension', () => {
    expect(getTmpFilePath('/data/game')).toBe('/data/game_tmp');
  });

  it('handles nested paths', () => {
    expect(getTmpFilePath('/a/b/c/monster_data.xlsx')).toBe('/a/b/c/monster_data_tmp.xlsx');
  });
});

describe('getOriginalPathFromTmp', () => {
  it('removes _tmp suffix', () => {
    expect(getOriginalPathFromTmp('/data/game_tmp.xlsx')).toBe('/data/game.xlsx');
  });

  it('handles paths without _tmp', () => {
    expect(getOriginalPathFromTmp('/data/game.xlsx')).toBe('/data/game.xlsx');
  });

  it('only removes trailing _tmp', () => {
    expect(getOriginalPathFromTmp('/data/tmp_game_tmp.xlsx')).toBe('/data/tmp_game.xlsx');
  });
});

describe('isTmpFile', () => {
  it('detects tmp files', () => {
    expect(isTmpFile('/data/game_tmp.xlsx')).toBe(true);
    expect(isTmpFile('monster_data_tmp.xlsx')).toBe(true);
  });

  it('rejects non-tmp files', () => {
    expect(isTmpFile('/data/game.xlsx')).toBe(false);
    expect(isTmpFile('/data/game_template.xlsx')).toBe(false);
    expect(isTmpFile('/data/tmp_game.xlsx')).toBe(false);
  });
});

describe('tmpFileExists', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-tmp-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns false when tmp file does not exist', () => {
    const original = path.join(tmpDir, 'game.xlsx');
    expect(tmpFileExists(original)).toBe(false);
  });

  it('returns true when tmp file exists', () => {
    const original = path.join(tmpDir, 'game.xlsx');
    const tmpPath = path.join(tmpDir, 'game_tmp.xlsx');
    fs.writeFileSync(tmpPath, 'dummy');
    expect(tmpFileExists(original)).toBe(true);
  });
});

describe('deleteTmpFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-tmp-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('deletes existing tmp file', () => {
    const original = path.join(tmpDir, 'game.xlsx');
    const tmpPath = path.join(tmpDir, 'game_tmp.xlsx');
    fs.writeFileSync(tmpPath, 'dummy');

    deleteTmpFile(original);
    expect(fs.existsSync(tmpPath)).toBe(false);
  });

  it('does nothing when tmp file does not exist', () => {
    const original = path.join(tmpDir, 'game.xlsx');
    // Should not throw
    expect(() => deleteTmpFile(original)).not.toThrow();
  });
});
