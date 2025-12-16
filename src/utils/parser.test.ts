import { describe, it, expect } from 'vitest';
import { parseQuery, isReadonlyOperation, hasWriteStages } from './parser.js';

describe('parseQuery', () => {
  describe('show commands', () => {
    it.each([
      { input: 'show dbs', method: 'listDatabases', type: 'admin' },
      { input: 'show databases', method: 'listDatabases', type: 'admin' },
      { input: 'SHOW DBS', method: 'listDatabases', type: 'admin' },
      { input: 'show collections', method: 'listCollections', type: 'read' },
      { input: 'show tables', method: 'listCollections', type: 'read' },
    ])('parses "$input" correctly', ({ input, method, type }) => {
      const result = parseQuery(input);
      expect(result.method).toBe(method);
      expect(result.type).toBe(type);
    });

    it('returns unknown for invalid show command', () => {
      const result = parseQuery('show invalid');
      expect(result.type).toBe('unknown');
    });
  });

  describe('use command', () => {
    it('parses use database command', () => {
      const result = parseQuery('use mydb');
      expect(result.type).toBe('admin');
      expect(result.method).toBe('use');
      expect(result.args).toEqual(['mydb']);
    });

    it('parses use command case insensitive', () => {
      const result = parseQuery('USE testdb');
      expect(result.method).toBe('use');
      expect(result.args).toEqual(['testdb']);
    });
  });

  describe('db methods', () => {
    it('parses db.stats()', () => {
      const result = parseQuery('db.stats()');
      expect(result.type).toBe('read');
      expect(result.method).toBe('dbStats');
    });

    it('parses db.dropDatabase()', () => {
      const result = parseQuery('db.dropDatabase()');
      expect(result.type).toBe('write');
      expect(result.method).toBe('dropDatabase');
    });

    it('parses db.getCollectionNames()', () => {
      const result = parseQuery('db.getCollectionNames()');
      expect(result.type).toBe('read');
      expect(result.method).toBe('listCollections');
    });
  });

  describe('collection methods', () => {
    it('parses find with empty query', () => {
      const result = parseQuery('db.users.find()');
      expect(result.type).toBe('read');
      expect(result.collection).toBe('users');
      expect(result.method).toBe('find');
      expect(result.args).toEqual([]);
    });

    it('parses find with query object', () => {
      const result = parseQuery('db.users.find({name: "test"})');
      expect(result.collection).toBe('users');
      expect(result.method).toBe('find');
      expect(result.args).toEqual([{ name: 'test' }]);
    });

    it('parses findOne', () => {
      const result = parseQuery('db.users.findOne({_id: "123"})');
      expect(result.method).toBe('findOne');
      expect(result.args).toEqual([{ _id: '123' }]);
    });

    it('parses insertOne', () => {
      const result = parseQuery('db.users.insertOne({name: "test", age: 25})');
      expect(result.type).toBe('write');
      expect(result.method).toBe('insertOne');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('parses insertMany', () => {
      const result = parseQuery('db.users.insertMany([{name: "a"}, {name: "b"}])');
      expect(result.method).toBe('insertMany');
      expect(result.args).toEqual([[{ name: 'a' }, { name: 'b' }]]);
    });

    it('parses updateOne with $set', () => {
      const result = parseQuery('db.users.updateOne({name: "test"}, {$set: {age: 30}})');
      expect(result.type).toBe('write');
      expect(result.method).toBe('updateOne');
      expect(result.args).toEqual([{ name: 'test' }, { $set: { age: 30 } }]);
    });

    it('parses deleteOne', () => {
      const result = parseQuery('db.users.deleteOne({name: "test"})');
      expect(result.type).toBe('write');
      expect(result.method).toBe('deleteOne');
    });

    it('parses aggregate', () => {
      const result = parseQuery('db.orders.aggregate([{$group: {_id: "$status"}}])');
      expect(result.type).toBe('read');
      expect(result.method).toBe('aggregate');
      expect(result.args).toEqual([[{ $group: { _id: '$status' } }]]);
    });

    it('parses countDocuments', () => {
      const result = parseQuery('db.users.countDocuments({active: true})');
      expect(result.type).toBe('read');
      expect(result.method).toBe('countDocuments');
    });

    it('parses getIndexes', () => {
      const result = parseQuery('db.users.getIndexes()');
      expect(result.type).toBe('read');
      expect(result.method).toBe('getIndexes');
    });

    it('parses createIndex', () => {
      const result = parseQuery('db.users.createIndex({email: 1})');
      expect(result.type).toBe('write');
      expect(result.method).toBe('createIndex');
    });

    it('parses drop', () => {
      const result = parseQuery('db.users.drop()');
      expect(result.type).toBe('write');
      expect(result.method).toBe('drop');
    });
  });

  describe('special syntax', () => {
    it('handles single quotes', () => {
      const result = parseQuery("db.users.find({name: 'test'})");
      expect(result.args).toEqual([{ name: 'test' }]);
    });

    it('handles ObjectId', () => {
      const result = parseQuery('db.users.find({_id: ObjectId("507f1f77bcf86cd799439011")})');
      expect(result.args).toEqual([{ _id: { $oid: '507f1f77bcf86cd799439011' } }]);
    });

    it('handles ISODate', () => {
      const result = parseQuery('db.users.find({created: ISODate("2024-01-01")})');
      expect(result.args).toEqual([{ created: { $date: '2024-01-01' } }]);
    });

    it('handles NumberLong', () => {
      const result = parseQuery('db.users.find({count: NumberLong(123456789)})');
      expect(result.args).toEqual([{ count: { $numberLong: '123456789' } }]);
    });
  });

  describe('unknown queries', () => {
    it('returns unknown for invalid syntax', () => {
      expect(parseQuery('invalid').type).toBe('unknown');
      expect(parseQuery('select * from users').type).toBe('unknown');
      expect(parseQuery('').type).toBe('unknown');
    });
  });
});

describe('isReadonlyOperation', () => {
  it.each([
    { type: 'read', method: 'find', expected: true },
    { type: 'read', method: 'findOne', expected: true },
    { type: 'read', method: 'countDocuments', expected: true },
    { type: 'admin', method: 'listDatabases', expected: true },
    { type: 'admin', method: 'listCollections', expected: true },
    { type: 'admin', method: 'use', expected: true },
    { type: 'admin', method: 'dbStats', expected: true },
    { type: 'write', method: 'insertOne', expected: false },
    { type: 'write', method: 'updateOne', expected: false },
    { type: 'write', method: 'deleteOne', expected: false },
    { type: 'admin', method: 'dropDatabase', expected: false },
    { type: 'unknown', method: undefined, expected: false },
  ] as const)('$type/$method returns $expected', ({ type, method, expected }) => {
    const result = isReadonlyOperation({ type, method, args: [] });
    expect(result).toBe(expected);
  });
});

describe('hasWriteStages', () => {
  it('returns false for empty pipeline', () => {
    expect(hasWriteStages([])).toBe(false);
  });

  it('returns false for read-only pipeline', () => {
    const pipeline = [
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ];
    expect(hasWriteStages(pipeline)).toBe(false);
  });

  it('returns true for pipeline with $out', () => {
    const pipeline = [
      { $match: { status: 'active' } },
      { $out: 'results' },
    ];
    expect(hasWriteStages(pipeline)).toBe(true);
  });

  it('returns true for pipeline with $merge', () => {
    const pipeline = [
      { $group: { _id: '$category' } },
      { $merge: { into: 'summary' } },
    ];
    expect(hasWriteStages(pipeline)).toBe(true);
  });

  it('handles non-object stages', () => {
    expect(hasWriteStages([null, undefined, 'invalid'])).toBe(false);
  });
});
