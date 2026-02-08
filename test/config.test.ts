import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig, saveConfig, saveConfigAsync } from '../src/main/config';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('loads valid config file', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ data_directory: '/data/path' }));

    const config = loadConfig(configPath);
    expect(config.data_directory).toBe('/data/path');
  });

  it('returns empty config for missing file', () => {
    const config = loadConfig(path.join(tmpDir, 'nonexistent.json'));
    expect(config.data_directory).toBe('');
  });

  it('returns empty config for invalid JSON', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, 'not valid json{{{');

    const config = loadConfig(configPath);
    expect(config.data_directory).toBe('');
  });

  it('loads config with empty data_directory', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ data_directory: '' }));

    const config = loadConfig(configPath);
    expect(config.data_directory).toBe('');
  });
});

describe('saveConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('saves config to file', () => {
    const configPath = path.join(tmpDir, 'config.json');
    saveConfig(configPath, { data_directory: '/new/path' });

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.data_directory).toBe('/new/path');
  });

  it('overwrites existing config', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ data_directory: '/old' }));

    saveConfig(configPath, { data_directory: '/new' });

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.data_directory).toBe('/new');
  });

  it('writes formatted JSON with 2-space indent', () => {
    const configPath = path.join(tmpDir, 'config.json');
    saveConfig(configPath, { data_directory: '/test' });

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toBe(JSON.stringify({ data_directory: '/test' }, null, 2));
  });
});

describe('saveConfigAsync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('saves config to file asynchronously', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    await saveConfigAsync(configPath, { data_directory: '/async/path' });

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.data_directory).toBe('/async/path');
  });

  it('overwrites existing config asynchronously', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ data_directory: '/old' }));

    await saveConfigAsync(configPath, { data_directory: '/new' });

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.data_directory).toBe('/new');
  });

  it('writes formatted JSON with 2-space indent', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    await saveConfigAsync(configPath, { data_directory: '/test' });

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toBe(JSON.stringify({ data_directory: '/test' }, null, 2));
  });
});
