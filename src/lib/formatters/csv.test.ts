import { describe, it, expect } from 'vitest';
import { formatCsv } from './csv.js';

describe('formatCsv', () => {
  it('returns empty string for empty array', () => {
    const result = formatCsv([]);
    expect(result).toBe('');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatCsv(docs);

    const lines = result.split('\n');
    expect(lines[0]).toContain('_id');
    expect(lines[0]).toContain('name');
    expect(lines[1]).toContain('123');
    expect(lines[1]).toContain('test');
  });

  it('formats multiple documents', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatCsv(docs);

    const lines = result.split('\n');
    expect(lines).toHaveLength(3);
  });

  it('escapes commas in values', () => {
    const docs = [{ _id: '1', name: 'John, Jr.' }];
    const result = formatCsv(docs);

    expect(result).toContain('"John, Jr."');
  });

  it('escapes quotes in values', () => {
    const docs = [{ _id: '1', name: 'Say "Hello"' }];
    const result = formatCsv(docs);

    expect(result).toContain('""Hello""');
  });

  it('escapes newlines in values', () => {
    const docs = [{ _id: '1', content: 'line1\nline2' }];
    const result = formatCsv(docs);

    expect(result).toContain('"line1\nline2"');
  });

  it('handles null and undefined', () => {
    const docs = [{ _id: '1', a: null, b: undefined }];
    const result = formatCsv(docs);

    const lines = result.split('\n');
    expect(lines[1]).toMatch(/,{2}/);
  });

  it('handles nested objects', () => {
    const docs = [{ _id: '1', meta: { key: 'value' } }];
    const result = formatCsv(docs);

    expect(result).toContain('meta.key');
    expect(result).toContain('value');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ _id: '1', created: date }];
    const result = formatCsv(docs);

    expect(result).toContain('2024-01-01');
  });

  it('uses specified columns', () => {
    const docs = [{ _id: '1', name: 'test', age: 25 }];
    const result = formatCsv(docs, { columns: ['name'] });

    expect(result).toContain('name');
    expect(result).not.toContain('age');
  });
});
