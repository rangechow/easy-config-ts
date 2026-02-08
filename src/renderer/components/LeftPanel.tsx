import React, { useState } from 'react';
import { Button } from 'antd';
import { FolderOpenOutlined, CloseOutlined, EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { t } from '../../shared/i18n';
import CreateDialog from './CreateDialog';

interface LeftPanelProps {
  currentDataDir: string;
  loading: boolean;
  onSetDataDir: () => void;
  onUnsetDataDir: () => void;
  onEdit: () => void;
  onCreate: (name: string, sheetName: string, useTemplate: boolean) => void;
  onDelete: () => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  currentDataDir,
  loading,
  onSetDataDir,
  onUnsetDataDir,
  onEdit,
  onCreate,
  onDelete,
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleCreate = (name: string, sheetName: string, useTemplate: boolean) => {
    onCreate(name, sheetName, useTemplate);
    setCreateDialogOpen(false);
  };

  return (
    <>
      <div className="dir-buttons">
        <Button type="primary" icon={<FolderOpenOutlined />} onClick={onSetDataDir} size="small" loading={loading}>
          {t().setDir}
        </Button>
        <Button icon={<CloseOutlined />} onClick={onUnsetDataDir} size="small" disabled={loading}>
          {t().unset}
        </Button>
      </div>

      <div className="dir-label">{currentDataDir ? `${t().currentDir}: ${currentDataDir}` : t().currentDirNotSet}</div>

      <div className="menu-section">
        <div className="menu-title">{t().functionMenu}</div>
        <div className="menu-buttons">
          <Button block icon={<EditOutlined />} onClick={onEdit} disabled={loading}>
            {t().edit}
          </Button>
          <Button block icon={<PlusOutlined />} onClick={() => setCreateDialogOpen(true)} disabled={loading}>
            {t().create}
          </Button>
          <Button block danger icon={<DeleteOutlined />} onClick={onDelete} disabled={loading}>
            {t().delete}
          </Button>
        </div>
      </div>

      <CreateDialog open={createDialogOpen} onCancel={() => setCreateDialogOpen(false)} onCreate={handleCreate} />
    </>
  );
};

export default LeftPanel;
