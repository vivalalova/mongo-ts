import Table from 'cli-table3';
import { Document } from 'mongodb';
import type { FormatterOptions } from '../../types/index.js';

/**
 * 格式化為表格
 */
export function formatTable(docs: Document[], options: FormatterOptions = {}): string {
  if (docs.length === 0) {
    return 'No results';
  }

  // 收集所有欄位
  const columns = options.columns || collectColumns(docs);

  if (columns.length === 0) {
    return 'No columns to display';
  }

  const maxWidth = options.maxWidth || 50;

  // 建立表格
  const table = new Table({
    head: columns,
    style: { head: ['cyan'], border: ['gray'] },
    wordWrap: true,
    colWidths: columns.map(() => Math.min(maxWidth, Math.floor(process.stdout.columns / columns.length) || maxWidth)),
  });

  // 填入資料
  for (const doc of docs) {
    const row = columns.map((col) => formatValue(getNestedValue(doc, col), maxWidth));
    table.push(row);
  }

  return table.toString();
}

/**
 * 收集所有文件的欄位
 */
function collectColumns(docs: Document[]): string[] {
  const columnSet = new Set<string>();

  for (const doc of docs) {
    for (const key of Object.keys(doc)) {
      columnSet.add(key);
    }
  }

  // _id 放最前面
  const columns = Array.from(columnSet);
  const idIndex = columns.indexOf('_id');
  if (idIndex > 0) {
    columns.splice(idIndex, 1);
    columns.unshift('_id');
  }

  return columns;
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
 * 格式化單一值
 */
function formatValue(value: unknown, maxWidth: number): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '';
  }

  // ObjectId
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('$oid' in obj) {
      return String(obj['$oid']);
    }
    if ('_bsontype' in obj && obj['_bsontype'] === 'ObjectId') {
      return String(value);
    }
  }

  // Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  // 物件/陣列
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return truncate(str, maxWidth);
  }

  return truncate(String(value), maxWidth);
}

/**
 * 截斷過長字串
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}
