# 架构设计

## 项目结构

```
easy-config-ts/
├── package.json                # 依赖与脚本
├── tsconfig.json               # TypeScript 配置
├── tsconfig.node.json          # Vite 构建用 TS 配置
├── vite.config.ts              # Vite + Electron 构建配置
├── vitest.config.ts            # 测试配置（含覆盖率）
├── eslint.config.mjs           # ESLint 配置
├── .prettierrc                 # Prettier 配置
├── electron-builder.yml        # 打包配置
├── config.json                 # 运行时配置（data_directory）
├── src/
│   ├── shared/
│   │   ├── types.ts            # 主进程/渲染进程共享类型
│   │   ├── constants.ts        # 共享常量（间隔、文件名、验证规则等）
│   │   └── i18n.ts             # 国际化（中文/英文）
│   ├── main/                   # Electron 主进程
│   │   ├── index.ts            # 入口：窗口创建、IPC 注册、生命周期、安全策略
│   │   ├── config.ts           # config.json 读写（同步 + 异步）
│   │   ├── logger.ts           # 日志写入 logs/app.log（含日志轮转）
│   │   ├── file-items.ts       # 文件树构建（扫描目录中的 xlsx）
│   │   ├── file-ops.ts         # 文件监控核心（打开、监控、导出、清理）
│   │   └── convert/            # 数据转换模块
│   │       ├── header-template.ts   # 表头模板与校验
│   │       ├── extractor.ts         # Excel 信息提取
│   │       ├── proto-validator.ts   # Proto 语法校验
│   │       ├── protobuf-exporter.ts # Excel -> Proto
│   │       ├── yaml-exporter.ts     # Excel -> YAML
│   │       ├── yaml-importer.ts     # YAML -> Excel
│   │       └── tmp-file-manager.ts  # 临时文件管理
│   ├── preload/
│   │   └── index.ts            # contextBridge 安全桥接
│   └── renderer/               # React 渲染进程
│       ├── index.html
│       ├── main.tsx            # React 入口
│       ├── App.tsx             # 主组件（状态管理、事件处理）
│       ├── App.css             # 样式
│       └── components/
│           ├── LeftPanel.tsx    # 左侧面板（按钮组 + 目录显示 + 加载状态）
│           ├── FileList.tsx     # 右侧文件列表（双击打开、键盘导航）
│           └── CreateDialog.tsx # 创建文件对话框（文件名校验）
├── test/                       # 测试文件
│   ├── config.test.ts
│   ├── logger.test.ts
│   ├── file-items.test.ts
│   ├── file-ops.test.ts
│   ├── i18n.test.ts
│   ├── constants.test.ts
│   └── convert/
│       ├── extractor.test.ts
│       ├── header-template.test.ts
│       ├── proto-validator.test.ts
│       ├── protobuf-exporter.test.ts
│       ├── yaml-exporter.test.ts
│       ├── yaml-importer.test.ts
│       └── tmp-file-manager.test.ts
├── doc/                        # 文档
└── logs/                       # 运行时日志（自动创建，5MB 轮转）
    └── app.log
```

## 进程架构

```
┌─────────────────────────────────────────────────┐
│                 Electron Main Process            │
│                                                  │
│  index.ts ── IPC Handlers                       │
│      │                                           │
│      ├── config.ts (配置读写)                    │
│      ├── logger.ts (日志)                        │
│      ├── file-items.ts (目录扫描)                │
│      ├── file-ops.ts (文件监控核心)              │
│      │      ├── monitorFileSave (1s 轮询)       │
│      │      ├── monitorFileClose (2s 轮询)      │
│      │      └── monitorExcelProcess (进程退出)   │
│      └── convert/                                │
│             ├── protobuf-exporter.ts             │
│             ├── yaml-exporter.ts                 │
│             ├── yaml-importer.ts                 │
│             └── ...                              │
│                                                  │
├──────────── contextBridge (preload) ─────────────┤
│                                                  │
│                Electron Renderer Process          │
│                                                  │
│  React App                                       │
│      ├── LeftPanel (操作按钮)                    │
│      ├── FileList (文件列表)                     │
│      └── CreateDialog (创建对话框)               │
│                                                  │
└─────────────────────────────────────────────────┘
```

