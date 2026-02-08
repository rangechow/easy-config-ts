import fs from 'fs';
import path from 'path';
import { FileItem } from '../shared/types';
import { XLSX_EXTENSION } from '../shared/constants';

/** Build file tree: list directories containing .xlsx files */
export function buildFileItems(dataDir: string): FileItem[] {
  if (!dataDir) return [];

  const items: FileItem[] = [];
  buildFileTree(dataDir, '', 0, items);
  return items;
}

function buildFileTree(baseDir: string, relativePath: string, level: number, items: FileItem[]): void {
  const currentPath = relativePath ? path.join(baseDir, relativePath) : baseDir;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch (err) {
    console.error(`Error reading directory ${currentPath}: ${err}`);
    return;
  }

  for (const entry of entries) {
    // Skip hidden files/dirs
    if (entry.name.startsWith('.')) continue;

    // Only process directories
    if (!entry.isDirectory()) continue;

    const itemPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
    const fullDirPath = path.join(currentPath, entry.name);

    // Check if directory contains xlsx files
    if (hasXlsxFile(fullDirPath)) {
      items.push({
        name: entry.name,
        path: itemPath,
        isDir: true,
        level,
      });
    }
  }
}

function hasXlsxFile(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.some((entry) => !entry.isDirectory() && path.extname(entry.name) === XLSX_EXTENSION);
  } catch {
    return false;
  }
}
