import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { importYAMLToExcel } from './yaml-importer';

// ---- Public API ----

/** Get tmp file path: game_config.xlsx -> game_config_tmp.xlsx */
export function getTmpFilePath(originalPath: string): string {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const nameWithoutExt = path.basename(originalPath, ext);
  return path.join(dir, `${nameWithoutExt}_tmp${ext}`);
}

/** Check if tmp file exists */
export function tmpFileExists(originalPath: string): boolean {
  const tmpPath = getTmpFilePath(originalPath);
  return fs.existsSync(tmpPath);
}

/** Create tmp file from original Excel + YAML data import */
export async function createTmpFileFromYAML(originalPath: string): Promise<string> {
  const tmpPath = getTmpFilePath(originalPath);

  console.log(`[Tmp File] Creating tmp file: ${tmpPath}`);
  console.log(`[Tmp File] Source file: ${originalPath}`);

  // Step 1: Copy original file to tmp
  console.log('[Tmp File] Step 1: Copying original file to tmp...');
  await copyExcelFile(originalPath, tmpPath);
  console.log('[Tmp File] File copied successfully');

  // Step 2: Import YAML data into tmp file
  console.log('[Tmp File] Step 2: Importing YAML data to tmp file...');
  try {
    await importYAMLToExcel(tmpPath);
    console.log('[Tmp File] YAML data imported successfully');
  } catch (err) {
    console.error(`[Tmp File] Failed to import YAML to tmp file: ${err}`);
    // Clean up failed tmp file
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    throw new Error(`Failed to import YAML to tmp file: ${err}`);
  }

  console.log(`[Tmp File] Tmp file created successfully: ${tmpPath}`);
  return tmpPath;
}

/** Delete tmp file */
export function deleteTmpFile(originalPath: string): void {
  const tmpPath = getTmpFilePath(originalPath);

  if (!tmpFileExists(originalPath)) {
    console.log(`[Tmp File Delete] Tmp file does not exist: ${tmpPath}`);
    return;
  }

  console.log(`[Tmp File Delete] Deleting tmp file: ${tmpPath}`);
  fs.unlinkSync(tmpPath);
  console.log('[Tmp File Delete] Tmp file deleted successfully');
}

/** Get file to open (prefer tmp file, create if needed) */
export async function getFileToOpen(originalPath: string): Promise<string> {
  if (tmpFileExists(originalPath)) {
    const tmpPath = getTmpFilePath(originalPath);
    console.log(`Found existing tmp file: ${tmpPath}`);
    return tmpPath;
  }

  console.log('Tmp file not found, creating new tmp file from YAML data');
  try {
    return await createTmpFileFromYAML(originalPath);
  } catch (err) {
    console.log(`Failed to create tmp file, will use original file: ${err}`);
    return originalPath;
  }
}

/** Get original path from tmp file path: game_config_tmp.xlsx -> game_config.xlsx */
export function getOriginalPathFromTmp(tmpPath: string): string {
  const dir = path.dirname(tmpPath);
  const ext = path.extname(tmpPath);
  let nameWithoutExt = path.basename(tmpPath, ext);

  if (nameWithoutExt.endsWith('_tmp')) {
    nameWithoutExt = nameWithoutExt.slice(0, -4);
  }

  return path.join(dir, `${nameWithoutExt}${ext}`);
}

/** Check if a file is a tmp file */
export function isTmpFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  const nameWithoutExt = path.basename(filePath, ext);
  return nameWithoutExt.endsWith('_tmp');
}

// ---- Internal ----

async function copyExcelFile(src: string, dst: string): Promise<void> {
  console.log(`[File Copy] Copying from: ${src}`);
  console.log(`[File Copy] Copying to: ${dst}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(src);
  await workbook.xlsx.writeFile(dst);

  console.log('[File Copy] File copied successfully');
}
