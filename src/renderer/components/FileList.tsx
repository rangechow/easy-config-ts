import React, { useCallback } from 'react';
import type { FileItem } from '../../shared/types';
import { t } from '../../shared/i18n';

interface FileListProps {
  items: FileItem[];
  selectedFile: string;
  onSelectFile: (filePath: string) => void;
  onDoubleClick?: (filePath: string) => void;
}

const FileList: React.FC<FileListProps> = ({ items, selectedFile, onSelectFile, onDoubleClick }) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (items.length === 0) return;

      const currentIndex = items.findIndex((item) => item.path === selectedFile);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        onSelectFile(items[nextIndex].path);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        onSelectFile(items[prevIndex].path);
      } else if (e.key === 'Enter' && selectedFile && onDoubleClick) {
        e.preventDefault();
        onDoubleClick(selectedFile);
      }
    },
    [items, selectedFile, onSelectFile, onDoubleClick],
  );

  return (
    <>
      <div className="file-list-header">{t().fileListTitle}</div>
      <div className="file-list-container" tabIndex={0} onKeyDown={handleKeyDown}>
        {items.length === 0 ? (
          <div className="empty-list">{t().emptyFileList}</div>
        ) : (
          items.map((item) => (
            <div
              key={item.path}
              className={`file-item ${selectedFile === item.path ? 'selected' : ''}`}
              onClick={() => onSelectFile(item.path)}
              onDoubleClick={() => onDoubleClick?.(item.path)}
              style={{ paddingLeft: `${12 + item.level * 20}px` }}
            >
              <span className="file-item-icon">{item.isDir ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>
              <span className="file-item-name">{item.name}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default FileList;
