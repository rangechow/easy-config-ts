export interface Messages {
  // LeftPanel
  setDir: string;
  unset: string;
  currentDir: string;
  currentDirNotSet: string;
  functionMenu: string;
  edit: string;
  create: string;
  delete: string;

  // FileList
  fileListTitle: string;
  emptyFileList: string;

  // CreateDialog
  createExcelFile: string;
  cancel: string;
  fileName: string;
  fileNameRequired: string;
  fileNameInvalid: string;
  fileNamePlaceholder: string;
  useTemplate: string;
  sheetName: string;
  sheetNameRequired: string;
  sheetNamePattern: string;
  sheetNamePlaceholder: string;

  // App messages
  setDataDirFirst: string;
  selectFileFirst: string;
  editFileFailed: string;
  fileCreated: (name: string) => string;
  createFileFailed: string;

  // Main process - dialog
  selectDataDirectory: string;
  confirmDelete: string;
  confirmDeleteMessage: (name: string) => string;
  deleted: string;
  deletedMessage: (name: string) => string;
  unexpectedError: string;
  unexpectedErrorMessage: (msg: string) => string;

  // Main process - errors
  noActiveWindow: string;
  dataDirNotSet: string;
  noFileSelected: string;
  invalidPath: string;
  fileNameEmpty: string;
  sheetNameRequiredForTemplate: string;

  // file-ops errors
  protoExportFailed: string;
  yamlExportFailed: string;
  fileNotFound: string;
  pathNotExist: (name: string) => string;
  noExcelFile: string;
  noXlsxInDir: (name: string) => string;
  invalidSheetName: string;
  invalidSheetNameMessage: (name: string) => string;
  tmpFileError: string;
  tmpFileCreateFailed: (err: string) => string;
}

const zh: Messages = {
  // LeftPanel
  setDir: '设置目录',
  unset: '取消设置',
  currentDir: '当前目录',
  currentDirNotSet: '当前目录: 未设置',
  functionMenu: '功能菜单',
  edit: '编辑',
  create: '创建',
  delete: '删除',

  // FileList
  fileListTitle: '数据目录文件',
  emptyFileList: '未找到包含 .xlsx 文件的目录',

  // CreateDialog
  createExcelFile: '创建 Excel 文件',
  cancel: '取消',
  fileName: '文件名',
  fileNameRequired: '请输入文件名',
  fileNameInvalid: '文件名不能包含特殊字符（\\ / : * ? " < > |）',
  fileNamePlaceholder: '输入 Excel 文件名（不含扩展名）',
  useTemplate: '使用数据配置模板（5行表头）',
  sheetName: '表名',
  sheetNameRequired: '使用模板时必须填写表名',
  sheetNamePattern: '必须为大写字母和下划线组合，以 _CONF 结尾',
  sheetNamePlaceholder: '例如 EXAMPLE_CONF',

  // App messages
  setDataDirFirst: '请先设置数据目录',
  selectFileFirst: '请先从列表中选择一个文件',
  editFileFailed: '编辑文件失败',
  fileCreated: (name: string) => `文件 '${name}' 已创建`,
  createFileFailed: '创建文件失败',

  // Main process - dialog
  selectDataDirectory: '选择数据目录',
  confirmDelete: '确认删除',
  confirmDeleteMessage: (name: string) => `确定要删除 '${name}' 吗？`,
  deleted: '已删除',
  deletedMessage: (name: string) => `'${name}' 已被删除`,
  unexpectedError: '意外错误',
  unexpectedErrorMessage: (msg: string) => `发生了意外错误：\n${msg}`,

  // Main process - errors
  noActiveWindow: '没有活动窗口',
  dataDirNotSet: '数据目录未设置',
  noFileSelected: '未选择文件',
  invalidPath: '无效的文件路径',
  fileNameEmpty: '文件名不能为空',
  sheetNameRequiredForTemplate: '使用模板时必须填写表名',

  // file-ops errors
  protoExportFailed: 'Proto 导出失败',
  yamlExportFailed: 'YAML 导出失败',
  fileNotFound: '文件未找到',
  pathNotExist: (name: string) => `路径不存在: ${name}`,
  noExcelFile: '无 Excel 文件',
  noXlsxInDir: (name: string) => `目录中未找到 .xlsx 文件: ${name}`,
  invalidSheetName: '无效的表名',
  invalidSheetNameMessage: (name: string) => `表名 '${name}' 必须以 _CONF 结尾，且只包含大写字母和下划线`,
  tmpFileError: '临时文件错误',
  tmpFileCreateFailed: (err: string) => `创建临时文件失败: ${err}`,
};

