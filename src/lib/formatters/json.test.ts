import { describe, it, expect } from 'vitest';
import { formatJson } from './json.js';

describe('formatJson', () => {
  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ _id: '123', name: 'test' });
  });

  it('formats multiple documents as array', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual([
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ]);
  });

  it('outputs pretty format by default', () => {
    const docs = [{ _id: '123' }];
    const result = formatJson(docs);

    expect(result).toBe('{\n  "_id": "123"\n}');
  });

  it('outputs compact format when pretty is false', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatJson(docs, { pretty: false });

    expect(result).toBe('{"_id":"123","name":"test"}');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ created: date }];
    const result = formatJson(docs);

    // Date is serialized as ISO string by JSON.stringify's default toJSON behavior
    expect(JSON.parse(result)).toEqual({
      created: '2024-01-01T00:00:00.000Z',
    });
  });

  it('handles null values', () => {
    const docs = [{ a: null, b: 'value' }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ a: null, b: 'value' });
  });

  it('handles nested objects', () => {
    const docs = [{ meta: { nested: { deep: 'value' } } }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      meta: { nested: { deep: 'value' } },
    });
  });

  it('handles arrays', () => {
    const docs = [{ tags: ['a', 'b', 'c'], counts: [1, 2, 3] }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      tags: ['a', 'b', 'c'],
      counts: [1, 2, 3],
    });
  });

  it('handles boolean values', () => {
    const docs = [{ active: true, deleted: false }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ active: true, deleted: false });
  });

  it('handles numeric values', () => {
    const docs = [{ count: 42, price: 19.99 }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ count: 42, price: 19.99 });
  });

  it('handles empty object', () => {
    const docs = [{}];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({});
  });

  it('handles complex nested structure', () => {
    const docs = [{
      _id: '1',
      user: {
        name: 'Alice',
        profile: {
          age: 30,
          tags: ['admin', 'active'],
        },
      },
      active: true,
    }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      _id: '1',
      user: {
        name: 'Alice',
        profile: {
          age: 30,
          tags: ['admin', 'active'],
        },
      },
      active: true,
    });
  });

  it('handles BSON ObjectId', () => {
    const mockObjectId = {
      _bsontype: 'ObjectId',
      toString: () => '507f1f77bcf86cd799439011',
    };
    const docs = [{ _id: mockObjectId, name: 'test' }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      _id: { $oid: '507f1f77bcf86cd799439011' },
      name: 'test',
    });
  });

  it('handles BigInt values', () => {
    const docs = [{ bigValue: BigInt('9007199254740993') }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      bigValue: { $numberLong: '9007199254740993' },
    });
  });

  it('handles undefined values', () => {
    const docs = [{ a: undefined, b: 'value' }];
    const result = formatJson(docs);

    // undefined values are omitted by JSON.stringify
    expect(JSON.parse(result)).toEqual({ b: 'value' });
  });
});
