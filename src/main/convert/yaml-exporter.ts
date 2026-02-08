import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { HEADER_ROW_COUNT, DATA_ROW_START, SHEET_NAME_SUFFIX, YAML_EXTENSION } from '../../shared/constants';

// ---- Types ----

export interface ColumnInfo {
  index: number;
  name: string;
  constraint: string;
  dataType: string;
  isStruct: boolean;
  isRepeated: boolean;
  structInfo: StructInfo | null;
}

export interface StructInfo {
  name: string;
  memberCount: number;
  repeatCount: number;
  members: ColumnInfo[];
}

interface YAMLData {
  sheet_name: string;
  data: Record<string, unknown>[];
}

// ---- Helpers ----

function getCellStr(row: string[], index: number): string {
  if (index >= row.length) return '';
  return (row[index] ?? '').trim();
}

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

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '');
}

/** Parse cell value, auto-convert to int/float/bool */
function parseCellValue(value: string): unknown {
  if (value === '') return '';

  // Try integer
  if (/^-?\d+$/.test(value)) {
    const n = parseInt(value, 10);
    if (!isNaN(n)) return n;
  }

  // Try float
  if (/^-?\d+\.\d+$/.test(value)) {
    const f = parseFloat(value);
    if (!isNaN(f)) return f;
  }

  // Try boolean
  const lower = value.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;

  return value;
}

/** Calculate total columns occupied by members (recursive) */
export function calculateMemberColumns(members: ColumnInfo[]): number {
  let total = 0;
  for (const member of members) {
    if (member.isStruct) {
      if (member.isRepeated) {
        const nestedCols = calculateMemberColumns(member.structInfo!.members);
        total += 1 + 1 + member.structInfo!.repeatCount * nestedCols; // repeated + struct + data
      } else {
        const nestedCols = calculateMemberColumns(member.structInfo!.members);
        total += 1 + nestedCols; // struct + members
      }
    } else {
      total++;
    }
  }
  return total;
}

// ---- Column structure parsing ----

function parseStructInfo(
  row1: string[],
  row2: string[],
  row3: string[],
  row4: string[],
  structColIdx: number,
  memberCount: number,
  repeatCount: number,
  sheetName: string,
): { structInfo: StructInfo; nextColIdx: number } {
  const structName = getCellStr(row3, structColIdx);

  const structInfo: StructInfo = {
    name: structName,
    memberCount,
    repeatCount,
    members: [],
  };

  let colIdx = structColIdx + 1;

  for (let i = 0; i < memberCount && colIdx < row3.length; i++) {
    if (colIdx >= row3.length || getCellStr(row3, colIdx) === '') {
      colIdx++;
      continue;
    }

    const constraint = getCellStr(row1, colIdx);
    const dataType = getCellStr(row2, colIdx);

    if (constraint === '*' || dataType === '*') {
      colIdx++;
      i--;
      continue;
    }

    const paramName = getCellStr(row3, colIdx);

    // Nested struct
    if (constraint === 'struct') {
      const nestedMemberCount = parseInt(dataType, 10);
      if (!nestedMemberCount || nestedMemberCount <= 0) {
        throw new Error(
          `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] (嵌套struct) 成员变量个数必须大于0，当前值: ${dataType}`,
        );
      }

      const result = parseStructInfo(row1, row2, row3, row4, colIdx, nestedMemberCount, 1, sheetName);
      structInfo.members.push({
        index: colIdx,
        name: paramName,
        constraint: 'optional',
        dataType: 'struct',
        isStruct: true,
        isRepeated: false,
        structInfo: result.structInfo,
      });
      colIdx = result.nextColIdx;
      continue;
    }

    // Repeated + struct
    if (constraint === 'repeated') {
      const nextColIdx = colIdx + 1;
      if (nextColIdx < row1.length && getCellStr(row1, nextColIdx) === 'struct') {
        const nestedRepeatCount = parseInt(dataType, 10);
        if (!nestedRepeatCount || nestedRepeatCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] (嵌套repeated) 个数必须大于0，当前值: ${dataType}`,
          );
        }

        const structDataType = getCellStr(row2, nextColIdx);
        const nestedMemberCount = parseInt(structDataType, 10);
        if (!nestedMemberCount || nestedMemberCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${nextColIdx + 1}列 [${paramName}] (嵌套repeated struct) 成员变量个数必须大于0`,
          );
        }

        const result = parseStructInfo(
          row1,
          row2,
          row3,
          row4,
          nextColIdx,
          nestedMemberCount,
          nestedRepeatCount,
          sheetName,
        );
        structInfo.members.push({
          index: colIdx,
          name: paramName,
          constraint: 'repeated',
          dataType: 'struct',
          isStruct: true,
          isRepeated: true,
          structInfo: result.structInfo,
        });

        const firstGroupColumns = result.nextColIdx - nextColIdx;
        const memberColumns = firstGroupColumns - 1;
        const remainingGroups = nestedRepeatCount - 1;
        const totalColumnsToSkip = 1 + firstGroupColumns + remainingGroups * memberColumns;
        colIdx = colIdx + totalColumnsToSkip;
        i--;
        continue;
      }
    }

    // Regular field
    structInfo.members.push({
      index: colIdx,
      name: paramName,
      constraint,
      dataType,
      isStruct: false,
      isRepeated: constraint === 'repeated',
      structInfo: null,
    });
    colIdx++;
  }

  return { structInfo, nextColIdx: colIdx };
}

