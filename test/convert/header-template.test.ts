import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  validateSheetName,
  normalizeExportType,
  normalizeConstraint,
  getDefaultTemplate,
  createHeaderTemplate,
} from '../../src/main/convert/header-template';

describe('validateSheetName', () => {
  it('accepts valid _CONF names', () => {
    expect(validateSheetName('MONSTER_CONF')).toBe(true);
    expect(validateSheetName('TASK_CONF')).toBe(true);
    expect(validateSheetName('NPC_CONF')).toBe(true);
    expect(validateSheetName('MAIL_REWARD_CONF')).toBe(true);
    expect(validateSheetName('A_CONF')).toBe(true);
  });

  it('rejects names not ending with _CONF', () => {
    expect(validateSheetName('MONSTER')).toBe(false);
    expect(validateSheetName('MONSTER_CONFIG')).toBe(false);
    expect(validateSheetName('CONF')).toBe(false);
    expect(validateSheetName('_CONF')).toBe(false);
  });

  it('rejects lowercase names', () => {
    expect(validateSheetName('monster_conf')).toBe(false);
    expect(validateSheetName('Monster_CONF')).toBe(false);
    expect(validateSheetName('monster_CONF')).toBe(false);
  });

  it('rejects names with invalid characters', () => {
    expect(validateSheetName('MONSTER-CONF')).toBe(false);
    expect(validateSheetName('MONSTER CONF')).toBe(false);
    expect(validateSheetName('MONSTER.CONF')).toBe(false);
    expect(validateSheetName('123_CONF')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateSheetName('')).toBe(false);
  });
});

describe('normalizeExportType', () => {
  it('normalizes client variants', () => {
    expect(normalizeExportType('c')).toBe('client');
    expect(normalizeExportType('cli')).toBe('client');
    expect(normalizeExportType('client')).toBe('client');
  });

  it('normalizes server variants', () => {
    expect(normalizeExportType('s')).toBe('server');
    expect(normalizeExportType('svr')).toBe('server');
    expect(normalizeExportType('server')).toBe('server');
  });

  it('normalizes editor variants', () => {
    expect(normalizeExportType('e')).toBe('editor');
    expect(normalizeExportType('edt')).toBe('editor');
    expect(normalizeExportType('editor')).toBe('editor');
  });

  it('normalizes both variants', () => {
    expect(normalizeExportType('')).toBe('both');
    expect(normalizeExportType('b')).toBe('both');
    expect(normalizeExportType('both')).toBe('both');
  });

  it('defaults to both for unknown values', () => {
    expect(normalizeExportType('unknown')).toBe('both');
    expect(normalizeExportType('x')).toBe('both');
  });

  it('handles whitespace and case', () => {
    expect(normalizeExportType('  C  ')).toBe('client');
    expect(normalizeExportType('CLIENT')).toBe('client');
    expect(normalizeExportType(' Server ')).toBe('server');
  });
});

describe('normalizeConstraint', () => {
  it('normalizes required variants', () => {
    expect(normalizeConstraint('required')).toBe('required');
    expect(normalizeConstraint('r')).toBe('required');
  });

  it('normalizes optional variants', () => {
    expect(normalizeConstraint('optional')).toBe('optional');
    expect(normalizeConstraint('o')).toBe('optional');
  });

  it('normalizes repeated variants', () => {
    expect(normalizeConstraint('repeated')).toBe('repeated');
    expect(normalizeConstraint('m')).toBe('repeated');
  });

  it('normalizes struct variants', () => {
    expect(normalizeConstraint('optional_struct')).toBe('optional_struct');
    expect(normalizeConstraint('os')).toBe('optional_struct');
    expect(normalizeConstraint('required_struct')).toBe('required_struct');
    expect(normalizeConstraint('rs')).toBe('required_struct');
  });

  it('defaults to optional for unknown values', () => {
    expect(normalizeConstraint('unknown')).toBe('optional');
    expect(normalizeConstraint('')).toBe('optional');
  });

  it('handles whitespace and case', () => {
    expect(normalizeConstraint('  Required  ')).toBe('required');
    expect(normalizeConstraint('OPTIONAL')).toBe('optional');
  });
});

describe('getDefaultTemplate', () => {
  it('returns a valid template', () => {
    const template = getDefaultTemplate();
    expect(template.sheetName).toBe('EXAMPLE_CONF');
    expect(template.columns.length).toBe(4);
  });

  it('has correct first column (id)', () => {
    const template = getDefaultTemplate();
    const idCol = template.columns[0];
    expect(idCol.row1Constraint).toBe('required');
    expect(idCol.row2DataType).toBe('uint32');
    expect(idCol.row3ParamName).toBe('id');
    expect(idCol.row4ExportType).toBe('b');
  });

  it('returns a new object each call', () => {
    const t1 = getDefaultTemplate();
    const t2 = getDefaultTemplate();
    expect(t1).not.toBe(t2);
    expect(t1).toEqual(t2);
  });
});

describe('createHeaderTemplate', () => {
  it('creates a worksheet with 5-row header', async () => {
    const workbook = new ExcelJS.Workbook();
    const columns = getDefaultTemplate().columns;

    await createHeaderTemplate(workbook, 'TEST_CONF', columns);

    const ws = workbook.getWorksheet('TEST_CONF');
    expect(ws).toBeDefined();

    // Check header values
    expect(ws!.getCell(1, 1).value).toBe('required');
    expect(ws!.getCell(2, 1).value).toBe('uint32');
    expect(ws!.getCell(3, 1).value).toBe('id');
    expect(ws!.getCell(4, 1).value).toBe('b');
    expect(ws!.getCell(5, 1).value).toBe('唯一ID');
  });

  it('throws on invalid sheet name', async () => {
    const workbook = new ExcelJS.Workbook();
    const columns = getDefaultTemplate().columns;

    await expect(createHeaderTemplate(workbook, 'invalid_name', columns)).rejects.toThrow('Invalid sheet name');
  });

  it('removes default Sheet1', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Sheet1');
    const columns = getDefaultTemplate().columns;

    await createHeaderTemplate(workbook, 'TEST_CONF', columns);

    expect(workbook.getWorksheet('Sheet1')).toBeUndefined();
    expect(workbook.getWorksheet('TEST_CONF')).toBeDefined();
  });

  it('sets frozen rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const columns = getDefaultTemplate().columns;

    await createHeaderTemplate(workbook, 'TEST_CONF', columns);

    const ws = workbook.getWorksheet('TEST_CONF')!;
    expect(ws.views.length).toBe(1);
    expect(ws.views[0].ySplit).toBe(5);
    expect(ws.views[0].state).toBe('frozen');
  });
});
