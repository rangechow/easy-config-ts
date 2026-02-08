# 数据配置指南

## 概述

EasyConfig 使用 Excel 管理游戏数据配置。每个配置 Sheet 采用固定的 **5 行表头** 定义数据结构，第 6 行起为数据行。工具会根据表头自动生成 Protobuf 描述文件（`.proto`）和 YAML 数据文件（`.yaml`）。

## Sheet 命名规范

Sheet 名称必须满足以下条件：

- 只包含大写字母和下划线
- 以 `_CONF` 结尾
- 正则：`^[A-Z_]+_CONF$`

合法示例：`MONSTER_CONF`、`TASK_CONF`、`NPC_CONF`、`MAIL_REWARD_CONF`

不符合规范的 Sheet 会被自动跳过，不参与导出。一个 Excel 中可以同时包含多个 `_CONF` Sheet，也可以包含非配置 Sheet（如说明页），互不影响。

## 5 行表头详解

### 第 1 行：约束类型（Constraint）

| 值 | 缩写 | 含义 |
|----|------|------|
| `required` | `r` | 必填字段 |
| `optional` | `o` | 可选字段 |
| `repeated` | `m` | 数组/列表字段 |
| `optional_struct` | `os` | 结构体子字段（可选） |
| `required_struct` | `rs` | 结构体子字段（必填） |

### 第 2 行：数据类型（Data Type）

**整数类型：**

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `uint32` | 无符号 32 位整数 | ID、数量等非负值 |
| `int32` | 有符号 32 位整数 | 等级、坐标等有正负值 |
| `uint64` | 无符号 64 位整数 | 大数值 |
| `int64` | 有符号 64 位整数 | 大数值 |
| `sint32` / `sint64` | ZigZag 编码整数 | 频繁出现负数时更高效 |
| `fixed32` / `fixed64` | 固定长度整数 | 值通常较大时更高效 |
| `sfixed32` / `sfixed64` | 有符号固定长度整数 | 同上 |

**浮点类型：**

| 类型 | 说明 |
|------|------|
| `float` | 单精度浮点数 |
| `double` | 双精度浮点数 |

**其他类型：**

| 类型 | 说明 |
|------|------|
| `string` | 文本字符串 |
| `bool` | 布尔值 |
| `enum.XXX` | 枚举类型（以 `enum.` 开头） |

**特殊类型：**

| 类型 | 说明 |
|------|------|
| `TimeSpan` | 时间跨度 |
| `DateTime` | 日期时间 |
| `AssetPath` | 资源路径 |
| `TimeDuration` | 时间长度 |

**数字：** 当第 2 行填写数字时，表示数组长度或结构体字段数量（见后续数组定义章节）。

### 第 3 行：参数名（Parameter Name）

字段的程序标识名。规则：

- 使用小写字母和下划线，如 `monster_name`、`hp_max`
- 第一列通常为 `id`，作为唯一标识
- 除第一列外，不要使用 `id` 作为参数名
- 名称应体现字段用途

### 第 4 行：导出类型（Export Type）

控制该列数据导出到哪个端：

| 值 | 缩写 | 含义 |
|----|------|------|
| `client` | `c` / `cli` | 仅客户端 |
| `server` | `s` / `svr` | 仅服务端 |
| `both` | `b` / 留空 | 客户端和服务端都导出 |
| `editor` | `e` / `edt` | 编辑器专用，不导出 |

### 第 5 行：中文描述（Description）

该列的说明文字，会作为注释写入 Proto 文件。

---

## 数据结构类型

### 基本字段

最简单的形式，一列对应一个字段。

```
| required | optional | optional |
| uint32   | string   | int32    |
| id       | name     | level    |
| b        | b        | b        |
| 唯一ID   | 名称     | 等级     |
```

生成的 Proto：

```protobuf
message MonsterConfig {
  uint32 id = 1;
  optional string name = 2;
  optional int32 level = 3;
}
```

### 单列数组（Repeated Scalar）

一个单元格内用 `;` 分隔多个值。

**识别条件：**
- 第 1 行 = `repeated`
- 第 2 行 = 非数字的数据类型
- 下一列的第 1 行不以 `_struct` 结尾

```
| repeated |
| uint32   |
| tag_ids  |
| b        |
| 标签列表 |
```

数据填写示例：`101;102;103`

生成的 Proto：

```protobuf
repeated uint32 tag_ids = N;
```

### 多列数组（Repeated Fixed-Length）

多列表示同一数组的不同元素。

**识别条件：**
- 第 1 行 = `repeated`
- 第 2 行 = 数字（表示数组长度）
- 下一列的第 1 行不以 `_struct` 结尾

```
| repeated | (空)  | (空)  |
| 3        | int32 | int32 |
| rewards  | (空)  | (空)  |
| b        | b     | b     |
| 奖励列表 | (空)  | (空)  |
```

第 2 行的 `3` 表示数组固定占 3 列。后续列的第 2 行填写元素类型，第 1/3/5 行留空。

数据填写示例：每列填一个值。

生成的 Proto：

```protobuf
repeated int32 rewards = N;
```

### 结构体数组（Repeated Struct）

每个数组元素是一个多字段的结构体。

