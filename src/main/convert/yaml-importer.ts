import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { parseColumnStructure, calculateMemberColumns, ColumnInfo } from './yaml-exporter';
import { HEADER_ROW_COUNT, DATA_ROW_START, SHEET_NAME_SUFFIX, YAML_EXTENSION } from '../../shared/constants';

// ---- Types ----

interface YAMLData {
  sheet_name: string;
  data: Record<string, unknown>[];
}

// ---- Helpers ----

function getSheetRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: string[] = [];
    for (let col = 1; col <= ws.columnCount; col++) {
      const cell = row.getCell(col);
      values.push(cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    rows.push(values);
  });
  return rows;
}

/** Get ID value from a row data map for sorting */
function getIDValue(rowData: Record<string, unknown>): number {
  const idFields = ['id', 'Id', 'ID', 'iD'];
  for (const field of idFields) {
    const value = rowData[field];
    if (value !== undefined) {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const n = parseInt(value, 10);
        if (!isNaN(n)) return n;
      }
    }
  }
  return 0;
}

/** Sort data by ID field */
function sortDataByID(data: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...data].sort((a, b) => getIDValue(a) - getIDValue(b));
}

// ---- Write helpers ----

function writeRepeatedStructToExcel(
  ws: ExcelJS.Worksheet,
  rowIdx: number,
  startCol: number,
  col: ColumnInfo,
  value: unknown,
): number {
  let colOffset = startCol;
  colOffset++; // repeated column
  colOffset++; // struct column

  const structList = Array.isArray(value) ? value : [];
  if (!Array.isArray(value)) {
    console.warn(`Warning: expected array for repeated struct field '${col.name}', got ${typeof value}`);
    if (col.structInfo) {
      const memberColumns = calculateMemberColumns(col.structInfo.members);
      colOffset += col.structInfo.repeatCount * memberColumns;
    }
    return colOffset;
  }

  for (let groupIdx = 0; groupIdx < col.structInfo!.repeatCount; groupIdx++) {
    if (groupIdx < structList.length) {
      const structData = structList[groupIdx] as Record<string, unknown> | undefined;
      if (!structData || typeof structData !== 'object') {
        const memberColumns = calculateMemberColumns(col.structInfo!.members);
        colOffset += memberColumns;
        continue;
      }

      for (const member of col.structInfo!.members) {
        const memberValue = structData[member.name];
        if (memberValue === undefined) {
          colOffset++;
          continue;
        }

        if (member.isStruct) {
          if (member.isRepeated) {
            colOffset = writeRepeatedStructToExcel(ws, rowIdx, colOffset, member, memberValue);
          } else {
            colOffset = writeStructToExcel(ws, rowIdx, colOffset, member, memberValue);
          }
        } else if (member.isRepeated) {
          colOffset = writeRepeatedValueToExcel(ws, rowIdx, colOffset, memberValue);
        } else {
          ws.getCell(rowIdx, colOffset + 1).value = memberValue as ExcelJS.CellValue;
          colOffset++;
        }
      }
    } else {
      const memberColumns = calculateMemberColumns(col.structInfo!.members);
      colOffset += memberColumns;
    }
  }

  return colOffset;
}

function writeStructToExcel(
  ws: ExcelJS.Worksheet,
  rowIdx: number,
  startCol: number,
  col: ColumnInfo,
  value: unknown,
): number {
  let colOffset = startCol;
  colOffset++; // struct column

  const structData = value as Record<string, unknown> | undefined;
  if (!structData || typeof structData !== 'object') {
    console.warn(`Warning: expected map for struct field '${col.name}', got ${typeof value}`);
    if (col.structInfo) {
      const memberColumns = calculateMemberColumns(col.structInfo.members);
      colOffset += memberColumns;
    }
    return colOffset;
  }

  for (const member of col.structInfo!.members) {
    const memberValue = structData[member.name];
    if (memberValue === undefined) {
      colOffset++;
      continue;
    }

    if (member.isStruct) {
      if (member.isRepeated) {
        colOffset = writeRepeatedStructToExcel(ws, rowIdx, colOffset, member, memberValue);
      } else {
        colOffset = writeStructToExcel(ws, rowIdx, colOffset, member, memberValue);
      }
    } else if (member.isRepeated) {
      colOffset = writeRepeatedValueToExcel(ws, rowIdx, colOffset, memberValue);
    } else {
      ws.getCell(rowIdx, colOffset + 1).value = memberValue as ExcelJS.CellValue;
      colOffset++;
    }
  }

  return colOffset;
}