## IPC 通信

渲染进程通过 `window.api`（preload 暴露）与主进程通信。

### 渲染进程 -> 主进程（invoke/handle）

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get-config` | 无 | `IpcResult<Config>` | 获取当前配置 |
| `get-file-items` | 无 | `IpcResult<FileItem[]>` | 获取文件列表 |
| `set-data-dir` | 无 | `IpcResult<{dirPath, items}>` | 弹出目录选择器并设置 |
| `unset-data-dir` | 无 | `IpcResult` | 清除数据目录 |
| `edit-file` | `filePath: string` | `IpcResult` | 打开文件编辑 |
| `create-file` | `{name, sheetName, useTemplate}` | `IpcResult<FileItem[]>` | 创建新 Excel |
| `delete-file` | `filePath: string` | `IpcResult<FileItem[]>` | 删除文件（弹确认框） |

### 主进程 -> 渲染进程（send/on）

| 通道 | 数据 | 说明 |
|------|------|------|
| `notification` | `AppNotification` | 通知消息（info/success/error/warning） |
| `file-items-changed` | `FileItem[]` | 文件列表变更推送 |

## 文件监控机制

这是整个应用的核心。当用户编辑一个 Excel 文件时，系统同时启动三个监控任务：

### 1. monitorFileSave — 保存监控

- **间隔**：1 秒
- **原理**：比对文件 `mtime`，变化即视为保存
- **动作**：触发 Proto + YAML 导出

### 2. monitorFileClose — 文件关闭监控

- **间隔**：2 秒
- **原理**：
  - macOS/Linux：执行 `lsof <file>`，无输出说明文件已关闭
  - Windows：尝试 `fs.openSync(file, 'r+')`，成功说明文件未被占用
- **动作**：触发导出 + 清理（清除数据行、删除 tmp 文件）

### 3. monitorExcelProcess — 进程退出监控

- **原理**：`child_process.spawn` 的 `exit` 事件
- **动作**：
  - 记录编辑时长
  - 等待文件关闭监控（最多 10 秒）
  - 如果前两个监控都未触发导出，作为最后保障执行导出

### 协作流程

```
用户按 Cmd+S
    │
    ▼
monitorFileSave 检测到 mtime 变化
    │
    ▼
去抖 2 秒（防止快速连续保存触发多次导出）
    │
    ▼
调用 exportProtoAndYaml()
    │
    ├── 导出 Proto（含语法校验）
    └── 导出 YAML
         │
         ▼
    更新 exportState.exportedOnSave = true

用户关闭 Excel
    │
    ├── monitorExcelProcess 收到 exit 事件
    │       等待 monitorFileClose 结果
    │
    └── monitorFileClose 检测到文件不再被占用
            │
            ▼
        调用 exportAndCleanup()
            │
            ├── 导出 Proto + YAML（如尚未导出）
            ├── cleanExcelDataAfterExport (清除数据行，保留表头)
            └── 删除 tmp 文件
```

### 会话管理

- 每个文件打开时创建唯一 session ID
- 多个文件可同时编辑，各自独立监控
- 重复打开同一文件时，旧的监控会被 `AbortController` 取消
- Node.js 单线程模型，不需要锁

## 临时文件机制

为什么使用临时文件？

- 原始 Excel 只保留 5 行表头（数据存在 YAML 中）
- 编辑前需要将 YAML 数据导入回 Excel
- 为防止导出失败丢失数据，编辑的是副本（`xxx_tmp.xlsx`）

流程：

```
原始 Excel (仅表头)
      │
      ▼  复制 + 导入 YAML 数据
临时 Excel (xxx_tmp.xlsx)
      │
      ▼  用户在 Excel 中编辑
      │
      ▼  保存/关闭时导出
Proto 文件 + YAML 文件
      │
      ▼  导出成功后
