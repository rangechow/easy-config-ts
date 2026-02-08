import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractExcelInfo, formatExcelInfo, logExcelInfo } from '../../src/main/convert/extractor';

describe('extractExcelInfo', () => {
  it('extracts info from a simple Excel file', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Sheet1');
    ws.getCell(1, 1).value = 'hello';
    ws.getCell(1, 2).value = 'world';
    ws.getCell(2, 1).value = 123;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-extractor-'));
    const filePath = path.join(tmpDir, 'test.xlsx');
    await workbook.xlsx.writeFile(filePath);

    const info = await extractExcelInfo(filePath);
    expect(info.fileName).toBe('test.xlsx');
    expect(info.filePath).toBe(filePath);
    expect(info.sheetCount).toBe(1);
    expect(info.sheetNames).toEqual(['Sheet1']);
    expect(info.sheetDetails.length).toBe(1);
    expect(info.sheetDetails[0].name).toBe('Sheet1');
    expect(info.sheetDetails[0].cellCount).toBe(3);
    expect(info.sheetDetails[0].hasData).toBe(true);
    expect(info.totalRows).toBeGreaterThan(0);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('handles multiple sheets', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws1 = workbook.addWorksheet('DATA_CONF');
    ws1.getCell(1, 1).value = 'a';
    const ws2 = workbook.addWorksheet('OTHER');
    ws2.getCell(1, 1).value = 'b';

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easyconfig-extractor-'));
    const filePath = path.join(tmpDir, 'multi.xlsx');
    await workbook.xlsx.writeFile(filePath);

    const info = await extractExcelInfo(filePath);
    expect(info.sheetCount).toBe(2);
    expect(info.sheetNames).toEqual(['DATA_CONF', 'OTHER']);

    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('formatExcelInfo', () => {
  it('formats info as readable string', () => {
    const info = {
      filePath: '/data/test.xlsx',
      fileName: 'test.xlsx',
      sheetCount: 1,
      sheetNames: ['Sheet1'],
      sheetDetails: [
        {
          name: 'Sheet1',
          rowCount: 10,
          colCount: 5,
          cellCount: 50,
          hasData: true,
        },
      ],
      totalRows: 10,
      totalCols: 5,
      extractedTime: new Date('2025-01-01T00:00:00Z'),
    };

    const result = formatExcelInfo(info);
    expect(result).toContain('test.xlsx');
    expect(result).toContain('Total Sheets: 1');
    expect(result).toContain('Total Rows: 10');
    expect(result).toContain('Sheet: Sheet1');
    expect(result).toContain('Cells: 50');
  });
});

describe('logExcelInfo', () => {
  it('calls logFunc with formatted info', () => {
    const info = {
      filePath: '/data/test.xlsx',
      fileName: 'test.xlsx',
      sheetCount: 1,
      sheetNames: ['Sheet1'],
      sheetDetails: [
        {
          name: 'Sheet1',
          rowCount: 5,
          colCount: 3,
          cellCount: 15,
          hasData: true,
        },
      ],
      totalRows: 5,
      totalCols: 3,
      extractedTime: new Date(),
    };

    const calls: string[] = [];
    const logFunc = (_dir: string, msg: string) => {
      calls.push(msg);
    };

    logExcelInfo(info, logFunc);

    expect(calls.length).toBe(3); // header + summary + 1 sheet detail
    expect(calls[0]).toContain('test.xlsx');
    expect(calls[1]).toContain('Sheets: 1');
    expect(calls[2]).toContain("Sheet 'Sheet1'");
  });
});