function writeRepeatedValueToExcel(ws: ExcelJS.Worksheet, rowIdx: number, startCol: number, value: unknown): number {
  let colOffset = startCol;
  colOffset++; // repeated column

  const valueList = Array.isArray(value) ? value : [];
  if (!Array.isArray(value)) {
    console.warn(`Warning: expected array for repeated field, got ${typeof value}`);
    return colOffset;
  }

  for (const v of valueList) {
    ws.getCell(rowIdx, colOffset + 1).value = v as ExcelJS.CellValue;
    colOffset++;
  }

  return colOffset;
}

// ---- Public API ----

/** Import YAML data into an Excel file */
export async function importYAMLToExcel(excelPath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const excelDir = path.dirname(excelPath);
  let hasImported = false;

  for (const ws of workbook.worksheets) {
    if (!ws.name.endsWith(SHEET_NAME_SUFFIX)) {
      console.log(`Skipping sheet '${ws.name}' (does not end with ${SHEET_NAME_SUFFIX})`);
      continue;
    }

    // Find corresponding YAML file
    const yamlFileName = ws.name.toLowerCase() + YAML_EXTENSION;
    const yamlPath = path.join(excelDir, yamlFileName);

    if (!fs.existsSync(yamlPath)) {
      console.log(`YAML file not found for sheet '${ws.name}': ${yamlPath}`);
      continue;
    }

    // Read and parse YAML
    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
    const yamlData = yaml.load(yamlContent) as YAMLData;

    if (!yamlData?.data || yamlData.data.length === 0) {
      console.log(`No data in YAML file: ${yamlPath}`);
      continue;
    }

    // Parse header structure
    const rows = getSheetRows(ws);
    if (rows.length < HEADER_ROW_COUNT) {
      throw new Error(`Sheet ${ws.name} has less than ${HEADER_ROW_COUNT} header rows`);
    }

    const columns = parseColumnStructure(rows[0], rows[1], rows[2], rows[3], ws.name);

    // Sort data by ID
    const sortedData = sortDataByID(yamlData.data);

    // Remove existing data rows (keep header rows)
    const maxRow = ws.rowCount;
    if (maxRow > HEADER_ROW_COUNT) {
      for (let rowIdx = maxRow; rowIdx > HEADER_ROW_COUNT; rowIdx--) {
        ws.spliceRows(rowIdx, 1);
      }
    }

    // Write data starting from row 6
    for (let dataIdx = 0; dataIdx < sortedData.length; dataIdx++) {
      const rowData = sortedData[dataIdx];
      const rowIdx = dataIdx + DATA_ROW_START;
      let colOffset = 0;

      for (const col of columns) {
        const value = rowData[col.name];
        if (value === undefined) {
          colOffset++;
          continue;
        }

        if (col.isStruct) {
          if (col.isRepeated) {
            colOffset = writeRepeatedStructToExcel(ws, rowIdx, colOffset, col, value);
          } else {
            colOffset = writeStructToExcel(ws, rowIdx, colOffset, col, value);
          }
        } else if (col.isRepeated) {
          colOffset = writeRepeatedValueToExcel(ws, rowIdx, colOffset, value);
        } else {
          ws.getCell(rowIdx, colOffset + 1).value = value as ExcelJS.CellValue;
          colOffset++;
        }
      }
    }

    console.log(`Successfully imported YAML data to sheet: ${ws.name}`);
    hasImported = true;
  }

  if (hasImported) {
    await workbook.xlsx.writeFile(excelPath);
    console.log(`Excel file saved: ${excelPath}`);
  } else {
    console.log('No YAML files found to import');
  }
}
