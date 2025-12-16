import { describe, it, expect } from 'vitest';
import { formatCsv } from './csv.js';

describe('formatCsv', () => {
  it('returns empty string for empty array', () => {
    expect(formatCsv([])).toBe('');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n123,test');
  });

  it('formats multiple documents', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n1,Alice\n2,Bob');
  });

  it('escapes commas in values', () => {
    const docs = [{ _id: '1', name: 'John, Jr.' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n1,"John, Jr."');
  });

  it('escapes quotes in values', () => {
    const docs = [{ _id: '1', name: 'Say "Hello"' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n1,"Say ""Hello"""');
  });

  it('escapes newlines in values', () => {
    const docs = [{ _id: '1', content: 'line1\nline2' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,content\n1,"line1\nline2"');
  });

  it('handles null and undefined', () => {
    const docs = [{ _id: '1', a: null, b: undefined }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,a,b\n1,,');
  });

  it('handles nested objects', () => {
    const docs = [{ _id: '1', meta: { key: 'value' } }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,meta.key\n1,value');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ _id: '1', created: date }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,created\n1,2024-01-01T00:00:00.000Z');
  });

  it('uses specified columns', () => {
    const docs = [{ _id: '1', name: 'test', age: 25 }];
    const result = formatCsv(docs, { columns: ['name'] });

    expect(result).toBe('name\ntest');
  });

  it('handles multiple nested objects', () => {
    const docs = [
      { _id: '1', user: { name: 'Alice', email: 'a@test.com' } },
      { _id: '2', user: { name: 'Bob', email: 'b@test.com' } },
    ];
    const result = formatCsv(docs);

    expect(result).toBe('_id,user.email,user.name\n1,a@test.com,Alice\n2,b@test.com,Bob');
  });

  it('handles arrays as JSON', () => {
    const docs = [{ _id: '1', tags: ['a', 'b'] }];
    const result = formatCsv(docs);

    // CSV escapes quotes by doubling them: " becomes ""
    expect(result).toBe('_id,tags\n1,"[""a"",""b""]"');
  });

  it('handles boolean values', () => {
    const docs = [{ _id: '1', active: true, deleted: false }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,active,deleted\n1,true,false');
  });

  it('handles numeric values', () => {
    const docs = [{ _id: '1', count: 42, price: 19.99 }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,count,price\n1,42,19.99');
  });

  it('returns empty string when no columns specified', () => {
    const docs = [{ _id: '1', name: 'test' }];
    const result = formatCsv(docs, { columns: [] });

    expect(result).toBe('');
  });

  it('handles $oid format', () => {
    const docs = [{ _id: { $oid: '507f1f77bcf86cd799439011' }, name: 'test' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n507f1f77bcf86cd799439011,test');
  });

  it('handles BSON ObjectId', () => {
    const mockObjectId = {
      _bsontype: 'ObjectId',
      toString: () => '507f1f77bcf86cd799439011',
    };
    const docs = [{ _id: mockObjectId, name: 'test' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n507f1f77bcf86cd799439011,test');
  });

  it('handles $date format', () => {
    const docs = [{ _id: '1', created: { $date: '2024-01-01T00:00:00.000Z' } }];
    const result = formatCsv(docs);

    // $date is treated as special type, not flattened
    expect(result).toContain('created');
  });

  it('handles nested value with null intermediate', () => {
    const docs = [{ _id: '1', user: null }];
    const result = formatCsv(docs, { columns: ['_id', 'user.name'] });

    expect(result).toBe('_id,user.name\n1,');
  });
});
