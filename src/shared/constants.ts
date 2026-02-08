// ---- Excel header structure ----
export const HEADER_ROW_COUNT = 5;
export const DATA_ROW_START = HEADER_ROW_COUNT + 1; // Row 6

// ---- Sheet naming ----
export const SHEET_NAME_SUFFIX = '_CONF';

// ---- File extensions ----
export const XLSX_EXTENSION = '.xlsx';
export const YAML_EXTENSION = '.yaml';
export const PROTO_SUFFIX = '_conf.proto';

// ---- Temporary file ----
export const TEMP_FILE_SUFFIX = '_tmp';

// ---- File monitoring intervals (ms) ----
export const FILE_SAVE_POLL_INTERVAL = 1000;
export const FILE_CLOSE_POLL_INTERVAL = 2000;
export const FILE_CLOSE_TIMEOUT = 10000;
export const EXPORT_DELAY = 500;
export const SAVE_DEBOUNCE_MS = 2000;

// ---- Validation ----
export const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;
export const VALID_FILENAME_PATTERN = /^[^\\/:*?"<>|]+$/;

// ---- Config ----
export const CONFIG_FILE_NAME = 'config.json';
export const WINDOW_STATE_FILE = 'window-state.json';
export const LOG_DIR_NAME = 'logs';
export const LOG_FILE_NAME = 'app.log';
export const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ---- Window defaults ----
export const DEFAULT_WINDOW_WIDTH = 900;
export const DEFAULT_WINDOW_HEIGHT = 650;
