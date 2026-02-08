import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { normalizeExportType } from './header-template';
import { validateProtoSyntax, formatValidationErrors, validateProtoFile } from './proto-validator';
import { HEADER_ROW_COUNT, SHEET_NAME_SUFFIX, PROTO_SUFFIX } from '../../shared/constants';

// ---- Types ----

export interface ProtobufField {
  constraint: string; // required/optional/repeated
  dataType: string;
  name: string;
  tag: number;
  comment: string;
  exportType: string;
  isStruct: boolean;
}

export interface ProtobufMessage {
  name: string;
  fields: ProtobufField[];
  nestedMessages: ProtobufMessage[];
}

// ---- Helpers ----

/** Get cell value as trimmed string */
function getCellStr(row: string[], index: number): string {
  if (index >= row.length) return '';
  return (row[index] ?? '').trim();
}

/** Read all rows from a worksheet as string arrays */
function getSheetRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: string[] = [];
    for (let col = 1; col <= ws.columnCount; col++) {
      const cell = row.getCell(col);
      values.push(cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
    }
    // Pad to correct row index (1-based to 0-based)
    while (rows.length < rowNumber - 1) rows.push([]);
    rows.push(values);
  });
  return rows;
}

/** Convert sheet name to message name: EXAMPLE_CONF -> ExampleConfig */
function convertSheetNameToMessageName(sheetName: string): string {
  const name = sheetName.replace(/_CONF$/, '');
  const parts = name.split('_');
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('') + 'Config';
}

/** Convert param name to message name: my_struct -> MyStruct */
function convertParamNameToMessageName(paramName: string): string {
  const parts = paramName.split('_');
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
}

/** Convert CamelCase to snake_case */
function convertCamelToSnake(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (i > 0 && ch >= 'A' && ch <= 'Z') {
      result += '_';
    }
    result += ch;
  }
  return result;
}

/** Normalize constraint for proto output */
function normalizeConstraintForProto(constraint: string): string {
  const c = constraint
    .trim()
    .toLowerCase()
    .replace(/_struct$/, '');
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
    default:
      return 'optional';
  }
}

/** Normalize data type */
function normalizeDataType(dataType: string): string {
  const dt = dataType.trim();

  // Numeric (array length)
  if (/^\d+$/.test(dt)) return 'int32';

  // Enum type
  if (dt.startsWith('enum.')) {
    const enumType = dt.substring(5);
    return enumType ? dt : '';
  }

  // Standard protobuf types
  const validTypes = new Set([
    'double',
    'float',
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
    'bool',
    'string',
    'bytes',
  ]);

  const lowerType = dt.toLowerCase();
  if (validTypes.has(lowerType)) return lowerType;

  // Custom time types
  if (dt === 'DateTime' || dt === 'TimeDuration') return dt;

  return '';
}

/** Validate data type */
export function validateDataType(dataType: string): void {
  const dt = dataType.trim();
  if (!dt) throw new Error('数据类型不能为空');

  if (/^\d+$/.test(dt)) return;

  if (dt.startsWith('enum.')) {
    const enumType = dt.substring(5);
    if (!enumType) throw new Error(`枚举类型格式错误，应为 enum.{类型名}，当前值: ${dt}`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(enumType)) {
      throw new Error(`枚举类型名不合法，应只包含字母、数字、下划线，当前值: ${dt}`);
    }
    return;
  }

  const validTypes = [
    'double',
    'float',
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
    'bool',
    'string',
    'bytes',
  ];

  if (validTypes.includes(dt.toLowerCase())) return;
  if (dt === 'DateTime' || dt === 'TimeDuration') return;

  throw new Error(
    `不支持的数据类型: ${dt}\n\n支持的类型包括:\n` +
      '• 整数类型: int32, int64, uint32, uint64, sint32, sint64, fixed32, fixed64, sfixed32, sfixed64\n' +
      '• 浮点类型: float, double\n' +
      '• 其他类型: bool, string, bytes\n' +
      '• 枚举类型: enum.{类型名}\n' +
      '• 时间类型: DateTime, TimeDuration',
  );
}

