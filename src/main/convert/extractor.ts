import ExcelJS from 'exceljs';
import path from 'path';

// ---- Types ----

export interface SheetInfo {
  name: string;
  rowCount: number;
  colCount: number;
  cellCount: number;
  hasData: boolean;
}

export interface ExcelInfo {
  filePath: string;
  fileName: string;
  sheetCount: number;
  sheetNames: string[];
  sheetDetails: SheetInfo[];
  totalRows: number;
  totalCols: number;
  extractedTime: Date;
}

// ---- Functions ----

/** Extract comprehensive info from an Excel file */
export async function extractExcelInfo(filePath: string): Promise<ExcelInfo> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const info: ExcelInfo = {
    filePath,
    fileName: path.basename(filePath),
    sheetCount: workbook.worksheets.length,
    sheetNames: workbook.worksheets.map((ws) => ws.name),
    sheetDetails: [],
    totalRows: 0,
    totalCols: 0,
    extractedTime: new Date(),
  };

  for (const ws of workbook.worksheets) {
    const rowCount = ws.rowCount;
    const colCount = ws.columnCount;
    let cellCount = 0;

    ws.eachRow((row) => {
      row.eachCell(() => {
        cellCount++;
      });
    });

    const sheetInfo: SheetInfo = {
      name: ws.name,
      rowCount,
      colCount,
      cellCount,
      hasData: cellCount > 0,
    };

    info.sheetDetails.push(sheetInfo);
    info.totalRows += rowCount;
    if (colCount > info.totalCols) {
      info.totalCols = colCount;
    }
  }

  return info;
}

/** Format Excel info as a human-readable string */
export function formatExcelInfo(info: ExcelInfo): string {
  let result = '=== Excel File Information ===\n';
  result += `File: ${info.fileName}\n`;
  result += `Path: ${info.filePath}\n`;
  result += `Extracted Time: ${info.extractedTime.toISOString()}\n`;
  result += `Total Sheets: ${info.sheetCount}\n`;
  result += `Total Rows: ${info.totalRows}\n`;
  result += `Total Columns: ${info.totalCols}\n\n`;

  result += '=== Sheet Details ===\n';
  for (let i = 0; i < info.sheetDetails.length; i++) {
    const sheet = info.sheetDetails[i];
    result += `${i + 1}. Sheet: ${sheet.name}\n`;
    result += `   Rows: ${sheet.rowCount}, Columns: ${sheet.colCount}, Cells: ${sheet.cellCount}\n`;
    result += `   Has Data: ${sheet.hasData}\n`;
  }

  return result;
}

/** Log Excel info using a log function */
export function logExcelInfo(info: ExcelInfo, logFunc: (dir: string, msg: string) => void): void {
  logFunc('', `Excel Info Extracted: ${info.fileName}`);
  logFunc('', `  - Sheets: ${info.sheetCount}, Total Rows: ${info.totalRows}, Total Cols: ${info.totalCols}`);

  for (const sheet of info.sheetDetails) {
    logFunc('', `  - Sheet '${sheet.name}': ${sheet.rowCount} rows, ${sheet.colCount} cols, ${sheet.cellCount} cells`);
  }
}
