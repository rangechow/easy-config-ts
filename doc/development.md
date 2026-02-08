# 开发指南

## 环境准备

### 必需

- **Node.js** >= 18
- **npm** >= 9
- **Microsoft Excel** — 用于编辑配置文件

### 可选

- **protoc** — Protocol Buffers 编译器，用于 Proto 文件二次校验

### 安装依赖

```bash
npm install
```

## 开发

### 启动开发模式

```bash
npm run dev
```

Vite 会同时构建三个目标：
- **Renderer**（React 前端）— 启动开发服务器，支持热更新
- **Main**（Electron 主进程）— 监听文件变更并重新构建
- **Preload**（预加载脚本）— 变更时自动重载

修改 renderer 代码后浏览器会自动刷新；修改 main/preload 代码后 Electron 窗口自动重启。

### 构建

```bash
# TypeScript 编译检查 + Vite 构建
npm run build
```

构建产物：
- `dist/renderer/` — 前端静态资源
- `dist/main/index.js` — 主进程 bundle
- `dist/preload/index.js` — 预加载脚本

### 打包发布

```bash
npx electron-builder
```

根据 `electron-builder.yml` 配置打包：
- macOS: `.dmg` + `.zip`
- Windows: `.exe`（NSIS 安装程序）
- Linux: `.AppImage` + `.deb`

输出到 `release/` 目录。

### 测试

```bash
# 运行一次
npm run test

# 监听模式
npm run test:watch

# 带覆盖率
npm run test:coverage
```

使用 Vitest 作为测试框架，v8 作为覆盖率提供者。

测试覆盖范围：
- `src/main/**/*.ts` — 主进程模块
- `src/shared/**/*.ts` — 共享模块
- 排除 `src/main/index.ts`（Electron 入口）和 `src/preload/**`

当前测试文件：
| 测试文件 | 覆盖模块 |
|---------|---------|
| `test/config.test.ts` | `config.ts`（同步 + 异步读写） |
| `test/logger.test.ts` | `logger.ts`（写入、追加、时间戳、日志轮转） |
| `test/file-items.test.ts` | `file-items.ts`（目录扫描、xlsx 检测） |
| `test/file-ops.test.ts` | `file-ops.ts`（文件/目录删除） |
| `test/i18n.test.ts` | `i18n.ts`（中英文切换、模板函数） |
| `test/constants.test.ts` | `constants.ts`（所有常量值和验证规则） |
| `test/convert/*.test.ts` | 所有 convert 子模块 |

### 代码质量

```bash
# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format

# Prettier 检查（CI 用）
npm run format:check
```

## 项目配置

### TypeScript

`tsconfig.json` 关键配置：
- `target: "ES2022"` — 使用现代 JS 特性
- `module: "ESNext"` — ESM 模块
- `moduleResolution: "bundler"` — Vite 兼容的模块解析
- `strict: true` — 严格类型检查
- `jsx: "react-jsx"` — React 17+ 新 JSX 转换
- 路径别名：`@shared/*` -> `src/shared/*`

### Vite

`vite.config.ts` 关键配置：
- `root` 设为 `src/renderer`
- 使用绝对路径（`path.join(projectRoot, ...)`）避免路径解析问题
- 主进程 external：`electron`、`exceljs`、`js-yaml`、`chokidar`（Node.js 原生模块不打包进 bundle）

### electron-builder

`electron-builder.yml` 关键配置：
- `appId: com.easyconfig.app`
- `files: dist/**/*` — 打包 dist 目录
- macOS 分类：`public.app-category.developer-tools`

## 依赖说明

### 运行时依赖

| 包 | 用途 |
|----|------|
| `exceljs` | Excel 文件读写（替代 Go 版 excelize） |
| `js-yaml` | YAML 序列化/反序列化（替代 Go 版 gopkg.in/yaml.v3） |
| `chokidar` | 文件系统监控（补充 mtime 轮询） |

### 开发依赖

| 包 | 用途 |
|----|------|
| `electron` | 桌面应用框架 |
| `electron-builder` | 打包与分发 |
| `typescript` | 类型系统 |
| `vite` | 构建工具 |
| `vite-plugin-electron` | Vite 集成 Electron 构建 |
| `vite-plugin-electron-renderer` | 渲染进程 Node.js API 支持 |
| `@vitejs/plugin-react` | React 快速刷新 |
| `react` / `react-dom` | UI 框架 |
| `antd` | Ant Design 组件库 |
| `vitest` | 测试框架 |
| `eslint` | 代码检查 |
| `prettier` | 代码格式化 |

## 常见开发任务

### 添加新的 IPC 通道

1. 在 `src/shared/types.ts` 的 `ElectronAPI` 接口中添加方法定义
2. 在 `src/main/index.ts` 的 `registerIpcHandlers()` 中添加 `ipcMain.handle`
3. 在 `src/preload/index.ts` 的 `api` 对象中添加 `ipcRenderer.invoke` 调用
4. 在渲染进程中通过 `window.api.xxx()` 调用

### 添加新的数据类型

在 `src/main/convert/protobuf-exporter.ts` 的 `validateDataType()` 函数中添加新类型的识别逻辑。

### 修改表头模板

编辑 `src/main/convert/header-template.ts` 中的 `getDefaultTemplate()` 函数。

### 添加新的 UI 组件

1. 在 `src/renderer/components/` 下创建组件文件
2. 在 `App.tsx` 中引入并使用
3. 如需与主进程通信，通过 `window.api` 调用

### 添加新语言

在 `src/shared/i18n.ts` 中：
1. 创建新的 `Messages` 对象（如 `const ja: Messages = { ... }`）
2. 将新语言对象添加到 `locales` Map 中
3. 确保所有字段都有对应翻译

### 修改共享常量

所有魔法数字和常量都集中在 `src/shared/constants.ts` 中，包括：
- 表头行数和数据起始行
- 文件扩展名
- 监控轮询间隔和超时
- 文件名验证正则
- 日志文件大小限制
- 窗口默认尺寸

## 从 Go 版本迁移的技术映射

| Go 概念 | TypeScript 对应 |
|---------|----------------|
| Goroutine + Channel | `setInterval` + `EventEmitter` + `AbortController` |
| `sync.Mutex` | 不需要（Node.js 单线程） |
| `context.Context` cancel | `AbortController.abort()` |
| `excelize.OpenFile()` | `new ExcelJS.Workbook(); workbook.xlsx.readFile()` |
| `f.GetRows(sheet)` | `worksheet.getSheetValues()` |
| `f.SetCellValue(sheet, cell, val)` | `worksheet.getCell(ref).value = val` |
| `yaml.Marshal()` / `yaml.Unmarshal()` | `yaml.dump()` / `yaml.load()` |
| `os/exec.Command("lsof")` | `child_process.execFile("lsof")` |
| `cmd.Run()` (blocking) | `child_process.spawn()` + `on('exit')` |
| Fyne GUI | React + Ant Design |
| `fyne.NewApp()` | `new BrowserWindow()` |
| `dialog.ShowFolderOpen()` | `dialog.showOpenDialog()` |

## 调试

### 主进程日志

开发模式下，主进程的 `console.log` 输出到终端。运行时日志写入 `logs/app.log`。

### 渲染进程调试

开发模式下可使用 Chrome DevTools（Electron 自动打开或通过菜单 View -> Toggle Developer Tools）。

### 文件监控调试

文件监控的每个关键步骤都有日志输出。查看 `logs/app.log` 可以追踪完整的监控流程：

```bash
tail -f logs/app.log
```

日志包含时间戳和操作标识，便于定位问题。
