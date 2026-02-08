import fs from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import { Config } from '../shared/types';

/**
 * Load configuration from JSON file (sync, used at startup).
 * Returns empty config if file doesn't exist or is invalid.
 */
export function loadConfig(configFilePath: string): Config {
  try {
    const data = readFileSync(configFilePath, 'utf-8');
    return JSON.parse(data) as Config;
  } catch {
    return { data_directory: '' };
  }
}

/**
 * Save configuration to JSON file asynchronously.
 */
export async function saveConfigAsync(configFilePath: string, config: Config): Promise<void> {
  try {
    const data = JSON.stringify(config, null, 2);
    await fs.writeFile(configFilePath, data, 'utf-8');
    console.log(`Config saved to: ${configFilePath}`);
  } catch (err) {
    console.error(`Error writing config file: ${err}`);
  }
}

/**
 * Save configuration to JSON file (sync, kept for backward compatibility).
 */
export function saveConfig(configFilePath: string, config: Config): void {
  try {
    const data = JSON.stringify(config, null, 2);
    writeFileSync(configFilePath, data, 'utf-8');
    console.log(`Config saved to: ${configFilePath}`);
  } catch (err) {
    console.error(`Error writing config file: ${err}`);
  }
}
