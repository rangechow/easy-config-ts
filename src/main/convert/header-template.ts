import ExcelJS from 'exceljs';

// ---- Types ----

/** Header column definition (5-row header) */
export interface HeaderColumn {
  row1Constraint: string; // Row 1: constraint (required/optional/repeated/struct)
  row2DataType: string; // Row 2: data type or array length
  row3ParamName: string; // Row 3: parameter name
  row4ExportType: string; // Row 4: export type (c/s/e/b)
  row5Description: string; // Row 5: Chinese description
}

/** Sheet template */
export interface SheetTemplate {
  sheetName: string;
  columns: HeaderColumn[];
}

// ---- Validators ----

/** Validate sheet name: must be uppercase letters + underscores, ending with _CONF */
export function validateSheetName(name: string): boolean {
  return /^[A-Z_]+_CONF$/.test(name);
}

/** Normalize export type to standard form */
export function normalizeExportType(exportType: string): string {
  const t = exportType.trim().toLowerCase();
  switch (t) {
    case 'c':
    case 'cli':
    case 'client':
      return 'client';
    case 's':
    case 'svr':
    case 'server':
      return 'server';
    case 'e':
    case 'edt':
    case 'editor':
      return 'editor';
    case '':
    case 'b':
    case 'both':
      return 'both';
    default:
      return 'both';
  }
}

/** Normalize constraint type */
export function normalizeConstraint(constraint: string): string {
  const c = constraint.trim().toLowerCase();
  switch (c) {
    case 'required':
    case 'r':
      return 'required';
    case 'optional':
    case 'o':
      return 'optional';
    case 'repeated':
    case 'm':
      return 'repeated';
    case 'optional_struct':
    case 'os':
      return 'optional_struct';
    case 'required_struct':
    case 'rs':
      return 'required_struct';
    default:
      return 'optional';
  }
}

// ---- Template creation ----

/** Get default template */
export function getDefaultTemplate(): SheetTemplate {
  return {
    sheetName: 'EXAMPLE_CONF',
    columns: [
      {
        row1Constraint: 'required',
        row2DataType: 'uint32',
        row3ParamName: 'id',
        row4ExportType: 'b',
        row5Description: '唯一ID',
      },
      {
        row1Constraint: 'optional',
        row2DataType: 'string',
        row3ParamName: 'name',
        row4ExportType: 'b',
        row5Description: '名称',
      },
      {
        row1Constraint: 'optional',
        row2DataType: 'int32',
        row3ParamName: 'level',
        row4ExportType: 'b',
        row5Description: '等级',
      },
      {
        row1Constraint: 'optional',
        row2DataType: 'string',
        row3ParamName: 'description',
        row4ExportType: 'b',
        row5Description: '描述',
      },
    ],
  };
}

/** Create header template in an Excel worksheet */
export async function createHeaderTemplate(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columns: HeaderColumn[],
): Promise<void> {
  if (!validateSheetName(sheetName)) {
    throw new Error(`Invalid sheet name: ${sheetName} (must be uppercase letters and underscores, ending with _CONF)`);
  }

  const ws = workbook.addWorksheet(sheetName);

  // Remove default "Sheet1" if it exists and is not the target
  const sheet1 = workbook.getWorksheet('Sheet1');
  if (sheet1 && sheetName !== 'Sheet1') {
    workbook.removeWorksheet(sheet1.id);
  }

  // Header style
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      left: { style: 'thin', color: { argb: 'FF000000' } },
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    },
  };

  // Data style
  const dataStyle: Partial<ExcelJS.Style> = {
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    border: {
      left: { style: 'thin', color: { argb: 'FF000000' } },
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    },
  };

  // Write 5-row header
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx];
    const colNum = colIdx + 1;

    const cell1 = ws.getCell(1, colNum);
    cell1.value = col.row1Constraint;
    cell1.style = headerStyle;
    const cell2 = ws.getCell(2, colNum);
    cell2.value = col.row2DataType;
    cell2.style = headerStyle;
    const cell3 = ws.getCell(3, colNum);
    cell3.value = col.row3ParamName;
    cell3.style = headerStyle;
    const cell4 = ws.getCell(4, colNum);
    cell4.value = col.row4ExportType;
    cell4.style = headerStyle;
    const cell5 = ws.getCell(5, colNum);
    cell5.value = col.row5Description;
    cell5.style = headerStyle;

    // Column width
    ws.getColumn(colNum).width = 20;
  }

  // Freeze first 5 rows
  ws.views = [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6', activeCell: 'A6' }];

  // Add empty styled data rows (6-10)
  for (let row = 6; row <= 10; row++) {
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      ws.getCell(row, colIdx + 1).style = dataStyle;
    }
  }
}
