import { describe, it, expect } from 'vitest';
import {
  HEADER_ROW_COUNT,
  DATA_ROW_START,
  SHEET_NAME_SUFFIX,
  XLSX_EXTENSION,
  YAML_EXTENSION,
  PROTO_SUFFIX,
  TEMP_FILE_SUFFIX,
  FILE_SAVE_POLL_INTERVAL,
  FILE_CLOSE_POLL_INTERVAL,
  FILE_CLOSE_TIMEOUT,
  EXPORT_DELAY,
  SAVE_DEBOUNCE_MS,
  INVALID_FILENAME_CHARS,
  VALID_FILENAME_PATTERN,
  CONFIG_FILE_NAME,
  LOG_DIR_NAME,
  LOG_FILE_NAME,
  LOG_MAX_SIZE_BYTES,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
} from '../src/shared/constants';

describe('shared constants', () => {
  describe('Excel header structure', () => {
    it('HEADER_ROW_COUNT is 5', () => {
      expect(HEADER_ROW_COUNT).toBe(5);
    });

    it('DATA_ROW_START is HEADER_ROW_COUNT + 1', () => {
      expect(DATA_ROW_START).toBe(HEADER_ROW_COUNT + 1);
      expect(DATA_ROW_START).toBe(6);
    });
  });

  describe('sheet naming', () => {
    it('SHEET_NAME_SUFFIX is _CONF', () => {
      expect(SHEET_NAME_SUFFIX).toBe('_CONF');
    });
  });

  describe('file extensions', () => {
    it('XLSX_EXTENSION starts with dot', () => {
      expect(XLSX_EXTENSION).toBe('.xlsx');
    });

    it('YAML_EXTENSION starts with dot', () => {
      expect(YAML_EXTENSION).toBe('.yaml');
    });

    it('PROTO_SUFFIX ends with .proto', () => {
      expect(PROTO_SUFFIX).toBe('_conf.proto');
      expect(PROTO_SUFFIX.endsWith('.proto')).toBe(true);
    });
  });

  describe('temporary file', () => {
    it('TEMP_FILE_SUFFIX is _tmp', () => {
      expect(TEMP_FILE_SUFFIX).toBe('_tmp');
    });
  });

  describe('monitoring intervals', () => {
    it('FILE_SAVE_POLL_INTERVAL is a positive number', () => {
      expect(FILE_SAVE_POLL_INTERVAL).toBeGreaterThan(0);
      expect(FILE_SAVE_POLL_INTERVAL).toBe(1000);
    });

    it('FILE_CLOSE_POLL_INTERVAL is greater than FILE_SAVE_POLL_INTERVAL', () => {
      expect(FILE_CLOSE_POLL_INTERVAL).toBeGreaterThan(FILE_SAVE_POLL_INTERVAL);
      expect(FILE_CLOSE_POLL_INTERVAL).toBe(2000);
    });

    it('FILE_CLOSE_TIMEOUT is greater than poll intervals', () => {
      expect(FILE_CLOSE_TIMEOUT).toBeGreaterThan(FILE_CLOSE_POLL_INTERVAL);
      expect(FILE_CLOSE_TIMEOUT).toBe(10000);
    });

    it('EXPORT_DELAY is a positive number', () => {
      expect(EXPORT_DELAY).toBeGreaterThan(0);
      expect(EXPORT_DELAY).toBe(500);
    });

    it('SAVE_DEBOUNCE_MS is a positive number', () => {
      expect(SAVE_DEBOUNCE_MS).toBeGreaterThan(0);
      expect(SAVE_DEBOUNCE_MS).toBe(2000);
    });
  });

  describe('validation patterns', () => {
    it('INVALID_FILENAME_CHARS matches invalid characters', () => {
      expect(INVALID_FILENAME_CHARS.test('\\')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test('/')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test(':')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test('*')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test('?')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test('"')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test('<')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test('>')).toBe(true);
      expect(INVALID_FILENAME_CHARS.test('|')).toBe(true);
    });

    it('INVALID_FILENAME_CHARS does not match valid characters', () => {
      expect(INVALID_FILENAME_CHARS.test('hello')).toBe(false);
      expect(INVALID_FILENAME_CHARS.test('my_file')).toBe(false);
      expect(INVALID_FILENAME_CHARS.test('data-2024')).toBe(false);
    });

    it('VALID_FILENAME_PATTERN matches valid filenames', () => {
      expect(VALID_FILENAME_PATTERN.test('hello')).toBe(true);
      expect(VALID_FILENAME_PATTERN.test('my_file')).toBe(true);
      expect(VALID_FILENAME_PATTERN.test('data-2024')).toBe(true);
      expect(VALID_FILENAME_PATTERN.test('file.xlsx')).toBe(true);
    });

    it('VALID_FILENAME_PATTERN rejects invalid filenames', () => {
      expect(VALID_FILENAME_PATTERN.test('path/file')).toBe(false);
      expect(VALID_FILENAME_PATTERN.test('path\\file')).toBe(false);
      expect(VALID_FILENAME_PATTERN.test('file:name')).toBe(false);
      expect(VALID_FILENAME_PATTERN.test('file*name')).toBe(false);
      expect(VALID_FILENAME_PATTERN.test('')).toBe(false);
    });
  });

  describe('config constants', () => {
    it('CONFIG_FILE_NAME is config.json', () => {
      expect(CONFIG_FILE_NAME).toBe('config.json');
    });

    it('LOG_DIR_NAME is logs', () => {
      expect(LOG_DIR_NAME).toBe('logs');
    });

    it('LOG_FILE_NAME is app.log', () => {
      expect(LOG_FILE_NAME).toBe('app.log');
    });

    it('LOG_MAX_SIZE_BYTES is 5 MB', () => {
      expect(LOG_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });
  });

  describe('window defaults', () => {
    it('DEFAULT_WINDOW_WIDTH is positive', () => {
      expect(DEFAULT_WINDOW_WIDTH).toBeGreaterThan(0);
      expect(DEFAULT_WINDOW_WIDTH).toBe(900);
    });

    it('DEFAULT_WINDOW_HEIGHT is positive', () => {
      expect(DEFAULT_WINDOW_HEIGHT).toBeGreaterThan(0);
      expect(DEFAULT_WINDOW_HEIGHT).toBe(650);
    });
  });
});