清理原始 Excel 数据行 + 删除 tmp 文件
```

如果导出失败，tmp 文件保留，下次编辑时恢复。

## 跨平台支持

### 打开 Excel

| 平台 | 命令 |
|------|------|
| macOS | `open -W -a "Microsoft Excel" file.xlsx` |
| Windows | `cmd /c start /wait excel.exe file.xlsx` |
| Linux | `xdg-open file.xlsx` |

`-W` / `/wait` 参数使进程在 Excel 关闭后才退出，用于进程退出监控。

### 文件占用检测

| 平台 | 方法 |
|------|------|
| macOS / Linux | `lsof <file>` — 有输出说明文件被占用 |
| Windows | `fs.openSync(file, 'r+')` — 成功说明文件未被占用 |

### macOS .app Bundle

打包为 `.app` 时，可执行文件在 `Contents/MacOS/` 中。主进程启动时检测 `Contents` 父目录，将工作目录回溯到 `.app` 所在目录，确保 `config.json` 和 `logs/` 路径正确。

## Convert 模块

### 依赖关系

```
header-template.ts (基础：校验、模板)
        │
        ├── extractor.ts (信息提取)
        │
        ├── protobuf-exporter.ts (Excel -> Proto)
        │       └── proto-validator.ts (语法校验)
        │
        ├── yaml-exporter.ts (Excel -> YAML)
        │
        ├── yaml-importer.ts (YAML -> Excel)
        │       └── yaml-exporter.ts (复用 parseColumnStructure)
        │
        └── tmp-file-manager.ts (临时文件)
                └── yaml-importer.ts
```

### 各模块职责

| 模块 | 主要导出函数 | 说明 |
|------|-------------|------|
| `header-template` | `validateSheetName`, `createHeaderTemplate`, `normalizeExportType`, `normalizeConstraint` | 表头定义与校验 |
| `extractor` | `extractExcelInfo`, `formatExcelInfo`, `logExcelInfo` | 提取 Excel 统计信息（Sheet 数、行列数、单元格数） |
| `protobuf-exporter` | `parseExcelToProtobuf`, `exportToProtobuf` | 解析表头生成 Proto 消息定义，支持嵌套结构体和数组 |
| `proto-validator` | `validateProtoSyntax`, `validateProtoFile` | 内置语法检查 + protoc 编译器校验 |
| `yaml-exporter` | `exportToYAML`, `parseColumnStructure` | 将 Excel 数据行导出为 YAML |
| `yaml-importer` | `importYAMLToExcel` | 将 YAML 数据写回 Excel，按 ID 排序 |
| `tmp-file-manager` | `createTmpFileFromYAML`, `getFileToOpen`, `deleteTmpFile` | 临时文件创建、查找、清理 |

## 安全机制

### IPC 路径遍历防护

所有接受文件路径的 IPC handler（`edit-file`、`create-file`、`delete-file`）都使用 `isPathSafe()` 验证路径，防止 `../` 目录遍历攻击。

```typescript
function isPathSafe(dataDir: string, relativePath: string): boolean {
  const resolved = path.resolve(dataDir, relativePath);
  return resolved.startsWith(dataDir + path.sep) || resolved === dataDir;
}
```

### 文件名校验

- 前端：`CreateDialog` 使用 `VALID_FILENAME_PATTERN` 正则校验
- 后端：`create-file` handler 使用 `INVALID_FILENAME_CHARS` 二次校验
- 不允许包含 `\ / : * ? " < > |` 等特殊字符

### Content Security Policy

通过 `session.defaultSession.webRequest.onHeadersReceived` 设置 CSP：

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:
```

### contextBridge

渲染进程通过 `contextBridge.exposeInMainWorld` 暴露安全 API，`nodeIntegration` 关闭，`contextIsolation` 开启。

## 国际化

使用 `src/shared/i18n.ts` 实现国际化：

- `Messages` 接口定义所有 UI 文本（~55 个字段）
- 支持 `zh`（中文，默认）和 `en`（英文）两种语言
- 通过 `t()` 函数获取当前语言的文本
- 支持模板函数，如 `t().fileCreated(name)` 返回包含参数的消息
- 主进程和渲染进程共享同一套国际化定义

## 日志系统

- 日志写入 `{currentDir}/logs/app.log`
- 格式：`[YYYY-MM-DD HH:MM:SS] message`
- 同时输出到 stdout
- **日志轮转**：当 `app.log` 超过 5MB 时，重命名为 `app.log.old`，新建 `app.log` 继续写入
