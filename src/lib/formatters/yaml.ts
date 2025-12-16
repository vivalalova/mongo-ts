import { stringify } from 'yaml';
import { Document } from 'mongodb';
import type { FormatterOptions } from '../../types/index.js';

/**
 * 格式化為 YAML
 */
export function formatYaml(docs: Document[], _options: FormatterOptions = {}): string {
  if (docs.length === 0) {
    return '';
  }

  const data = docs.length === 1 ? docs[0] : docs;
  const normalized = normalizeForYaml(data);

  return stringify(normalized, {
    indent: 2,
    lineWidth: 120,
  });
}

/**
 * 正規化資料以便 YAML 輸出
 */
function normalizeForYaml(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(normalizeForYaml);
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // ObjectId
    if ('_bsontype' in obj && obj['_bsontype'] === 'ObjectId') {
      return String(data);
    }

    // 遞迴處理物件
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = normalizeForYaml(value);
    }
    return result;
  }

  if (typeof data === 'bigint') {
    return Number(data);
  }

  return data;
}
