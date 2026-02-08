// Shared types used by both main and renderer processes

/** File item in the directory tree */
export interface FileItem {
  name: string;
  path: string; // relative path from data directory
  isDir: boolean;
  level: number;
}

/** Application configuration */
export interface Config {
  data_directory: string;
}

/** Request to create a new Excel file */
export interface CreateFileRequest {
  name: string;
  sheetName: string;
  useTemplate: boolean;
}

/** Generic IPC result wrapper */
export interface IpcResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Notification from main to renderer */
export interface AppNotification {
  type: 'info' | 'success' | 'error' | 'warning';
  title: string;
  message: string;
}