export function parseColumnStructure(
  row1: string[],
  row2: string[],
  row3: string[],
  row4: string[],
  sheetName: string,
): ColumnInfo[] {
  const columns: ColumnInfo[] = [];

  for (let colIdx = 0; colIdx < row3.length; colIdx++) {
    if (getCellStr(row3, colIdx) === '') continue;

    const constraint = getCellStr(row1, colIdx);
    const dataType = getCellStr(row2, colIdx);

    if (constraint === '*' || dataType === '*') continue;

    const paramName = getCellStr(row3, colIdx);

    // Struct type
    if (constraint === 'struct') {
      const memberCount = parseInt(dataType, 10);
      if (!memberCount || memberCount <= 0) {
        throw new Error(
          `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] struct成员变量个数必须大于0，当前值: ${dataType}`,
        );
      }

      const result = parseStructInfo(row1, row2, row3, row4, colIdx, memberCount, 1, sheetName);
      columns.push({
        index: colIdx,
        name: paramName,
        constraint: 'optional',
        dataType: 'struct',
        isStruct: true,
        isRepeated: false,
        structInfo: result.structInfo,
      });
      colIdx = result.nextColIdx - 1;
      continue;
    }

    // Repeated + struct
    if (constraint === 'repeated') {
      const nextColIdx = colIdx + 1;
      if (nextColIdx < row1.length && getCellStr(row1, nextColIdx) === 'struct') {
        const repeatCount = parseInt(dataType, 10);
        if (!repeatCount || repeatCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] repeated个数必须大于0，当前值: ${dataType}`,
          );
        }

        const structColIdx = nextColIdx;
        const structDataType = getCellStr(row2, structColIdx);
        const structParamName = getCellStr(row3, structColIdx);
        const memberCount = parseInt(structDataType, 10);
        if (!memberCount || memberCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${structColIdx + 1}列 [${structParamName}] struct成员变量个数必须大于0，当前值: ${structDataType}`,
          );
        }

        const result = parseStructInfo(row1, row2, row3, row4, structColIdx, memberCount, repeatCount, sheetName);
        columns.push({
          index: colIdx,
          name: paramName,
          constraint: 'repeated',
          dataType: 'struct',
          isStruct: true,
          isRepeated: true,
          structInfo: result.structInfo,
        });

        const firstGroupColumns = result.nextColIdx - structColIdx;
        const memberColumns = firstGroupColumns - 1;
        const remainingGroups = repeatCount - 1;
        const totalColumnsToSkip = 1 + firstGroupColumns + remainingGroups * memberColumns;
        colIdx = colIdx + totalColumnsToSkip - 1;
        continue;
      }
    }

    // Regular field
    columns.push({
      index: colIdx,
      name: paramName,
      constraint,
      dataType,
      isStruct: false,
      isRepeated: constraint === 'repeated',
      structInfo: null,
    });
  }

  return columns;
}

// ---- Row data parsing ----

