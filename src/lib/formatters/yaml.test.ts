import { describe, it, expect } from 'vitest';
import { formatYaml } from './yaml.js';

describe('formatYaml', () => {
  it('returns empty string for empty array', () => {
    expect(formatYaml([])).toBe('');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatYaml(docs);

    expect(result).toBe('_id: "123"\nname: test\n');
  });

  it('formats multiple documents as array', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatYaml(docs);

    expect(result).toBe('- _id: "1"\n  name: Alice\n- _id: "2"\n  name: Bob\n');
  });

  it('handles nested objects', () => {
    const docs = [{ meta: { nested: { deep: 'value' } } }];
    const result = formatYaml(docs);

    expect(result).toBe('meta:\n  nested:\n    deep: value\n');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ created: date }];
    const result = formatYaml(docs);

    // Date is converted to ISO string without quotes in YAML
    expect(result).toBe('created: 2024-01-01T00:00:00.000Z\n');
  });

  it('handles null values', () => {
    const docs = [{ value: null }];
    const result = formatYaml(docs);

    expect(result).toBe('value: null\n');
  });

  it('handles arrays', () => {
    const docs = [{ tags: ['a', 'b', 'c'] }];
    const result = formatYaml(docs);

    expect(result).toBe('tags:\n  - a\n  - b\n  - c\n');
  });

  it('handles numbers', () => {
    const docs = [{ count: 42, price: 19.99 }];
    const result = formatYaml(docs);

    expect(result).toBe('count: 42\nprice: 19.99\n');
  });

  it('handles boolean values', () => {
    const docs = [{ active: true, deleted: false }];
    const result = formatYaml(docs);

    expect(result).toBe('active: true\ndeleted: false\n');
  });

  it('handles empty object', () => {
    const docs = [{}];
    const result = formatYaml(docs);

    expect(result).toBe('{}\n');
  });

  it('handles complex nested structure', () => {
    const docs = [{
      _id: '1',
      user: {
        name: 'Alice',
        profile: {
          age: 30,
        },
      },
    }];
    const result = formatYaml(docs);

    expect(result).toBe('_id: "1"\nuser:\n  name: Alice\n  profile:\n    age: 30\n');
  });

  it('handles string with special characters', () => {
    const docs = [{ message: 'Hello: World' }];
    const result = formatYaml(docs);

    expect(result).toBe('message: "Hello: World"\n');
  });
});
