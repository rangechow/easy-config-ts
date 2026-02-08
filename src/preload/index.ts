import { contextBridge, ipcRenderer } from 'electron';
import type { AppNotification, ElectronAPI, FileItem, CreateFileRequest } from '../shared/types';

const api: ElectronAPI = {
  // Directory management
  setDataDir: () => ipcRenderer.invoke('set-data-dir'),
  unsetDataDir: () => ipcRenderer.invoke('unset-data-dir'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  getFileItems: () => ipcRenderer.invoke('get-file-items'),

  // File operations
  editFile: (filePath: string) => ipcRenderer.invoke('edit-file', filePath),
  createFile: (req: CreateFileRequest) => ipcRenderer.invoke('create-file', req),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),

  // Events from main process
  onNotification: (callback: (notification: AppNotification) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, notification: AppNotification) => {
      callback(notification);
    };
    ipcRenderer.on('notification', handler);
    return () => {
      ipcRenderer.removeListener('notification', handler);
    };
  },

  onFileItemsChanged: (callback: (items: FileItem[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, items: FileItem[]) => {
      callback(items);
    };
    ipcRenderer.on('file-items-changed', handler);
    return () => {
      ipcRenderer.removeListener('file-items-changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);
