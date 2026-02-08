import React, { useState } from 'react';
import { Modal, Form, Input, Checkbox } from 'antd';
import { t } from '../../shared/i18n';
import { VALID_FILENAME_PATTERN } from '../../shared/constants';

interface CreateDialogProps {
  open: boolean;
  onCancel: () => void;
  onCreate: (name: string, sheetName: string, useTemplate: boolean) => void;
}

const CreateDialog: React.FC<CreateDialogProps> = ({ open, onCancel, onCreate }) => {
  const [form] = Form.useForm();
  const [useTemplate, setUseTemplate] = useState(true);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onCreate(values.name, values.sheetName || '', useTemplate);
      form.resetFields();
      setUseTemplate(true);
    } catch {
      // validation failed
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setUseTemplate(true);
    onCancel();
  };

  return (
    <Modal
      title={t().createExcelFile}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={t().create}
      cancelText={t().cancel}
    >
      <Form form={form} layout="vertical" initialValues={{ useTemplate: true }}>
        <Form.Item
          name="name"
          label={t().fileName}
          rules={[
            { required: true, message: t().fileNameRequired },
            {
              pattern: VALID_FILENAME_PATTERN,
              message: t().fileNameInvalid,
            },
          ]}
        >
          <Input placeholder={t().fileNamePlaceholder} />
        </Form.Item>

        <Form.Item>
          <Checkbox checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)}>
            {t().useTemplate}
          </Checkbox>
        </Form.Item>

        {useTemplate && (
          <Form.Item
            name="sheetName"
            label={t().sheetName}
            rules={[
              { required: useTemplate, message: t().sheetNameRequired },
              {
                pattern: /^[A-Z_]+_CONF$/,
                message: t().sheetNamePattern,
              },
            ]}
          >
            <Input placeholder={t().sheetNamePlaceholder} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default CreateDialog;
