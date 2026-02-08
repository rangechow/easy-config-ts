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

/** API exposed to renderer via preload */
export interface ElectronAPI {
  // Directory management
  setDataDir: () => Promise<IpcResult<{ dirPath: string; items: FileItem[] }>>;
  unsetDataDir: () => Promise<IpcResult>;
  getConfig: () => Promise<IpcResult<Config>>;
  getFileItems: () => Promise<IpcResult<FileItem[]>>;

  // File operations
  editFile: (filePath: string) => Promise<IpcResult>;
  createFile: (req: CreateFileRequest) => Promise<IpcResult<FileItem[]>>;
  deleteFile: (filePath: string) => Promise<IpcResult<FileItem[]>>;

  // Events from main process
  onNotification: (callback: (notification: AppNotification) => void) => () => void;
  onFileItemsChanged: (callback: (items: FileItem[]) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
