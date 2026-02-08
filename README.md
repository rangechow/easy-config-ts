# EasyConfig

游戏数据配置管理工具，基于 Electron + React + TypeScript 构建。

通过 Excel 定义数据配置表（5 行表头格式），自动导出为 Protobuf 描述文件和 YAML 数据文件，实现 Excel 与 Proto/YAML 的双向同步。

## 核心特性

- **Excel 配置表管理** — 创建、编辑、删除 Excel 数据配置文件，支持标准 5 行表头模板
- **自动导出** — 编辑保存时自动导出 `.proto` 和 `.yaml` 文件，关闭时自动清理
- **双向同步** — 编辑时自动从 YAML 导入数据到 Excel，保存时自动导出回 YAML
- **临时文件机制** — 使用 `_tmp.xlsx` 编辑，防止导出失败导致数据丢失
- **Proto 语法校验** — 内置语法检查 + 可选 protoc 编译器二次验证
- **多 Sheet 支持** — 一个 Excel 中可包含多个 `_CONF` 配置表，分别导出
- **跨平台** — 支持 macOS、Windows、Linux
- **国际化** — 支持中文 / 英文界面切换
- **安全性** — IPC 路径遍历防护、文件名校验、CSP 安全策略

## 工作流程

```
创建/编辑 Excel
      |
      v
+-------------+    保存(Cmd+S)    +------------------+
|  系统 Excel  | -------------->  | 自动导出 Proto+YAML|
|  编辑 tmp 文件|    (去抖 2s)     | (每次保存都导出)   |
+-------------+                  +------------------+
      |
      | 关闭 Excel
      v
+------------------+
| 最终导出 Proto+YAML|
| 清理 Excel 数据行  |
| 删除 tmp 文件      |
+------------------+
```

## 快速开始

### 环境要求

- Node.js >= 18
- Microsoft Excel（用于编辑配置文件）
- protoc（可选，用于 Proto 文件二次验证）

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 运行测试
npm run test

# 测试覆盖率
npm run test:coverage

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 基本使用

1. **设置数据目录** — 点击 `Set Dir`，选择存放配置文件的目录
2. **创建配置表** — 点击 `Create`，输入文件名和 Sheet 名（如 `MONSTER_CONF`），勾选模板
3. **编辑配置表** — 在右侧文件列表选中文件，点击 `Edit` 或双击文件，Excel 自动打开
4. **保存** — 在 Excel 中 Cmd+S / Ctrl+S，工具自动导出 Proto 和 YAML
5. **关闭** — 关闭 Excel，工具完成最终导出并清理

支持键盘操作：上下箭头选择文件，Enter 打开编辑。

### 目录结构示例

```
data/                          # 数据目录（用户设置）
├── monster_data/
│   ├── monster_data.xlsx      # 原始 Excel（仅保留表头）
│   ├── monster_conf.proto     # 导出的 Proto 文件
│   └── monster_conf.yaml      # 导出的 YAML 数据
├── task/
│   ├── task.xlsx
│   ├── task_conf.proto
│   └── task_conf.yaml
```

## 5 行表头格式

每个配置 Sheet 使用固定的 5 行表头定义数据结构：

| 行 | 内容 | 说明 |
|----|------|------|
| 第 1 行 | 约束类型 | `required` / `optional` / `repeated` / `optional_struct` |
| 第 2 行 | 数据类型 | `uint32` / `string` / `int32` / `float` / `bool` / 数字(数组长度) |
| 第 3 行 | 参数名 | 程序使用的字段名，如 `monster_name` |
| 第 4 行 | 导出类型 | `c`(客户端) / `s`(服务端) / `b`(双端) / `e`(编辑器) |
| 第 5 行 | 中文描述 | 该列的说明文字 |

第 6 行起为数据行。

详细的表头规则、数据类型和结构体定义参见 [doc/data-config-guide.md](doc/data-config-guide.md)。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Electron 33 |
| 前端 | React 18 + Ant Design 5 |
| 语言 | TypeScript 5 |
| 构建 | Vite 6 + vite-plugin-electron |
| Excel 处理 | exceljs |
| YAML 处理 | js-yaml |
| 文件监控 | mtime 轮询 + lsof/exclusive-open |
| 测试 | Vitest + v8 coverage |
| 代码质量 | ESLint + Prettier |
| 打包 | electron-builder |

## 文档

- [数据配置指南](doc/data-config-guide.md) — 5 行表头格式、数据类型、数组与结构体定义
- [架构设计](doc/architecture.md) — 项目结构、模块划分、文件监控机制
- [开发指南](doc/development.md) — 开发环境搭建、构建打包、添加新功能

## 许可证

MIT
