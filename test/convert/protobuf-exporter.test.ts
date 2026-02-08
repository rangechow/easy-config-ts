import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { validateDataType, parseExcelToProtobuf, generateProtoFile } from '../../src/main/convert/protobuf-exporter';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Helper to create an in-memory Excel workbook with given header rows and data
async function createTestExcel(sheetName: string, headerRows: string[][], dataRows: string[][] = []): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);

  for (let rowIdx = 0; rowIdx < headerRows.length; rowIdx++) {
    const row = headerRows[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      ws.getCell(rowIdx + 1, colIdx + 1).value = row[colIdx];
    }
  }

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      ws.getCell(headerRows.length + rowIdx + 1, colIdx + 1).value = row[colIdx];
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-test-'));
  const filePath = path.join(tmpDir, 'test.xlsx');
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

describe('validateDataType', () => {
  it('accepts standard protobuf types', () => {
    const types = [
      'int32',
      'int64',
      'uint32',
      'uint64',
      'sint32',
      'sint64',
      'fixed32',
      'fixed64',
      'sfixed32',
      'sfixed64',
      'float',
      'double',
      'bool',
      'string',
      'bytes',
    ];
    for (const t of types) {
      expect(() => validateDataType(t)).not.toThrow();
    }
  });

  it('accepts numeric types (array length)', () => {
    expect(() => validateDataType('3')).not.toThrow();
    expect(() => validateDataType('10')).not.toThrow();
  });

  it('accepts enum types', () => {
    expect(() => validateDataType('enum.ItemType')).not.toThrow();
    expect(() => validateDataType('enum.Monster_Type')).not.toThrow();
  });

  it('rejects invalid enum types', () => {
    expect(() => validateDataType('enum.')).toThrow('枚举类型格式错误');
    expect(() => validateDataType('enum.123invalid')).toThrow('枚举类型名不合法');
  });

  it('accepts custom time types', () => {
    expect(() => validateDataType('DateTime')).not.toThrow();
    expect(() => validateDataType('TimeDuration')).not.toThrow();
  });

  it('rejects empty type', () => {
    expect(() => validateDataType('')).toThrow('数据类型不能为空');
    expect(() => validateDataType('  ')).toThrow('数据类型不能为空');
  });

  it('rejects unsupported types', () => {
    expect(() => validateDataType('map')).toThrow('不支持的数据类型');
    expect(() => validateDataType('unknown_type')).toThrow('不支持的数据类型');
  });

  it('is case-insensitive for standard types', () => {
    expect(() => validateDataType('INT32')).not.toThrow();
    expect(() => validateDataType('String')).not.toThrow();
    expect(() => validateDataType('BOOL')).not.toThrow();
  });
});

