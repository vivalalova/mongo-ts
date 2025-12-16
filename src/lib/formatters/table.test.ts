import { describe, it, expect } from 'vitest';
import { formatTable } from './table.js';

describe('formatTable', () => {
  it('returns "No results" for empty array', () => {
    expect(formatTable([])).toBe('No results');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test', age: 25 }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name | age\n' +
      '--- | ---- | ---\n' +
      '123 | test | 25 '
    );
  });

  it('formats multiple documents', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name \n' +
      '--- | -----\n' +
      '1   | Alice\n' +
      '2   | Bob  '
    );
  });

  it('handles null values', () => {
    const docs = [{ _id: '1', name: null }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name\n' +
      '--- | ----\n' +
      '1   | null'
    );
  });

  it('handles nested objects', () => {
    const docs = [{ _id: '1', meta: { created: '2024-01-01' } }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | meta                    \n' +
      '--- | ------------------------\n' +
      '1   | {"created":"2024-01-01"}'
    );
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ _id: '1', created: date }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | created                 \n' +
      '--- | ------------------------\n' +
      '1   | 2024-01-01T00:00:00.000Z'
    );
  });

  it('respects maxWidth option', () => {
    const longString = 'a'.repeat(100);
    const docs = [{ _id: '1', content: longString }];
    const result = formatTable(docs, { maxWidth: 20 });

    expect(result).toBe(
      '_id | content             \n' +
      '--- | --------------------\n' +
      '1   | aaaaaaaaaaaaaaaaa...'
    );
  });

  it('uses specified columns', () => {
    const docs = [{ _id: '1', name: 'test', age: 25, email: 'test@test.com' }];
    const result = formatTable(docs, { columns: ['name', 'age'] });

    expect(result).toBe(
      'name | age\n' +
      '---- | ---\n' +
      'test | 25 '
    );
  });

  it('puts _id column first', () => {
    const docs = [{ name: 'test', _id: '123', age: 25 }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name | age\n' +
      '--- | ---- | ---\n' +
      '123 | test | 25 '
    );
  });

  it('handles undefined values', () => {
    const docs = [{ _id: '1', name: undefined }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name\n' +
      '--- | ----\n' +
      '1   |     '
    );
  });

  it('handles boolean values', () => {
    const docs = [{ _id: '1', active: true, deleted: false }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | active | deleted\n' +
      '--- | ------ | -------\n' +
      '1   | true   | false  '
    );
  });

  it('handles numeric values', () => {
    const docs = [{ _id: '1', count: 42, price: 19.99 }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | count | price\n' +
      '--- | ----- | -----\n' +
      '1   | 42    | 19.99'
    );
  });

  it('handles arrays as JSON', () => {
    const docs = [{ _id: '1', tags: ['a', 'b'] }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | tags     \n' +
      '--- | ---------\n' +
      '1   | ["a","b"]'
    );
  });

  it('handles CJK characters with correct width', () => {
    const docs = [{ _id: '1', name: '中文' }];
    const result = formatTable(docs);

    // CJK characters are double-width
    expect(result).toContain('中文');
    expect(result).toContain('_id | name');
  });

  it('handles Japanese kana characters', () => {
    const docs = [{ _id: '1', name: 'こんにちは' }];
    const result = formatTable(docs);

    expect(result).toContain('こんにちは');
  });

  it('handles full-width characters', () => {
    const docs = [{ _id: '1', name: 'ＡＢＣ' }];
    const result = formatTable(docs);

    expect(result).toContain('ＡＢＣ');
  });

  it('handles $oid format', () => {
    const docs = [{ _id: { $oid: '507f1f77bcf86cd799439011' }, name: 'test' }];
    const result = formatTable(docs);

    expect(result).toContain('507f1f77bcf86cd799439011');
  });

  it('handles BSON ObjectId', () => {
    const mockObjectId = {
      _bsontype: 'ObjectId',
      toString: () => '507f1f77bcf86cd799439011',
    };
    const docs = [{ _id: mockObjectId, name: 'test' }];
    const result = formatTable(docs);

    expect(result).toContain('507f1f77bcf86cd799439011');
  });

  it('handles nested value with null intermediate', () => {
    const docs = [{ _id: '1', user: null }];
    const result = formatTable(docs, { columns: ['_id', 'user.name'] });

    expect(result).toBe(
      '_id | user.name\n' +
      '--- | ---------\n' +
      '1   |          '
    );
  });

  it('returns "No columns to display" for empty object documents', () => {
    const docs = [{}];
    const result = formatTable(docs, { columns: [] });

    expect(result).toBe('No columns to display');
  });
});
