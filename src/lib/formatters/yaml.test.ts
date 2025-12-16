import { describe, it, expect } from 'vitest';
import { formatYaml } from './yaml.js';

describe('formatYaml', () => {
  it('returns empty string for empty array', () => {
    const result = formatYaml([]);
    expect(result).toBe('');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatYaml(docs);

    expect(result).toContain('_id: "123"');
    expect(result).toContain('name: test');
  });

  it('formats multiple documents as array', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatYaml(docs);

    expect(result).toContain('- _id:');
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
  });

  it('handles nested objects', () => {
    const docs = [{ meta: { nested: { deep: 'value' } } }];
    const result = formatYaml(docs);

    expect(result).toContain('meta:');
    expect(result).toContain('nested:');
    expect(result).toContain('deep: value');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ created: date }];
    const result = formatYaml(docs);

    expect(result).toContain('2024-01-01');
  });

  it('handles null values', () => {
    const docs = [{ value: null }];
    const result = formatYaml(docs);

    expect(result).toContain('null');
  });

  it('handles arrays', () => {
    const docs = [{ tags: ['a', 'b', 'c'] }];
    const result = formatYaml(docs);

    expect(result).toContain('tags:');
    expect(result).toContain('- a');
    expect(result).toContain('- b');
    expect(result).toContain('- c');
  });

  it('handles numbers', () => {
    const docs = [{ count: 42, price: 19.99 }];
    const result = formatYaml(docs);

    expect(result).toContain('count: 42');
    expect(result).toContain('price: 19.99');
  });

  it('handles boolean values', () => {
    const docs = [{ active: true, deleted: false }];
    const result = formatYaml(docs);

    expect(result).toContain('active: true');
    expect(result).toContain('deleted: false');
  });
});