describe('parseExcelToProtobuf', () => {
  it('parses a simple sheet with basic fields', async () => {
    const filePath = await createTestExcel('MONSTER_CONF', [
      ['required', 'optional', 'optional'],
      ['uint32', 'string', 'int32'],
      ['id', 'name', 'level'],
      ['b', 'b', 'b'],
      ['唯一ID', '名称', '等级'],
    ]);

    const messages = await parseExcelToProtobuf(filePath);
    expect(messages.length).toBe(1);

    const msg = messages[0];
    expect(msg.name).toBe('MonsterConfig');
    expect(msg.fields.length).toBe(3);

    expect(msg.fields[0].name).toBe('id');
    expect(msg.fields[0].dataType).toBe('uint32');
    expect(msg.fields[0].constraint).toBe('required');

    expect(msg.fields[1].name).toBe('name');
    expect(msg.fields[1].dataType).toBe('string');
    expect(msg.fields[1].constraint).toBe('optional');

    expect(msg.fields[2].name).toBe('level');
    expect(msg.fields[2].dataType).toBe('int32');

    // Cleanup
    fs.rmSync(path.dirname(filePath), { recursive: true });
  });

  it('skips non-_CONF sheets', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws1 = workbook.addWorksheet('README');
    ws1.getCell(1, 1).value = 'This is a readme';

    const ws2 = workbook.addWorksheet('TASK_CONF');
    const headers = [
      ['required', 'optional'],
      ['uint32', 'string'],
      ['id', 'name'],
      ['b', 'b'],
      ['任务ID', '名称'],
    ];
    for (let r = 0; r < headers.length; r++) {
      for (let c = 0; c < headers[r].length; c++) {
        ws2.getCell(r + 1, c + 1).value = headers[r][c];
      }
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-test-'));
    const filePath = path.join(tmpDir, 'multi.xlsx');
    await workbook.xlsx.writeFile(filePath);

    const messages = await parseExcelToProtobuf(filePath);
    expect(messages.length).toBe(1);
    expect(messages[0].name).toBe('TaskConfig');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('parses repeated fields', async () => {
    const filePath = await createTestExcel('SKILL_CONF', [
      ['required', 'repeated'],
      ['uint32', 'uint32'],
      ['id', 'tag_ids'],
      ['b', 'b'],
      ['技能ID', '标签列表'],
    ]);

    const messages = await parseExcelToProtobuf(filePath);
    expect(messages[0].fields[1].constraint).toBe('repeated');
    expect(messages[0].fields[1].name).toBe('tag_ids');
    expect(messages[0].fields[1].dataType).toBe('uint32');

    fs.rmSync(path.dirname(filePath), { recursive: true });
  });

  it('parses struct fields with nested messages', async () => {
    // repeated + struct combo
    const filePath = await createTestExcel('TASK_CONF', [
      ['required', 'repeated', 'struct', 'optional_struct', 'optional_struct'],
      ['uint32', '2', '2', 'string', 'int32'],
      ['id', 'rewards', 'reward_info', 'reward_type', 'reward_count'],
      ['b', 'b', 'b', 'b', 'b'],
      ['任务ID', '奖励列表', '奖励信息', '奖励类型', '奖励数量'],
    ]);

    const messages = await parseExcelToProtobuf(filePath);
    expect(messages.length).toBe(1);

    const msg = messages[0];
    // Should have nested message
    expect(msg.nestedMessages.length).toBeGreaterThan(0);
    // rewards field should be repeated
    const rewardsField = msg.fields.find((f) => f.name === 'rewards');
    expect(rewardsField).toBeDefined();
    expect(rewardsField!.constraint).toBe('repeated');
    expect(rewardsField!.isStruct).toBe(true);

    fs.rmSync(path.dirname(filePath), { recursive: true });
  });
});

describe('generateProtoFile', () => {
  it('generates valid proto3 content', () => {
    const messages = [
      {
        name: 'MonsterConfig',
        fields: [
          {
            constraint: 'required',
            dataType: 'uint32',
            name: 'id',
            tag: 1,
            comment: '',
            exportType: 'both',
            isStruct: false,
          },
          {
            constraint: 'optional',
            dataType: 'string',
            name: 'name',
            tag: 2,
            comment: '',
            exportType: 'both',
            isStruct: false,
          },
        ],
        nestedMessages: [],
      },
    ];

    const content = generateProtoFile(messages);
    expect(content).toContain('syntax = "proto3"');
    expect(content).toContain('package dataconfig');
    expect(content).toContain('message MonsterConfig');
    expect(content).toContain('uint32 id = 1;');
    expect(content).toContain('optional string name = 2;');
  });

  it('generates nested messages', () => {
    const messages = [
      {
        name: 'TaskConfig',
        fields: [
          {
            constraint: 'required',
            dataType: 'uint32',
            name: 'id',
            tag: 1,
            comment: '',
            exportType: 'both',
            isStruct: false,
          },
          {
            constraint: 'repeated',
            dataType: 'RewardInfo',
            name: 'rewards',
            tag: 2,
            comment: '',
            exportType: 'both',
            isStruct: true,
          },
        ],
        nestedMessages: [
          {
            name: 'RewardInfo',
            fields: [
              {
                constraint: 'optional',
                dataType: 'string',
                name: 'type',
                tag: 1,
                comment: '',
                exportType: 'both',
                isStruct: false,
              },
              {
                constraint: 'optional',
                dataType: 'int32',
                name: 'count',
                tag: 2,
                comment: '',
                exportType: 'both',
                isStruct: false,
              },
            ],
            nestedMessages: [],
          },
        ],
      },
    ];

    const content = generateProtoFile(messages);
    expect(content).toContain('message TaskConfig');
    expect(content).toContain('message RewardInfo');
    expect(content).toContain('repeated RewardInfo rewards = 2;');
  });
});
