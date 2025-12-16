import { Document } from 'mongodb';

/**
 * 輸出格式類型
 */
export type OutputFormat = 'table' | 'json' | 'csv' | 'yaml';

/**
 * CLI 全域選項
 */
export interface GlobalOptions {
  /** MongoDB 連線字串 */
  uri?: string;
  /** 資料庫名稱 */
  db?: string;
  /** 輸出格式 */
  format: OutputFormat;
  /** 唯讀模式 */
  readonly: boolean;
  /** 靜默模式 */
  quiet: boolean;
  /** 詳細模式 */
  verbose: boolean;
}

/**
 * 設定檔結構
 */
export interface Config {
  /** MongoDB 連線字串 */
  uri?: string;
  /** 預設資料庫 */
  defaultDb?: string;
  /** 預設輸出格式 */
  format?: OutputFormat;
  /** 預設唯讀模式 */
  readonly?: boolean;
}

/**
 * 解析後的查詢結構
 */
export interface ParsedQuery {
  /** 查詢類型 */
  type: QueryType;
  /** 集合名稱 */
  collection?: string;
  /** 方法名稱 */
  method?: string;
  /** 方法參數 */
  args: unknown[];
}

/**
 * 查詢類型分類
 */
export type QueryType =
  | 'read'      // find, findOne, countDocuments, aggregate, getIndexes, stats
  | 'write'     // insert*, update*, delete*, createIndex, dropIndex
  | 'admin'     // show dbs, show collections, db.stats(), db.dropDatabase()
  | 'unknown';

/**
 * 唯讀模式允許的方法
 */
export const READONLY_METHODS = new Set([
  'find',
  'findOne',
  'countDocuments',
  'estimatedDocumentCount',
  'aggregate',
  'getIndexes',
  'indexes',
  'stats',
  'listCollections',
  'listDatabases',
]);

/**
 * 寫入操作方法
 */
export const WRITE_METHODS = new Set([
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'drop',
  'dropDatabase',
  'createIndex',
  'dropIndex',
  'dropIndexes',
  'createCollection',
  'renameCollection',
]);

/**
 * 格式化器選項
 */
export interface FormatterOptions {
  /** 表格最大欄寬 */
  maxWidth?: number;
  /** 指定顯示欄位 */
  columns?: string[];
  /** 美化輸出 */
  pretty?: boolean;
}

/**
 * 查詢執行結果
 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 結果資料 */
  data?: Document | Document[] | string | number;
  /** 錯誤訊息 */
  error?: string;
  /** 影響筆數 */
  affected?: number;
}