// ---- Struct parsing ----

interface StructParseResult {
  message: ProtobufMessage;
  nextColIdx: number;
}

function parseStructMessage(
  row1: string[],
  row2: string[],
  row3: string[],
  row4: string[],
  structColIdx: number,
  memberCount: number,
  structName: string,
  sheetName: string,
): StructParseResult {
  const nestedMsg: ProtobufMessage = {
    name: convertParamNameToMessageName(structName),
    fields: [],
    nestedMessages: [],
  };

  let colIdx = structColIdx + 1;
  let fieldTag = 1;

  for (let i = 0; i < memberCount && colIdx < row3.length; i++) {
    if (colIdx >= row3.length || getCellStr(row3, colIdx) === '') {
      colIdx++;
      continue;
    }

    const constraint = getCellStr(row1, colIdx);
    const dataType = getCellStr(row2, colIdx);

    // Skip * markers
    if (constraint === '*' || dataType === '*') {
      colIdx++;
      i--;
      continue;
    }

    const paramName = getCellStr(row3, colIdx);
    const exportType = getCellStr(row4, colIdx);

    // Nested struct
    if (constraint === 'struct') {
      const nestedMemberCount = parseInt(dataType, 10);
      if (!nestedMemberCount || nestedMemberCount <= 0) {
        throw new Error(
          `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] (嵌套struct) 成员变量个数必须大于0，当前值: ${dataType}`,
        );
      }

      const result = parseStructMessage(row1, row2, row3, row4, colIdx, nestedMemberCount, paramName, sheetName);
      nestedMsg.nestedMessages.push(result.message);
      nestedMsg.fields.push({
        constraint: 'optional',
        dataType: result.message.name,
        name: paramName,
        tag: fieldTag,
        comment: '',
        exportType: normalizeExportType(exportType),
        isStruct: true,
      });
      fieldTag++;
      colIdx = result.nextColIdx;
      continue;
    }

    // Repeated + struct combo
    if (constraint === 'repeated') {
      const nextColIdx = colIdx + 1;
      if (nextColIdx < row1.length && getCellStr(row1, nextColIdx) === 'struct') {
        const repeatCount = parseInt(dataType, 10);
        if (!repeatCount || repeatCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] (嵌套repeated) 个数必须大于0，当前值: ${dataType}`,
          );
        }

        const structDataType = getCellStr(row2, nextColIdx);
        const structParamName = getCellStr(row3, nextColIdx);
        const nestedMemberCount = parseInt(structDataType, 10);
        if (!nestedMemberCount || nestedMemberCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${nextColIdx + 1}列 [${structParamName}] (嵌套repeated struct) 成员变量个数必须大于0，当前值: ${structDataType}`,
          );
        }

        const result = parseStructMessage(
          row1,
          row2,
          row3,
          row4,
          nextColIdx,
          nestedMemberCount,
          structParamName,
          sheetName,
        );
        nestedMsg.nestedMessages.push(result.message);
        nestedMsg.fields.push({
          constraint: 'repeated',
          dataType: result.message.name,
          name: paramName,
          tag: fieldTag,
          comment: '',
          exportType: normalizeExportType(exportType),
          isStruct: true,
        });
        fieldTag++;

        const firstGroupColumns = result.nextColIdx - nextColIdx;
        const memberColumns = firstGroupColumns - 1;
        const remainingGroups = repeatCount - 1;
        const totalColumnsToSkip = 1 + firstGroupColumns + remainingGroups * memberColumns;
        colIdx = colIdx + totalColumnsToSkip;
        i--;
        continue;
      }
    }

    // Regular field
    validateDataType(dataType);
    const normalizedType = normalizeDataType(dataType);
    if (!normalizedType) {
      throw new Error(`Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] (struct成员) 数据类型不合法: ${dataType}`);
    }

    nestedMsg.fields.push({
      constraint: normalizeConstraintForProto(constraint),
      dataType: normalizedType,
      name: paramName,
      tag: fieldTag,
      comment: '',
      exportType: normalizeExportType(exportType),
      isStruct: false,
    });
    fieldTag++;
    colIdx++;
  }

  return { message: nestedMsg, nextColIdx: colIdx };
}

