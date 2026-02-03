import { ObjectId, Long } from 'mongodb';
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
      return { type: 'admin', method: 'listCollections', args: [] };
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
    return { type: 'admin', method: 'dbStats', args: [] };
  }

  // db.dropDatabase()
  const dropDbMatch = query.match(/^db\.dropDatabase\(\)$/);
  if (dropDbMatch) {
    return { type: 'admin', method: 'dropDatabase', args: [] };
  }

  // db.getCollectionNames()
  const getCollNamesMatch = query.match(/^db\.getCollectionNames\(\)$/);
  if (getCollNamesMatch) {
    return { type: 'admin', method: 'listCollections', args: [] };
  }

  // db.<collection>.<method>(...) — collection 可含點號（如 system.users）
  const collMethodMatch = query.match(/^db\.([\w.]+)\.(\w+)\(([\s\S]*)\)$/);
  if (collMethodMatch) {
    const [, collection, method, argsStr] = collMethodMatch;

    // 確保最後一段是方法名（避免 db.a.b 被誤解析為 collection=a, method=b）
    // 若 method 不在已知方法中且 collection 含點，嘗試重新拆分
    if (getQueryType(method) === 'unknown' && collection.includes('.')) {
      // 可能是 db.system.users.find() 這類情況，但 method 確實是 unknown
      // 仍然回傳讓 executor 決定
    }

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
    // 將 JavaScript 物件語法轉換為 JSON，再解析
    const jsonStr = convertToJson(trimmed);
    const parsed = JSON.parse(`[${jsonStr}]`) as unknown[];

    // 將 Extended JSON 轉換為原生 BSON 型別
    return parsed.map((arg) => deserializeBsonTypes(arg));
  } catch {
    // 解析失敗，返回原始字串
    return [trimmed];
  }
}

/** BSON 型別匹配模式：name → replacement 函式 */
const BSON_PATTERNS: Array<{ pattern: RegExp; replace: string }> = [
  // ObjectId / new ObjectId
  { pattern: /^(?:new\s+)?ObjectId\(["']([^"']+)["']\)/, replace: '{"$oid":"$1"}' },
  // ISODate / new ISODate
  { pattern: /^(?:new\s+)?ISODate\(["']([^"']+)["']\)/, replace: '{"$date":"$1"}' },
  // Date / new Date（與 ISODate 同等語義）
  { pattern: /^(?:new\s+)?Date\(["']([^"']+)["']\)/, replace: '{"$date":"$1"}' },
  // NumberLong 帶引號
  { pattern: /^(?:new\s+)?NumberLong\(["'](-?\d+)["']\)/, replace: '{"$numberLong":"$1"}' },
  // NumberLong 不帶引號
  { pattern: /^(?:new\s+)?NumberLong\((-?\d+)\)/, replace: '{"$numberLong":"$1"}' },
  // NumberInt 帶引號
  { pattern: /^(?:new\s+)?NumberInt\(["']?(-?\d+)["']?\)/, replace: '$1' },
];

/**
 * 將 JavaScript 物件語法轉換為 JSON
 *
 * 逐字元掃描，區分字串內外的 token，避免正則誤匹配字串值內容。
 * BSON 型別在掃描器內部處理，確保不會替換字串值內的文字。
 */
function convertToJson(str: string): string {
  let output = '';
  let i = 0;

  while (i < str.length) {
    // 跳過雙引號字串（保持原樣）
    if (str[i] === '"') {
      const end = findClosingQuote(str, i, '"');
      output += str.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    // 單引號字串 → 轉為雙引號（需轉義內部的雙引號）
    if (str[i] === "'") {
      const end = findClosingQuote(str, i, "'");
      const content = str.slice(i + 1, end).replace(/"/g, '\\"');
      output += '"' + content + '"';
      i = end + 1;
      continue;
    }

    // 開括號：直接輸出並嘗試匹配 key
    if (str[i] === '{') {
      output += str[i];
      i++;
      const wsKey = skipWhitespaceAndMatchKey(str, i);
      output += wsKey.text;
      i = wsKey.pos;
      continue;
    }

    // 逗號：先檢查是否為尾逗號（後接 } 或 ]），若是則跳過
    if (str[i] === ',') {
      let peek = i + 1;
      while (peek < str.length && /\s/.test(str[peek])) peek++;
      if (peek < str.length && (str[peek] === '}' || str[peek] === ']')) {
        i = peek; // 跳過尾逗號和空白
        continue;
      }

      output += str[i];
      i++;
      const wsKey = skipWhitespaceAndMatchKey(str, i);
      output += wsKey.text;
      i = wsKey.pos;
      continue;
    }

    // 嘗試匹配 BSON 型別（只在字串外部）
    const bsonResult = tryMatchBson(str, i);
    if (bsonResult) {
      output += bsonResult.replacement;
      i += bsonResult.consumed;
      continue;
    }

    output += str[i];
    i++;
  }

  return output;
}

/**
 * 跳過空白並嘗試匹配未加引號的 key
 * @returns 產出的文字片段和新的掃描位置
 */
function skipWhitespaceAndMatchKey(
  str: string,
  pos: number
): { text: string; pos: number } {
  let text = '';
  let i = pos;

  // 跳過空白
  while (i < str.length && /\s/.test(str[i])) {
    text += str[i];
    i++;
  }

  // 檢查是否為未加引號的 key（$?word 後接 :）
  const keyMatch = str.slice(i).match(/^(\$?\w+)\s*:/);
  if (keyMatch) {
    text += `"${keyMatch[1]}":`;
    i += keyMatch[0].length;
  }

  return { text, pos: i };
}

/**
 * 嘗試在指定位置匹配 BSON 型別
 * @returns 匹配結果或 null
 */
function tryMatchBson(
  str: string,
  pos: number
): { replacement: string; consumed: number } | null {
  const remaining = str.slice(pos);

  for (const { pattern, replace } of BSON_PATTERNS) {
    const match = remaining.match(pattern);
    if (match) {
      const replacement = replace.replace(/\$1/g, match[1]);
      return { replacement, consumed: match[0].length };
    }
  }

  return null;
}

/**
 * 找到配對的結束引號位置（跳過轉義字元）
 */
function findClosingQuote(str: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < str.length) {
    if (str[i] === '\\') {
      i += 2; // 跳過轉義字元
      continue;
    }
    if (str[i] === quote) {
      return i;
    }
    i++;
  }
  return str.length - 1; // 未找到結束引號，返回末尾
}

/**
 * 將 Extended JSON 物件遞迴轉換為原生 BSON 型別
 * - {"$oid": "..."} → ObjectId("...")
 * - {"$date": "..."} → Date("...")
 * - {"$numberLong": "..."} → Long("...")
 */
function deserializeBsonTypes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deserializeBsonTypes(item));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Extended JSON 物件只有一個 key
  if (keys.length === 1) {
    if ('$oid' in obj && typeof obj.$oid === 'string') {
      return new ObjectId(obj.$oid);
    }
    if ('$date' in obj && typeof obj.$date === 'string') {
      return new Date(obj.$date);
    }
    if ('$numberLong' in obj && typeof obj.$numberLong === 'string') {
      return Long.fromString(obj.$numberLong);
    }
  }

  // 遞迴處理巢狀物件
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    result[key] = deserializeBsonTypes(obj[key]);
  }
  return result;
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
