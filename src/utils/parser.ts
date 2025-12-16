import { ParsedQuery, QueryType, READONLY_METHODS, WRITE_METHODS } from '../types/index.js';

/**
 * 解析 MongoDB 查詢字串
 * @param query - 查詢字串，如 "db.users.find({})"
 */
export function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim();

  // 處理 show 命令
  if (trimmed.toLowerCase().startsWith('show ')) {
    return parseShowCommand(trimmed);
  }

  // 處理 use 命令
  if (trimmed.toLowerCase().startsWith('use ')) {
    return parseUseCommand(trimmed);
  }

  // 處理 db.xxx 查詢
  if (trimmed.startsWith('db.')) {
    return parseDbQuery(trimmed);
  }

  return { type: 'unknown', args: [] };
}

/**
 * 解析 show 命令
 */
function parseShowCommand(query: string): ParsedQuery {
  const parts = query.toLowerCase().split(/\s+/);
  const target = parts[1];

  switch (target) {
    case 'dbs':
    case 'databases':
      return { type: 'admin', method: 'listDatabases', args: [] };
    case 'collections':
    case 'tables':
      return { type: 'read', method: 'listCollections', args: [] };
    default:
      return { type: 'unknown', args: [] };
  }
}

/**
 * 解析 use 命令
 */
function parseUseCommand(query: string): ParsedQuery {
  const match = query.match(/^use\s+(\w+)/i);
  if (match) {
    return { type: 'admin', method: 'use', args: [match[1]] };
  }
  return { type: 'unknown', args: [] };
}

/**
 * 解析 db.xxx 格式的查詢
 */
function parseDbQuery(query: string): ParsedQuery {
  // db.stats()
  const dbStatsMatch = query.match(/^db\.stats\(\)$/);
  if (dbStatsMatch) {
    return { type: 'read', method: 'dbStats', args: [] };
  }

  // db.dropDatabase()
  const dropDbMatch = query.match(/^db\.dropDatabase\(\)$/);
  if (dropDbMatch) {
    return { type: 'write', method: 'dropDatabase', args: [] };
  }

  // db.getCollectionNames()
  const getCollNamesMatch = query.match(/^db\.getCollectionNames\(\)$/);
  if (getCollNamesMatch) {
    return { type: 'read', method: 'listCollections', args: [] };
  }

  // db.<collection>.<method>(...)
  const collMethodMatch = query.match(/^db\.(\w+)\.(\w+)\(([\s\S]*)\)$/);
  if (collMethodMatch) {
    const [, collection, method, argsStr] = collMethodMatch;
    const args = parseArguments(argsStr);
    const type = getQueryType(method);

    return { type, collection, method, args };
  }

  return { type: 'unknown', args: [] };
}

/**
 * 解析方法參數
 * @param argsStr - 參數字串
 */
function parseArguments(argsStr: string): unknown[] {
  const trimmed = argsStr.trim();
  if (!trimmed) {
    return [];
  }

  try {
    // 嘗試解析為 JSON 陣列
    // 將 JavaScript 物件語法轉換為 JSON
    const jsonStr = convertToJson(trimmed);

    // 包裝成陣列後解析
    const parsed = JSON.parse(`[${jsonStr}]`);
    return parsed as unknown[];
  } catch {
    // 解析失敗，返回原始字串
    return [trimmed];
  }
}

/**
 * 將 JavaScript 物件語法轉換為 JSON
 */
function convertToJson(str: string): string {
  return str
    // 處理未加引號的 key（包含 $ 開頭的操作符）
    .replace(/(\{|,)\s*(\$?\w+)\s*:/g, '$1"$2":')
    // 處理單引號字串
    .replace(/'([^']*)'/g, '"$1"')
    // 處理 ObjectId
    .replace(/ObjectId\("([^"]+)"\)/g, '{"$oid":"$1"}')
    // 處理 ISODate
    .replace(/ISODate\("([^"]+)"\)/g, '{"$date":"$1"}')
    // 處理 NumberLong
    .replace(/NumberLong\((\d+)\)/g, '{"$numberLong":"$1"}');
}

/**
 * 判斷查詢類型
 */
function getQueryType(method: string): QueryType {
  if (READONLY_METHODS.has(method)) {
    return 'read';
  }
  if (WRITE_METHODS.has(method)) {
    return 'write';
  }
  return 'unknown';
}

/**
 * 檢查是否為唯讀操作
 */
export function isReadonlyOperation(parsed: ParsedQuery): boolean {
  if (parsed.type === 'read') {
    return true;
  }

  if (parsed.type === 'admin') {
    // admin 操作中，只有部分是唯讀的
    const readonlyAdminMethods = ['listDatabases', 'listCollections', 'use', 'dbStats'];
    return readonlyAdminMethods.includes(parsed.method || '');
  }

  return false;
}

/**
 * 檢查 aggregate 是否包含寫入階段
 */
export function hasWriteStages(pipeline: unknown[]): boolean {
  const writeStages = ['$out', '$merge'];

  return pipeline.some((stage) => {
    if (typeof stage === 'object' && stage !== null) {
      return writeStages.some((ws) => ws in (stage as Record<string, unknown>));
    }
    return false;
  });
}
