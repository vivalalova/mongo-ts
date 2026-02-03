import { Document } from 'mongodb';
import type { FormatterOptions } from '../../types/index.js';

/**
 * 格式化為 CSV
 */
export function formatCsv(docs: Document[], options: FormatterOptions = {}): string {
  if (docs.length === 0) {
    return '';
  }

  // 收集所有欄位
  const columns = options.columns || collectAllColumns(docs);

  if (columns.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // 標題行
  lines.push(columns.map(escapeCell).join(','));

  // 資料行
  for (const doc of docs) {
    const row = columns.map((col) => {
      const value = getNestedValue(doc, col);
      return escapeCell(formatValue(value));
    });
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * 收集所有欄位
 */
function collectAllColumns(docs: Document[]): string[] {
  const columnSet = new Set<string>();

  for (const doc of docs) {
    collectColumnsRecursive(doc, '', columnSet);
  }

  return Array.from(columnSet).sort();
}

/**
 * 遞迴收集欄位（支援巢狀）
 */
function collectColumnsRecursive(
  obj: Document,
  prefix: string,
  columns: Set<string>
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !isSpecialType(value)
    ) {
      collectColumnsRecursive(value as Document, fullKey, columns);
    } else {
      columns.add(fullKey);
    }
  }
}

/**
 * 檢查是否為特殊 BSON 類型
 */
function isSpecialType(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    '_bsontype' in obj ||
    '$oid' in obj ||
    '$date' in obj ||
    '$numberLong' in obj ||
    value instanceof Date
  );
}

/**
 * 取得巢狀屬性值
 */
function getNestedValue(obj: Document, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 格式化值
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('_bsontype' in obj) {
      const bsonType = obj['_bsontype'];
      if (bsonType === 'ObjectId' || bsonType === 'Long' || bsonType === 'Decimal128') {
        return String(value);
      }
    }
    if ('$oid' in obj) {
      return String(obj['$oid']);
    }
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * 轉義 CSV 欄位
 */
function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
