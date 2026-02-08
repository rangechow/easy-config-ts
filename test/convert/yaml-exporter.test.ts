import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { parseColumnStructure, calculateMemberColumns, exportToYAML } from '../../src/main/convert/yaml-exporter';

describe('parseColumnStructure', () => {
  it('parses basic columns', () => {
    const row1 = ['required', 'optional', 'optional'];
    const row2 = ['uint32', 'string', 'int32'];
    const row3 = ['id', 'name', 'level'];
    const row4 = ['b', 'b', 'b'];

    const columns = parseColumnStructure(row1, row2, row3, row4, 'TEST_CONF');
    expect(columns.length).toBe(3);

    expect(columns[0].name).toBe('id');
    expect(columns[0].constraint).toBe('required');
    expect(columns[0].isStruct).toBe(false);
    expect(columns[0].isRepeated).toBe(false);

    expect(columns[1].name).toBe('name');
    expect(columns[2].name).toBe('level');
  });

  it('parses repeated scalar field', () => {
    const row1 = ['required', 'repeated'];
    const row2 = ['uint32', 'uint32'];
    const row3 = ['id', 'tags'];
    const row4 = ['b', 'b'];

    const columns = parseColumnStructure(row1, row2, row3, row4, 'TEST_CONF');
    expect(columns.length).toBe(2);
    expect(columns[1].name).toBe('tags');
    expect(columns[1].isRepeated).toBe(true);
    expect(columns[1].isStruct).toBe(false);
  });

  it('parses struct type', () => {
    const row1 = ['required', 'struct', '', ''];
    const row2 = ['uint32', '2', 'string', 'int32'];
    const row3 = ['id', 'info', 'info_name', 'info_count'];
    const row4 = ['b', 'b', 'b', 'b'];

    const columns = parseColumnStructure(row1, row2, row3, row4, 'TEST_CONF');
    expect(columns.length).toBe(2);
    expect(columns[1].isStruct).toBe(true);
    expect(columns[1].isRepeated).toBe(false);
    expect(columns[1].structInfo).not.toBeNull();
    expect(columns[1].structInfo!.members.length).toBe(2);
    expect(columns[1].structInfo!.members[0].name).toBe('info_name');
    expect(columns[1].structInfo!.members[1].name).toBe('info_count');
  });

  it('parses repeated + struct combo', () => {
    const row1 = ['required', 'repeated', 'struct', '', ''];
    const row2 = ['uint32', '1', '2', 'string', 'int32'];
    const row3 = ['id', 'rewards', 'reward_detail', 'reward_type', 'reward_count'];
    const row4 = ['b', 'b', 'b', 'b', 'b'];

    const columns = parseColumnStructure(row1, row2, row3, row4, 'TEST_CONF');
    expect(columns.length).toBe(2);
    expect(columns[1].isStruct).toBe(true);
    expect(columns[1].isRepeated).toBe(true);
    expect(columns[1].structInfo!.repeatCount).toBe(1);
    expect(columns[1].structInfo!.members.length).toBe(2);
  });

  it('skips empty param names', () => {
    const row1 = ['required', '', 'optional'];
    const row2 = ['uint32', '', 'string'];
    const row3 = ['id', '', 'name'];
    const row4 = ['b', '', 'b'];

    const columns = parseColumnStructure(row1, row2, row3, row4, 'TEST_CONF');
    expect(columns.length).toBe(2);
    expect(columns[0].name).toBe('id');
    expect(columns[1].name).toBe('name');
  });

  it('skips * markers', () => {
    const row1 = ['required', '*', 'optional'];
    const row2 = ['uint32', '*', 'string'];
    const row3 = ['id', 'skip', 'name'];
    const row4 = ['b', '*', 'b'];

    const columns = parseColumnStructure(row1, row2, row3, row4, 'TEST_CONF');
    expect(columns.length).toBe(2);
  });
});

describe('calculateMemberColumns', () => {
  it('counts simple members', () => {
    const members = [
      {
        index: 0,
        name: 'a',
        constraint: 'optional',
        dataType: 'string',
        isStruct: false,
        isRepeated: false,
        structInfo: null,
      },
      {
        index: 1,
        name: 'b',
        constraint: 'optional',
        dataType: 'int32',
        isStruct: false,
        isRepeated: false,
        structInfo: null,
      },
    ];
    expect(calculateMemberColumns(members)).toBe(2);
  });

  it('counts struct members recursively', () => {
    const members = [
      {
        index: 0,
        name: 'nested',
        constraint: 'optional',
        dataType: 'struct',
        isStruct: true,
        isRepeated: false,
        structInfo: {
          name: 'nested',
          memberCount: 2,
          repeatCount: 1,
          members: [
            {
              index: 1,
              name: 'x',
              constraint: 'optional',
              dataType: 'int32',
              isStruct: false,
              isRepeated: false,
              structInfo: null,
            },
            {
              index: 2,
              name: 'y',
              constraint: 'optional',
              dataType: 'int32',
              isStruct: false,
              isRepeated: false,
              structInfo: null,
            },
          ],
        },
      },
    ];
    // 1 (struct header) + 2 (members) = 3
    expect(calculateMemberColumns(members)).toBe(3);
  });
});

describe('exportToYAML', () => {
  it('exports basic sheet to YAML', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('ITEM_CONF');

    // 5-row header
    const headers = [
      ['required', 'optional', 'optional'],
      ['uint32', 'string', 'int32'],
      ['id', 'name', 'price'],
      ['b', 'b', 'b'],
      ['道具ID', '名称', '价格'],
    ];
    for (let r = 0; r < headers.length; r++) {
      for (let c = 0; c < headers[r].length; c++) {
        ws.getCell(r + 1, c + 1).value = headers[r][c];
      }
    }

    // Data rows
    ws.getCell(6, 1).value = 1001;
    ws.getCell(6, 2).value = '剑';
    ws.getCell(6, 3).value = 100;
    ws.getCell(7, 1).value = 1002;
    ws.getCell(7, 2).value = '盾';
    ws.getCell(7, 3).value = 200;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-yaml-'));
    const excelPath = path.join(tmpDir, 'items.xlsx');
    await workbook.xlsx.writeFile(excelPath);

    const result = await exportToYAML(excelPath, tmpDir);
    expect(result).toContain('item_conf.yaml');

    const yamlContent = fs.readFileSync(path.join(tmpDir, 'item_conf.yaml'), 'utf-8');
    const parsed = yaml.load(yamlContent) as { sheet_name: string; data: Record<string, unknown>[] };
    expect(parsed.sheet_name).toBe('ITEM_CONF');
    expect(parsed.data.length).toBe(2);
    expect(parsed.data[0].id).toBe(1001);
    expect(parsed.data[0].name).toBe('剑');
    expect(parsed.data[0].price).toBe(100);

    fs.rmSync(tmpDir, { recursive: true });
  });
});
