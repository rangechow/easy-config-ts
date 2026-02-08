import React, { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import type { FileItem } from '../shared/types';
import { t } from '../shared/i18n';
import LeftPanel from './components/LeftPanel';
import FileList from './components/FileList';
import './App.css';

const MIN_LEFT_WIDTH = 200;
const MAX_LEFT_WIDTH = 500;
const DEFAULT_LEFT_WIDTH = 260;

const App: React.FC = () => {
  const [currentDataDir, setCurrentDataDir] = useState<string>('');
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial config
  useEffect(() => {
    (async () => {
      const result = await window.api.getConfig();
      if (result.success && result.data) {
        setCurrentDataDir(result.data.data_directory || '');
      }

      const itemsResult = await window.api.getFileItems();
      if (itemsResult.success && itemsResult.data) {
        setFileItems(itemsResult.data);
      }
    })();
  }, []);

  // Listen for notifications from main process
  useEffect(() => {
    const unsubscribe = window.api.onNotification((notification) => {
      messageApi[notification.type](`${notification.title}: ${notification.message}`);
    });
    return unsubscribe;
  }, [messageApi]);

  // Listen for file items changes
  useEffect(() => {
    const unsubscribe = window.api.onFileItemsChanged((items) => {
      setFileItems(items);
    });
    return unsubscribe;
  }, []);

  // Resize drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      setLeftWidth(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleSetDataDir = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.setDataDir();
      if (result.success && result.data) {
        setCurrentDataDir(result.data.dirPath);
        setFileItems(result.data.items);
        setSelectedFile('');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUnsetDataDir = useCallback(async () => {
    const result = await window.api.unsetDataDir();
    if (result.success) {
      setCurrentDataDir('');
      setFileItems([]);
      setSelectedFile('');
    }
  }, []);

  const handleEdit = useCallback(async () => {
    if (!currentDataDir) {
      messageApi.warning(t().setDataDirFirst);
      return;
    }
    if (!selectedFile) {
      messageApi.info(t().selectFileFirst);
      return;
    }
    setLoading(true);
    try {
      const result = await window.api.editFile(selectedFile);
      if (!result.success) {
        messageApi.error(result.error || t().editFileFailed);
      }
    } finally {
      setLoading(false);
    }
  }, [currentDataDir, selectedFile, messageApi]);

  const handleCreate = useCallback(
    async (name: string, sheetName: string, useTemplate: boolean) => {
      if (!currentDataDir) {
        messageApi.warning(t().setDataDirFirst);
        return;
      }
      setLoading(true);
      try {
        const result = await window.api.createFile({ name, sheetName, useTemplate });
        if (result.success && result.data) {
          setFileItems(result.data);
          messageApi.success(t().fileCreated(name));
        } else {
          messageApi.error(result.error || t().createFileFailed);
        }
      } finally {
        setLoading(false);
      }
    },
    [currentDataDir, messageApi],
  );

  const handleDelete = useCallback(async () => {
    if (!currentDataDir) {
      messageApi.warning(t().setDataDirFirst);
      return;
    }
    if (!selectedFile) {
      messageApi.info(t().selectFileFirst);
      return;
    }
    setLoading(true);
    try {
      const result = await window.api.deleteFile(selectedFile);
      if (result.success && result.data) {
        setFileItems(result.data);
        setSelectedFile('');
      } else if (result.error && result.error !== 'User cancelled') {
        messageApi.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, [currentDataDir, selectedFile, messageApi]);

  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFile(filePath);
  }, []);

  return (
    <div className="app-container">
      {contextHolder}
      <div className="app-layout" ref={containerRef}>
        <div className="left-panel" style={{ width: leftWidth }}>
          <LeftPanel
            currentDataDir={currentDataDir}
            loading={loading}
            onSetDataDir={handleSetDataDir}
            onUnsetDataDir={handleUnsetDataDir}
            onEdit={handleEdit}
            onCreate={handleCreate}
            onDelete={handleDelete}
          />
        </div>
        <div className="resize-handle" onMouseDown={handleMouseDown} />
        <div className="right-panel">
          <FileList
            items={fileItems}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            onDoubleClick={handleEdit}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
