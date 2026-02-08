import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { importYAMLToExcel } from '../../src/main/convert/yaml-importer';

describe('importYAMLToExcel', () => {
  it('imports YAML data into Excel', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-import-'));

    // Create an Excel file with 5-row header
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('ITEM_CONF');
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
    const excelPath = path.join(tmpDir, 'items.xlsx');
    await workbook.xlsx.writeFile(excelPath);

    // Create corresponding YAML file
    const yamlData = {
      sheet_name: 'ITEM_CONF',
      data: [
        { id: 1002, name: '盾', price: 200 },
        { id: 1001, name: '剑', price: 100 },
      ],
    };
    const yamlPath = path.join(tmpDir, 'item_conf.yaml');
    fs.writeFileSync(yamlPath, yaml.dump(yamlData), 'utf-8');

    // Import
    await importYAMLToExcel(excelPath);

    // Verify
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(excelPath);
    const ws2 = wb2.getWorksheet('ITEM_CONF')!;

    // Data should be sorted by ID (1001 before 1002)
    expect(ws2.getCell(6, 1).value).toBe(1001);
    expect(ws2.getCell(6, 2).value).toBe('剑');
    expect(ws2.getCell(6, 3).value).toBe(100);
    expect(ws2.getCell(7, 1).value).toBe(1002);
    expect(ws2.getCell(7, 2).value).toBe('盾');
    expect(ws2.getCell(7, 3).value).toBe(200);

    // Header should be preserved
    expect(ws2.getCell(1, 1).value).toBe('required');
    expect(ws2.getCell(3, 1).value).toBe('id');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('skips sheets without corresponding YAML file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-import-'));

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('TASK_CONF');
    const headers = [
      ['required', 'optional'],
      ['uint32', 'string'],
      ['id', 'name'],
      ['b', 'b'],
      ['ID', '名称'],
    ];
    for (let r = 0; r < headers.length; r++) {
      for (let c = 0; c < headers[r].length; c++) {
        ws.getCell(r + 1, c + 1).value = headers[r][c];
      }
    }
    const excelPath = path.join(tmpDir, 'task.xlsx');
    await workbook.xlsx.writeFile(excelPath);

    // No YAML file created - should not throw
    await expect(importYAMLToExcel(excelPath)).resolves.not.toThrow();

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('replaces existing data rows', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-import-'));

    // Create Excel with existing data
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('ITEM_CONF');
    const headers = [
      ['required', 'optional'],
      ['uint32', 'string'],
      ['id', 'name'],
      ['b', 'b'],
      ['ID', '名称'],
    ];
    for (let r = 0; r < headers.length; r++) {
      for (let c = 0; c < headers[r].length; c++) {
        ws.getCell(r + 1, c + 1).value = headers[r][c];
      }
    }
    // Old data
    ws.getCell(6, 1).value = 9999;
    ws.getCell(6, 2).value = 'old_data';
    ws.getCell(7, 1).value = 8888;
    ws.getCell(7, 2).value = 'old_data_2';

    const excelPath = path.join(tmpDir, 'items.xlsx');
    await workbook.xlsx.writeFile(excelPath);

    // Create YAML with new data
    const yamlData = {
      sheet_name: 'ITEM_CONF',
      data: [{ id: 1, name: 'new_item' }],
    };
    fs.writeFileSync(path.join(tmpDir, 'item_conf.yaml'), yaml.dump(yamlData), 'utf-8');

    await importYAMLToExcel(excelPath);

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(excelPath);
    const ws2 = wb2.getWorksheet('ITEM_CONF')!;

    // New data
    expect(ws2.getCell(6, 1).value).toBe(1);
    expect(ws2.getCell(6, 2).value).toBe('new_item');

    // Old data should be gone (row 7 should be empty or not exist)
    const row7val = ws2.getCell(7, 1).value;
    expect(row7val === null || row7val === undefined).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });
});