// ---- Sheet parsing ----

function parseSheet(rows: string[][], sheetName: string): ProtobufMessage | null {
  if (rows.length < HEADER_ROW_COUNT) {
    throw new Error(`Sheet ${sheetName} has less than ${HEADER_ROW_COUNT} header rows`);
  }

  const row1 = rows[0];
  const row2 = rows[1];
  const row3 = rows[2];
  const row4 = rows[3];

  const message: ProtobufMessage = {
    name: convertSheetNameToMessageName(sheetName),
    fields: [],
    nestedMessages: [],
  };

  let fieldTag = 1;
  for (let colIdx = 0; colIdx < row3.length; colIdx++) {
    if (getCellStr(row3, colIdx) === '') continue;

    const constraint = getCellStr(row1, colIdx);
    const dataType = getCellStr(row2, colIdx);

    if (constraint === '*' || dataType === '*') continue;

    const paramName = getCellStr(row3, colIdx);
    const exportType = getCellStr(row4, colIdx);

    // Struct type
    if (constraint === 'struct') {
      const memberCount = parseInt(dataType, 10);
      if (!memberCount || memberCount <= 0) {
        throw new Error(
          `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] struct成员变量个数必须大于0，当前值: ${dataType}`,
        );
      }

      const result = parseStructMessage(row1, row2, row3, row4, colIdx, memberCount, paramName, sheetName);
      message.nestedMessages.push(result.message);
      message.fields.push({
        constraint: 'optional',
        dataType: result.message.name,
        name: paramName,
        tag: fieldTag,
        comment: '',
        exportType: normalizeExportType(exportType),
        isStruct: true,
      });
      fieldTag++;
      colIdx = result.nextColIdx - 1;
      continue;
    }

    // Repeated + struct combo
    if (constraint === 'repeated') {
      const nextColIdx = colIdx + 1;
      if (nextColIdx < row1.length && getCellStr(row1, nextColIdx) === 'struct') {
        const repeatCount = parseInt(dataType, 10);
        if (!repeatCount || repeatCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] repeated个数必须大于0，当前值: ${dataType}`,
          );
        }

        const structDataType = getCellStr(row2, nextColIdx);
        const structParamName = getCellStr(row3, nextColIdx);
        const memberCount = parseInt(structDataType, 10);
        if (!memberCount || memberCount <= 0) {
          throw new Error(
            `Sheet [${sheetName}] 第${nextColIdx + 1}列 [${structParamName}] struct成员变量个数必须大于0，当前值: ${structDataType}`,
          );
        }

        const result = parseStructMessage(row1, row2, row3, row4, nextColIdx, memberCount, structParamName, sheetName);
        message.nestedMessages.push(result.message);
        message.fields.push({
          constraint: 'repeated',
          dataType: result.message.name,
          name: paramName,
          tag: fieldTag,
          comment: '',
          exportType: normalizeExportType(exportType),
          isStruct: true,
        });
        fieldTag++;

        const firstGroupColumns = result.nextColIdx - nextColIdx;
        const memberColumns = firstGroupColumns - 1;
        const remainingGroups = repeatCount - 1;
        const totalColumnsToSkip = 1 + firstGroupColumns + remainingGroups * memberColumns;
        colIdx = colIdx + totalColumnsToSkip - 1;
        continue;
      }
    }

    // Regular field
    validateDataType(dataType);
    const normalizedType = normalizeDataType(dataType);
    if (!normalizedType) {
      throw new Error(`Sheet [${sheetName}] 第${colIdx + 1}列 [${paramName}] 数据类型不合法: ${dataType}`);
    }

    message.fields.push({
      constraint: normalizeConstraintForProto(constraint),
      dataType: normalizedType,
      name: paramName,
      tag: fieldTag,
      comment: '',
      exportType: normalizeExportType(exportType),
      isStruct: false,
    });
    fieldTag++;
  }

  return message;
}

// ---- Proto generation ----

function generateMessage(msg: ProtobufMessage, indent: number): string {
  const indentStr = '  '.repeat(indent);
  let result = `${indentStr}message ${msg.name} {\n`;

  // Nested messages first
  for (const nested of msg.nestedMessages) {
    result += generateMessage(nested, indent + 1);
    result += '\n';
  }

  // Fields
  for (const field of msg.fields) {
    const fieldIndent = '  '.repeat(indent + 1);
    if (field.constraint === 'repeated') {
      result += `${fieldIndent}repeated ${field.dataType} ${field.name} = ${field.tag};\n`;
    } else if (field.constraint === 'optional') {
      result += `${fieldIndent}optional ${field.dataType} ${field.name} = ${field.tag};\n`;
    } else {
      result += `${fieldIndent}${field.dataType} ${field.name} = ${field.tag};\n`;
    }
  }

  result += `${indentStr}}\n`;
  return result;
}

function generateProtoFileForMessage(msg: ProtobufMessage): string {
  let content = 'syntax = "proto3";\n\n';
  content += 'package dataconfig;\n\n';
  content += '// Auto-generated from Excel configuration\n';
  content += '// DO NOT EDIT MANUALLY\n\n';
  content += generateMessage(msg, 0);
  return content;
}

// ---- Public API ----

/** Parse Excel to Protobuf messages */
export async function parseExcelToProtobuf(filePath: string): Promise<ProtobufMessage[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const messages: ProtobufMessage[] = [];

  for (const ws of workbook.worksheets) {
    if (!ws.name.endsWith(SHEET_NAME_SUFFIX)) {
      console.log(`Skipping sheet '${ws.name}' (does not end with _CONF)`);
      continue;
    }

    const rows = getSheetRows(ws);
    const message = parseSheet(rows, ws.name);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

/** Export Excel file to Protobuf .proto files */
export async function exportToProtobuf(filePath: string, outputDir: string): Promise<string> {
  console.log(`[Proto Export] Starting proto export from: ${filePath}`);
  console.log(`[Proto Export] Output directory: ${outputDir}`);

  const messages = await parseExcelToProtobuf(filePath);

  if (messages.length === 0) {
    throw new Error('No valid _CONF sheets found in Excel file');
  }

  console.log(`[Proto Export] Found ${messages.length} valid _CONF sheets to export`);
  fs.mkdirSync(outputDir, { recursive: true });

  const exportedFiles: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const sheetName = msg.name.replace(/Config$/, '');
    const protoFileName = convertCamelToSnake(sheetName).toLowerCase() + PROTO_SUFFIX;
    const outputFile = path.join(outputDir, protoFileName);

    console.log(`[Proto Export] Processing ${i + 1}/${messages.length}: ${msg.name} -> ${protoFileName}`);

    const protoContent = generateProtoFileForMessage(msg);

    // Validate
    const validationErrors = validateProtoSyntax(protoContent);
    if (validationErrors.length > 0) {
      const errorMsg = formatValidationErrors(validationErrors);
      throw new Error(`Proto syntax validation failed for ${protoFileName}:\n${errorMsg}`);
    }

    // Write file
    fs.writeFileSync(outputFile, protoContent, 'utf-8');
    console.log(`[Proto Export] Written: ${outputFile}`);

    // Optional protoc validation
    try {
      validateProtoFile(outputFile);
    } catch (err) {
      console.warn(`[Proto Export] Protoc validation warning for ${protoFileName}: ${err}`);
    }

    exportedFiles.push(outputFile);
  }

  if (exportedFiles.length === 0) {
    throw new Error('No proto files exported');
  }

  console.log(`[Proto Export] Successfully exported ${exportedFiles.length} proto files`);
  return exportedFiles[0];
}

/** Generate proto file content for multiple messages */
export function generateProtoFile(messages: ProtobufMessage[]): string {
  let content = 'syntax = "proto3";\n\n';
  content += 'package dataconfig;\n\n';
  content += '// Auto-generated from Excel configuration\n';
  content += '// DO NOT EDIT MANUALLY\n\n';

  for (const msg of messages) {
    content += generateMessage(msg, 0);
    content += '\n';
  }

  return content;
}
