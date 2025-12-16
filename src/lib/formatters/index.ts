import { Document } from 'mongodb';
import type { OutputFormat, FormatterOptions } from '../../types/index.js';
import { formatTable } from './table.js';
import { formatJson } from './json.js';
import { formatCsv } from './csv.js';
import { formatYaml } from './yaml.js';

/**
 * 格式化輸出資料
 * @param data - 要格式化的資料
 * @param format - 輸出格式
 * @param options - 格式化選項
 */
export function formatOutput(
  data: Document | Document[] | string | number,
  format: OutputFormat,
  options: FormatterOptions = {}
): string {
  // 純量值直接輸出
  if (typeof data === 'string' || typeof data === 'number') {
    return String(data);
  }

  // 空資料
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return format === 'json' ? '[]' : 'No results';
  }

  // 正規化為陣列
  const docs = Array.isArray(data) ? data : [data];

  switch (format) {
    case 'table':
      return formatTable(docs, options);
    case 'json':
      return formatJson(docs, options);
    case 'csv':
      return formatCsv(docs, options);
    case 'yaml':
      return formatYaml(docs, options);
    default:
      return formatTable(docs, options);
  }
}

export { formatTable } from './table.js';
export { formatJson } from './json.js';
export { formatCsv } from './csv.js';
export { formatYaml } from './yaml.js';
