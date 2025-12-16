import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import type { Config, OutputFormat } from '../types/index.js';

/** 設定檔目錄 */
const CONFIG_DIR = join(homedir(), '.mongots');

/** 設定檔路徑 */
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

/**
 * 載入設定
 * 優先順序：命令列選項 > 環境變數 > 設定檔 > 預設值
 * @param customPath - 自訂設定檔路徑
 */
export function loadConfig(customPath?: string): Config {
  // 載入 .env
  loadEnv();

  const defaultConfig: Config = {
    format: 'table',
    allowWrite: false,
  };

  // 讀取設定檔
  const configPath = customPath || CONFIG_PATH;
  let fileConfig: Config = {};

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(content) as Config;
    } catch {
      // 設定檔解析失敗，使用預設值
    }
  }

  // 環境變數（只包含有值的設定，避免 undefined 覆蓋檔案設定）
  const envConfig: Config = {};
  if (process.env['MONGO_URI']) {
    envConfig.uri = process.env['MONGO_URI'];
  }
  if (process.env['MONGO_DB']) {
    envConfig.defaultDb = process.env['MONGO_DB'];
  }

  // 合併設定（環境變數優先於設定檔）
  return {
    ...defaultConfig,
    ...fileConfig,
    ...envConfig,
  };
}

/**
 * 儲存設定
 * @param config - 要儲存的設定
 */
export function saveConfig(config: Partial<Config>): void {
  // 確保目錄存在
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // 讀取現有設定
  let existing: Config = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config;
    } catch {
      // 忽略解析錯誤
    }
  }

  // 合併並儲存
  const merged = { ...existing, ...config };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}

/**
 * 取得設定檔路徑
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * 驗證輸出格式
 * @param format - 格式字串
 */
export function isValidFormat(format: string): format is OutputFormat {
  return ['table', 'json', 'csv', 'yaml'].includes(format);
}