function parseStructData(row: string[], structInfo: StructInfo, startColIdx: number): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let colIdx = startColIdx;

  for (const member of structInfo.members) {
    if (member.isStruct) {
      if (member.isRepeated) {
        // Nested repeated struct
        const nestedArray: Record<string, unknown>[] = [];
        const nestedRepeatCount = member.structInfo!.repeatCount;
        const nestedMemberColumns = calculateMemberColumns(member.structInfo!.members);

        let nestedStartColIdx = colIdx + 1 + 1; // repeated + struct columns
        for (let i = 0; i < nestedRepeatCount; i++) {
          const nestedData = parseStructData(row, member.structInfo!, nestedStartColIdx);
          nestedArray.push(nestedData);
          nestedStartColIdx += nestedMemberColumns;
        }
        data[member.name] = nestedArray;
        const totalColumns = 1 + 1 + nestedRepeatCount * nestedMemberColumns;
        colIdx += totalColumns;
      } else {
        // Nested single struct
        const nestedData = parseStructData(row, member.structInfo!, colIdx + 1);
        data[member.name] = nestedData;
        const nestedMemberColumns = calculateMemberColumns(member.structInfo!.members);
        colIdx += 1 + nestedMemberColumns;
      }
    } else {
      // Regular field
      const cellValue = colIdx < row.length ? parseCellValue(row[colIdx].trim()) : '';
      data[member.name] = cellValue;
      colIdx++;
    }
  }

  return data;
}

function parseRepeatedStructData(row: string[], col: ColumnInfo): Record<string, unknown>[] {
  const structInfo = col.structInfo!;
  const repeatCount = structInfo.repeatCount;
  const memberColumns = calculateMemberColumns(structInfo.members);
  const structArray: Record<string, unknown>[] = [];

  let startColIdx = col.index + 1 + 1; // repeated column + struct column
  for (let i = 0; i < repeatCount; i++) {
    const structData = parseStructData(row, structInfo, startColIdx);
    structArray.push(structData);
    startColIdx += memberColumns;
  }

  return structArray;
}

function parseRowData(row: string[], columns: ColumnInfo[]): Record<string, unknown> {
  const rowData: Record<string, unknown> = {};

  for (const col of columns) {
    if (col.isStruct) {
      if (col.isRepeated) {
        rowData[col.name] = parseRepeatedStructData(row, col);
      } else {
        rowData[col.name] = parseStructData(row, col.structInfo!, col.index + 1);
      }
    } else {
      const cellValue = col.index < row.length ? parseCellValue(row[col.index].trim()) : '';
      rowData[col.name] = cellValue;
    }
  }

  return rowData;
}

// ---- Public API ----

/** Export Excel data to YAML format */
export async function exportToYAML(filePath: string, outputDir: string): Promise<string> {
  console.log(`[YAML Export] Starting YAML export from: ${filePath}`);
  console.log(`[YAML Export] Output directory: ${outputDir}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  fs.mkdirSync(outputDir, { recursive: true });

  const exportedFiles: string[] = [];
  let validSheetCount = 0;

  for (const ws of workbook.worksheets) {
    if (!ws.name.endsWith(SHEET_NAME_SUFFIX)) {
      console.log(`[YAML Export] Skipping sheet '${ws.name}'`);
      continue;
    }

    validSheetCount++;
    console.log(`[YAML Export] Processing sheet ${validSheetCount}: ${ws.name}`);

    const rows = getSheetRows(ws);

    if (rows.length < DATA_ROW_START) {
      throw new Error(`Sheet ${ws.name} has less than ${DATA_ROW_START} rows (${HEADER_ROW_COUNT} header rows + data)`);
    }

    const row1 = rows[0];
    const row2 = rows[1];
    const row3 = rows[2];
    const row4 = rows[3];

    const columns = parseColumnStructure(row1, row2, row3, row4, ws.name);

    // Parse data rows (from row DATA_ROW_START)
    const dataRows: Record<string, unknown>[] = [];
    for (let rowIdx = HEADER_ROW_COUNT; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (isEmptyRow(row)) continue;
      const rowData = parseRowData(row, columns);
      dataRows.push(rowData);
    }

    const yamlData: YAMLData = {
      sheet_name: ws.name,
      data: dataRows,
    };

    const yamlFileName = ws.name.toLowerCase() + YAML_EXTENSION;
    const outputFile = path.join(outputDir, yamlFileName);
    const yamlContent = yaml.dump(yamlData, { lineWidth: -1 });
    fs.writeFileSync(outputFile, yamlContent, 'utf-8');

    console.log(`[YAML Export] Sheet exported: ${ws.name} -> ${yamlFileName}`);
    exportedFiles.push(outputFile);
  }

  if (exportedFiles.length === 0) {
    throw new Error(`No valid ${SHEET_NAME_SUFFIX} sheets found in Excel file`);
  }

  console.log(`[YAML Export] Successfully exported ${exportedFiles.length} YAML files`);
  return exportedFiles[0];
}
