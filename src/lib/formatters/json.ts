import { Document } from 'mongodb';
import type { FormatterOptions } from '../../types/index.js';

/**
 * 格式化為 JSON
 */
export function formatJson(docs: Document[], options: FormatterOptions = {}): string {
  const pretty = options.pretty !== false;
  const data = docs.length === 1 ? docs[0] : docs;

  if (pretty) {
    return JSON.stringify(data, replacer, 2);
  }

  return JSON.stringify(data, replacer);
}

/**
 * JSON.stringify replacer
 * 處理特殊 BSON 類型
 */
function replacer(_key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // ObjectId
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('_bsontype' in obj && obj['_bsontype'] === 'ObjectId') {
      return { $oid: String(value) };
    }
  }

  // Date
  if (value instanceof Date) {
    return { $date: value.toISOString() };
  }

  // BigInt
  if (typeof value === 'bigint') {
    return { $numberLong: String(value) };
  }

  return value;
}
