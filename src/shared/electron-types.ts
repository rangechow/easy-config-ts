// Electron-specific types (not part of the npm library)
import type { FileItem, Config, CreateFileRequest, IpcResult, AppNotification } from './types';

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
