import { describe, it, expect } from 'vitest';
import { formatJson } from './json.js';

describe('formatJson', () => {
  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatJson(docs);

    const parsed = JSON.parse(result);
    expect(parsed._id).toBe('123');
    expect(parsed.name).toBe('test');
  });

  it('formats multiple documents as array', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatJson(docs);

    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it('outputs pretty format by default', () => {
    const docs = [{ _id: '123' }];
    const result = formatJson(docs);

    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('outputs compact format when pretty is false', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatJson(docs, { pretty: false });

    expect(result).not.toContain('\n');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ created: date }];
    const result = formatJson(docs);

    const parsed = JSON.parse(result);
    // Date is serialized as ISO string by JSON.stringify
    expect(parsed.created).toContain('2024-01-01');
  });

  it('handles null and undefined', () => {
    const docs = [{ a: null, b: undefined }];
    const result = formatJson(docs);

    const parsed = JSON.parse(result);
    expect(parsed.a).toBe(null);
  });

  it('handles nested objects', () => {
    const docs = [{ meta: { nested: { deep: 'value' } } }];
    const result = formatJson(docs);

    const parsed = JSON.parse(result);
    expect(parsed.meta.nested.deep).toBe('value');
  });
});
