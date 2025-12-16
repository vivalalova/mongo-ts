import { Document } from 'mongodb';
import type { FormatterOptions } from '../../types/index.js';

/**
 * 格式化為 Markdown 表格
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

  // 格式化所有資料
  const rows = docs.map((doc) =>
    columns.map((col) => formatValue(getNestedValue(doc, col), maxWidth))
  );

  // 計算每欄最大寬度（考慮標題和內容）
  const colWidths = columns.map((col, i) => {
    const contentWidths = rows.map((row) => getDisplayWidth(row[i]));
    return Math.max(getDisplayWidth(col), ...contentWidths);
  });

  // 建立 Markdown 表格
  const headerRow = formatMarkdownRow(columns, colWidths);
  const separatorRow = colWidths.map((w) => '-'.repeat(w)).join(' | ');
  const dataRows = rows.map((row) => formatMarkdownRow(row, colWidths));

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * 格式化 Markdown 表格列
 */
function formatMarkdownRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, i) => padRight(cell, widths[i]))
    .join(' | ');
}

/**
 * 右側填充空格對齊
 */
function padRight(str: string, width: number): string {
  const displayWidth = getDisplayWidth(str);
  const padding = width - displayWidth;
  return str + ' '.repeat(Math.max(0, padding));
}

/**
 * 取得字串顯示寬度（考慮中文等雙寬字元）
 */
function getDisplayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    const code = char.charCodeAt(0);
    // CJK 字元範圍（粗略判斷）
    if (code >= 0x4e00 && code <= 0x9fff) {
      width += 2;
    } else if (code >= 0x3000 && code <= 0x30ff) {
      width += 2;
    } else if (code >= 0xff00 && code <= 0xffef) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
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
    return truncate(escapeNewlines(str), maxWidth);
  }

  return truncate(escapeNewlines(String(value)), maxWidth);
}

/**
 * 轉義換行符
 */
function escapeNewlines(str: string): string {
  return str.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
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