**识别条件：**
- 第 1 行 = `repeated`
- 第 2 行 = 数字（数组长度，即结构体重复次数）
- 下一列的第 1 行以 `_struct` 结尾
- 下一列的第 2 行 = 数字（结构体字段数量）

```
| repeated | optional_struct | optional_struct | optional_struct |
| 2        | 3               | string          | int32           |
| rewards  | reward_detail   | reward_type     | reward_count    |
| b        | b               | b               | b               |
| 奖励列表 | 奖励详情        | 奖励类型        | 奖励数量        |
```

解读：
- `rewards` 是一个数组，重复 2 次（占 2 组列）
- 每组是一个结构体，包含 3 个字段：`reward_detail`(父名)、`reward_type`(string)、`reward_count`(int32)
- 结构体的第一个字段（`reward_detail`）的第 2 行是字段数量（3），后续字段的第 2 行是实际类型

生成的 Proto：

```protobuf
message RewardDetail {
  string reward_type = 1;
  int32 reward_count = 2;
}
repeated RewardDetail rewards = N;
```

### 单个结构体（Non-Repeated Struct）

不重复的嵌套结构体，定义方式类似结构体数组但第 1 行不用 `repeated`。

---

## 完整配置示例

### 怪物配置表（MONSTER_CONF）

| 行 | A | B | C | D | E | F | G | H |
|----|---|---|---|---|---|---|---|---|
| 1 | required | optional | optional | optional | optional | repeated | | |
| 2 | uint32 | string | int32 | int32 | float | 3 | uint32 | uint32 |
| 3 | id | name | level | hp | speed | skills | | |
| 4 | b | b | b | s | b | b | b | b |
| 5 | 怪物ID | 怪物名称 | 等级 | 生命值 | 移动速度 | 技能列表 | | |
| 6 | 1001 | 哥布林 | 5 | 100 | 1.2 | 101 | 102 | 103 |
| 7 | 1002 | 兽人 | 10 | 500 | 0.8 | 201 | 202 | 203 |

生成的 `monster_conf.proto`：

```protobuf
syntax = "proto3";

package dataconfig;

// Auto-generated from Excel configuration
// Source sheet: MONSTER_CONF

message MonsterConfig {
  // 怪物ID [both]
  uint32 id = 1;
  // 怪物名称 [both]
  optional string name = 2;
  // 等级 [both]
  optional int32 level = 3;
  // 生命值 [server]
  optional int32 hp = 4;
  // 移动速度 [both]
  optional float speed = 5;
  // 技能列表 [both]
  repeated uint32 skills = 6;
}
```

生成的 `monster_conf.yaml`：

```yaml
sheet_name: MONSTER_CONF
data:
  - id: 1001
    name: 哥布林
    level: 5
    hp: 100
    speed: 1.2
    skills: [101, 102, 103]
  - id: 1002
    name: 兽人
    level: 10
    hp: 500
    speed: 0.8
    skills: [201, 202, 203]
```

### 带结构体数组的任务配置表（TASK_CONF）

| 行 | A | B | C | D | E | F | G | H | I |
|----|---|---|---|---|---|---|---|---|---|
| 1 | required | optional | repeated | optional_struct | optional_struct | optional_struct | optional_struct | optional_struct | optional_struct |
| 2 | uint32 | string | 2 | 3 | string | int32 | 3 | string | int32 |
| 3 | id | name | rewards | reward_info | reward_type | reward_count | reward_info | reward_type | reward_count |
| 4 | b | b | b | b | b | b | b | b | b |
| 5 | 任务ID | 名称 | 奖励列表 | 奖励信息 | 奖励类型 | 奖励数量 | 奖励信息 | 奖励类型 | 奖励数量 |
| 6 | 2001 | 新手任务 | gold | 100 | | exp | 50 | |

---

## 命名转换规则

### Sheet 名 -> Proto 消息名

`_CONF` 后缀去掉，转为 PascalCase 并加 `Config`：

| Sheet 名 | 消息名 |
|-----------|--------|
| `MONSTER_CONF` | `MonsterConfig` |
| `TASK_CONF` | `TaskConfig` |
| `MAIL_REWARD_CONF` | `MailRewardConfig` |

### Sheet 名 -> 文件名

转为小写 snake_case：

| Sheet 名 | Proto 文件 | YAML 文件 |
|-----------|-----------|-----------|
| `MONSTER_CONF` | `monster_conf.proto` | `monster_conf.yaml` |
| `TASK_CONF` | `task_conf.proto` | `task_conf.yaml` |

---

## Proto 语法校验

导出时会自动进行两级校验：

1. **内置校验** — 检查语法声明、花括号匹配、字段标签范围和重复、消息名 PascalCase、字段名 snake_case、数据类型合法性
2. **protoc 校验**（可选）— 如果系统安装了 `protoc`，会调用编译器做二次验证

校验失败时会显示错误提示，不会写入文件。

---

## 注意事项

1. 第一列建议始终为 `required uint32 id`
2. 数据类型选择：整数优先用 `int32`（有正负）或 `uint32`（仅正数），小数用 `float`，布尔值用 `bool`
3. 区分三种数组：单列数组（`;` 分隔）、多列数组（固定长度）、结构体数组（嵌套结构）
4. 导出类型合理设置，避免不必要的数据传输
5. 空数据行会被自动跳过
