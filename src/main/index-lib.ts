// EasyConfig library entry point
// Convert modules (core functionality)
export * from './convert/index';

// Utility modules
export { loadConfig, saveConfig, saveConfigAsync } from './config';
export { writeLog } from './logger';
export { buildFileItems } from './file-items';
export { deleteFileOrDir } from './file-ops';

// Shared types and constants
export type { FileItem, Config, CreateFileRequest, IpcResult, AppNotification } from '../shared/types';
export * from '../shared/constants';
export { setLocale, getLocale, t } from '../shared/i18n';
export type { Messages } from '../shared/i18n';
