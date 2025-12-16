import { describe, it, expect } from 'vitest';
import { formatTable } from './table.js';

describe('formatTable', () => {
  it('returns "No results" for empty array', () => {
    const result = formatTable([]);
    expect(result).toBe('No results');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test', age: 25 }];
    const result = formatTable(docs);

    expect(result).toContain('_id');
    expect(result).toContain('name');
    expect(result).toContain('age');
    expect(result).toContain('123');
    expect(result).toContain('test');
    expect(result).toContain('25');
  });

  it('formats multiple documents', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatTable(docs);

    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
  });

  it('handles null values', () => {
    const docs = [{ _id: '1', name: null }];
    const result = formatTable(docs);

    expect(result).toContain('null');
  });

  it('handles nested objects', () => {
    const docs = [{ _id: '1', meta: { created: '2024-01-01' } }];
    const result = formatTable(docs);

    expect(result).toContain('meta');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ _id: '1', created: date }];
    const result = formatTable(docs);

    expect(result).toContain('2024-01-01');
  });

  it('respects maxWidth option', () => {
    const longString = 'a'.repeat(100);
    const docs = [{ _id: '1', content: longString }];
    const result = formatTable(docs, { maxWidth: 20 });

    // cli-table3 truncates content - result should not contain full string
    expect(result).not.toContain(longString);
  });

  it('uses specified columns', () => {
    const docs = [{ _id: '1', name: 'test', age: 25, email: 'test@test.com' }];
    const result = formatTable(docs, { columns: ['name', 'age'] });

    expect(result).toContain('name');
    expect(result).toContain('age');
    expect(result).not.toContain('email');
  });

  it('puts _id column first', () => {
    const docs = [{ name: 'test', _id: '123', age: 25 }];
    const result = formatTable(docs);
    const lines = result.split('\n');
    const headerLine = lines.find(l => l.includes('_id')) || '';

    expect(headerLine.indexOf('_id')).toBeLessThan(headerLine.indexOf('name'));
  });
});