const en: Messages = {
  // LeftPanel
  setDir: 'Set Dir',
  unset: 'Unset',
  currentDir: 'Current',
  currentDirNotSet: 'Current: Not Set',
  functionMenu: 'Function Menu',
  edit: 'Edit',
  create: 'Create',
  delete: 'Delete',

  // FileList
  fileListTitle: 'Data Directory Files',
  emptyFileList: 'No directories with .xlsx files found',

  // CreateDialog
  createExcelFile: 'Create Excel File',
  cancel: 'Cancel',
  fileName: 'File Name',
  fileNameRequired: 'Please enter a file name',
  fileNameInvalid: 'File name cannot contain special characters (\\ / : * ? " < > |)',
  fileNamePlaceholder: 'Enter Excel file name (without extension)',
  useTemplate: 'Use data config template (5-row header)',
  sheetName: 'Sheet Name',
  sheetNameRequired: 'Sheet name is required when using template',
  sheetNamePattern: 'Must be uppercase letters + underscores, ending with _CONF',
  sheetNamePlaceholder: 'e.g., EXAMPLE_CONF',

  // App messages
  setDataDirFirst: 'Please set a data directory first',
  selectFileFirst: 'Please select a file from the list first',
  editFileFailed: 'Failed to edit file',
  fileCreated: (name: string) => `File '${name}' created`,
  createFileFailed: 'Failed to create file',

  // Main process - dialog
  selectDataDirectory: 'Select Data Directory',
  confirmDelete: 'Confirm Delete',
  confirmDeleteMessage: (name: string) => `Are you sure you want to delete '${name}'?`,
  deleted: 'Deleted',
  deletedMessage: (name: string) => `'${name}' has been deleted`,
  unexpectedError: 'Unexpected Error',
  unexpectedErrorMessage: (msg: string) => `An unexpected error occurred:\n${msg}`,

  // Main process - errors
  noActiveWindow: 'No active window',
  dataDirNotSet: 'Data directory not set',
  noFileSelected: 'No file selected',
  invalidPath: 'Invalid file path',
  fileNameEmpty: 'File name cannot be empty',
  sheetNameRequiredForTemplate: 'Sheet name is required when using template',

  // file-ops errors
  protoExportFailed: 'Proto Export Failed',
  yamlExportFailed: 'YAML Export Failed',
  fileNotFound: 'File Not Found',
  pathNotExist: (name: string) => `Path does not exist: ${name}`,
  noExcelFile: 'No Excel File',
  noXlsxInDir: (name: string) => `No .xlsx file found in directory: ${name}`,
  invalidSheetName: 'Invalid Sheet Name',
  invalidSheetNameMessage: (name: string) =>
    `Sheet name '${name}' must end with _CONF and contain only A-Z and underscores`,
  tmpFileError: 'Tmp File Error',
  tmpFileCreateFailed: (err: string) => `Failed to create temporary file: ${err}`,
};

const locales: Record<string, Messages> = { zh, en };

let currentLocale: string = 'zh';

export function setLocale(locale: string): void {
  if (locales[locale]) {
    currentLocale = locale;
  }
}

export function getLocale(): string {
  return currentLocale;
}

export function t(): Messages {
  return locales[currentLocale] || locales['zh'];
}
