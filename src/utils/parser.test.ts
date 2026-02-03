import { describe, it, expect } from 'vitest';
import { ObjectId, Long } from 'mongodb';
import { parseQuery, isReadonlyOperation, hasWriteStages } from './parser.js';

describe('parseQuery', () => {
  describe('show commands', () => {
    it.each([
      { input: 'show dbs', method: 'listDatabases', type: 'admin' },
      { input: 'show databases', method: 'listDatabases', type: 'admin' },
      { input: 'SHOW DBS', method: 'listDatabases', type: 'admin' },
      { input: 'show collections', method: 'listCollections', type: 'admin' },
      { input: 'show tables', method: 'listCollections', type: 'admin' },
    ])('parses "$input" correctly', ({ input, method, type }) => {
      const result = parseQuery(input);
      expect(result.method).toBe(method);
      expect(result.type).toBe(type);
    });

    it('returns unknown for invalid show command', () => {
      const result = parseQuery('show invalid');
      expect(result.type).toBe('unknown');
    });

    it('handles extra whitespace', () => {
      const result = parseQuery('show   dbs');
      expect(result.method).toBe('listDatabases');
    });

    it('handles leading/trailing whitespace', () => {
      const result = parseQuery('  show dbs  ');
      expect(result.method).toBe('listDatabases');
    });

    it('returns unknown for show without target', () => {
      const result = parseQuery('show');
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

    it('returns unknown for use without database name', () => {
      const result = parseQuery('use');
      expect(result.type).toBe('unknown');
    });

    it('parses database name with numbers', () => {
      const result = parseQuery('use db123');
      expect(result.args).toEqual(['db123']);
    });

    it('parses database name with underscore', () => {
      const result = parseQuery('use my_database');
      expect(result.args).toEqual(['my_database']);
    });
  });

  describe('db methods', () => {
    it('parses db.stats()', () => {
      const result = parseQuery('db.stats()');
      expect(result.type).toBe('admin');
      expect(result.method).toBe('dbStats');
    });

    it('parses db.dropDatabase()', () => {
      const result = parseQuery('db.dropDatabase()');
      expect(result.type).toBe('admin');
      expect(result.method).toBe('dropDatabase');
    });

    it('parses db.getCollectionNames()', () => {
      const result = parseQuery('db.getCollectionNames()');
      expect(result.type).toBe('admin');
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

    it('parses updateMany', () => {
      const result = parseQuery('db.users.updateMany({active: false}, {$set: {deleted: true}})');
      expect(result.type).toBe('write');
      expect(result.method).toBe('updateMany');
      expect(result.args).toEqual([{ active: false }, { $set: { deleted: true } }]);
    });

    it('parses deleteMany', () => {
      const result = parseQuery('db.logs.deleteMany({date: {$lt: "2024-01-01"}})');
      expect(result.type).toBe('write');
      expect(result.method).toBe('deleteMany');
    });

    it('parses replaceOne', () => {
      const result = parseQuery('db.users.replaceOne({_id: "123"}, {name: "new"})');
      expect(result.type).toBe('write');
      expect(result.method).toBe('replaceOne');
    });

    it('parses dropIndex', () => {
      const result = parseQuery('db.users.dropIndex("email_1")');
      expect(result.type).toBe('write');
      expect(result.method).toBe('dropIndex');
    });

    it('returns unknown for incomplete db query', () => {
      expect(parseQuery('db.users').type).toBe('unknown');
      expect(parseQuery('db.users.').type).toBe('unknown');
      expect(parseQuery('db.').type).toBe('unknown');
    });

    it('returns unknown for unknown collection method', () => {
      const result = parseQuery('db.users.unknownMethod()');
      expect(result.type).toBe('unknown');
      expect(result.method).toBe('unknownMethod');
    });

    it('parses collection name with numbers', () => {
      const result = parseQuery('db.logs2024.find()');
      expect(result.collection).toBe('logs2024');
    });

    it('parses collection name with underscore', () => {
      const result = parseQuery('db.user_sessions.find()');
      expect(result.collection).toBe('user_sessions');
    });
  });

  describe('special syntax', () => {
    it('handles single quotes', () => {
      const result = parseQuery("db.users.find({name: 'test'})");
      expect(result.args).toEqual([{ name: 'test' }]);
    });

    it('handles ObjectId', () => {
      const result = parseQuery('db.users.find({_id: ObjectId("507f1f77bcf86cd799439011")})');
      expect(result.args).toEqual([{ _id: new ObjectId('507f1f77bcf86cd799439011') }]);
    });

    it('handles ISODate', () => {
      const result = parseQuery('db.users.find({created: ISODate("2024-01-01")})');
      expect(result.args).toEqual([{ created: new Date('2024-01-01') }]);
    });

    it('handles NumberLong', () => {
      const result = parseQuery('db.users.find({count: NumberLong(123456789)})');
      expect(result.args).toEqual([{ count: Long.fromString('123456789') }]);
    });

    it('handles multiple ObjectIds', () => {
      const result = parseQuery('db.users.find({$or: [{_id: ObjectId("111111111111111111111111")}, {_id: ObjectId("222222222222222222222222")}]})');
      expect(result.args).toEqual([{
        $or: [
          { _id: new ObjectId('111111111111111111111111') },
          { _id: new ObjectId('222222222222222222222222') },
        ],
      }]);
    });

    it('handles nested objects', () => {
      const result = parseQuery('db.users.find({address: {city: "Tokyo", country: "Japan"}})');
      expect(result.args).toEqual([{ address: { city: 'Tokyo', country: 'Japan' } }]);
    });

    it('handles array in query', () => {
      const result = parseQuery('db.users.find({tags: {$in: ["a", "b", "c"]}})');
      expect(result.args).toEqual([{ tags: { $in: ['a', 'b', 'c'] } }]);
    });

    it('handles double quotes in values', () => {
      const result = parseQuery('db.users.find({name: "John Doe"})');
      expect(result.args).toEqual([{ name: 'John Doe' }]);
    });

    it('returns raw string when JSON parse fails', () => {
      const result = parseQuery('db.users.find({invalid syntax})');
      expect(result.args).toEqual(['{invalid syntax}']);
    });

    it('handles ObjectId with single quotes', () => {
      const result = parseQuery("db.users.find({_id: ObjectId('507f1f77bcf86cd799439011')})");
      expect(result.args).toEqual([{ _id: new ObjectId('507f1f77bcf86cd799439011') }]);
    });

    it('handles ISODate with single quotes', () => {
      const result = parseQuery("db.orders.find({created: ISODate('2024-06-15')})");
      expect(result.args).toEqual([{ created: new Date('2024-06-15') }]);
    });

    it('handles NumberLong with quoted string', () => {
      const result = parseQuery('db.users.find({count: NumberLong("9876543210")})');
      expect(result.args).toEqual([{ count: Long.fromString('9876543210') }]);
    });

    it('handles NumberLong with single-quoted string', () => {
      const result = parseQuery("db.users.find({count: NumberLong('9876543210')})");
      expect(result.args).toEqual([{ count: Long.fromString('9876543210') }]);
    });

    it('handles NumberLong with negative number', () => {
      const result = parseQuery('db.accounts.find({balance: NumberLong(-500)})');
      expect(result.args).toEqual([{ balance: Long.fromString('-500') }]);
    });

    it('handles string value containing comma and colon pattern', () => {
      const result = parseQuery('db.logs.find({message: "error: timeout, retries: 3"})');
      expect(result.args).toEqual([{ message: 'error: timeout, retries: 3' }]);
    });

    it('handles string value containing comma-key-colon in single quotes', () => {
      const result = parseQuery("db.logs.find({note: 'status: ok, count: 5'})");
      expect(result.args).toEqual([{ note: 'status: ok, count: 5' }]);
    });
  });

  // ===== 第一輪：BSON 型別變體 =====
  describe('round 1: BSON type variants', () => {
    it('handles new ObjectId() syntax', () => {
      const result = parseQuery('db.users.find({_id: new ObjectId("507f1f77bcf86cd799439011")})');
      expect(result.args).toEqual([{ _id: new ObjectId('507f1f77bcf86cd799439011') }]);
    });

    it('handles NumberInt', () => {
      const result = parseQuery('db.users.find({age: NumberInt(25)})');
      expect(result.args).toEqual([{ age: 25 }]);
    });

    it('handles mixed BSON types in one query', () => {
      const result = parseQuery(
        'db.orders.find({_id: ObjectId("507f1f77bcf86cd799439011"), created: ISODate("2024-01-01"), total: NumberLong(9999)})'
      );
      expect(result.args).toEqual([{
        _id: new ObjectId('507f1f77bcf86cd799439011'),
        created: new Date('2024-01-01'),
        total: Long.fromString('9999'),
      }]);
    });

    it('handles ObjectId in $in array', () => {
      const result = parseQuery(
        'db.users.find({_id: {$in: [ObjectId("111111111111111111111111"), ObjectId("222222222222222222222222")]}})'
      );
      expect(result.args).toEqual([{
        _id: {
          $in: [
            new ObjectId('111111111111111111111111'),
            new ObjectId('222222222222222222222222'),
          ],
        },
      }]);
    });

    it('handles ISODate in $gte/$lte range', () => {
      const result = parseQuery(
        'db.logs.find({created: {$gte: ISODate("2024-01-01"), $lte: ISODate("2024-12-31")}})'
      );
      expect(result.args).toEqual([{
        created: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-12-31'),
        },
      }]);
    });
  });

  // ===== 第二輪：值的邊界情況 =====
  describe('round 2: value edge cases', () => {
    it('handles empty string value', () => {
      const result = parseQuery('db.users.find({name: ""})');
      expect(result.args).toEqual([{ name: '' }]);
    });

    it('handles null value', () => {
      const result = parseQuery('db.users.find({deletedAt: null})');
      expect(result.args).toEqual([{ deletedAt: null }]);
    });

    it('handles boolean true/false', () => {
      const result = parseQuery('db.users.find({active: true, deleted: false})');
      expect(result.args).toEqual([{ active: true, deleted: false }]);
    });

    it('handles negative number', () => {
      const result = parseQuery('db.scores.find({score: {$lt: -10}})');
      expect(result.args).toEqual([{ score: { $lt: -10 } }]);
    });

    it('handles float number', () => {
      const result = parseQuery('db.products.find({price: 19.99})');
      expect(result.args).toEqual([{ price: 19.99 }]);
    });

    it('handles zero', () => {
      const result = parseQuery('db.users.find({loginCount: 0})');
      expect(result.args).toEqual([{ loginCount: 0 }]);
    });

    it('handles string with parentheses', () => {
      const result = parseQuery('db.logs.find({message: "error (code: 500)"})');
      expect(result.args).toEqual([{ message: 'error (code: 500)' }]);
    });

    it('handles string with curly braces', () => {
      const result = parseQuery('db.logs.find({template: "Hello {name}"})');
      expect(result.args).toEqual([{ template: 'Hello {name}' }]);
    });

    it('handles single quote inside double-quoted value', () => {
      const result = parseQuery('db.users.find({name: "O\'Brien"})');
      expect(result.args).toEqual([{ name: "O'Brien" }]);
    });
  });

  // ===== 第三輪：結構性邊界 =====
  describe('round 3: structural edge cases', () => {
    it('handles projection as second argument', () => {
      const result = parseQuery('db.users.find({active: true}, {name: 1, email: 1, _id: 0})');
      expect(result.args).toEqual([
        { active: true },
        { name: 1, email: 1, _id: 0 },
      ]);
    });

    it('handles empty object argument', () => {
      const result = parseQuery('db.users.find({})');
      expect(result.args).toEqual([{}]);
    });

    it('handles three arguments (updateOne with options)', () => {
      const result = parseQuery(
        'db.users.updateOne({name: "test"}, {$set: {age: 30}}, {upsert: true})'
      );
      expect(result.args).toEqual([
        { name: 'test' },
        { $set: { age: 30 } },
        { upsert: true },
      ]);
    });

    it('handles deeply nested objects', () => {
      const result = parseQuery('db.data.find({a: {b: {c: {d: 1}}}})');
      expect(result.args).toEqual([{ a: { b: { c: { d: 1 } } } }]);
    });

    it('handles $elemMatch with multiple conditions', () => {
      const result = parseQuery(
        'db.students.find({scores: {$elemMatch: {$gt: 80, $lt: 90}}})'
      );
      expect(result.args).toEqual([{
        scores: { $elemMatch: { $gt: 80, $lt: 90 } },
      }]);
    });

    it('handles collection name with dots', () => {
      const result = parseQuery('db.system.users.find({})');
      // 至少不應該回傳 unknown — 但目前的正規式可能無法處理
      expect(result.type).not.toBe('unknown');
    });
  });

  // ===== 第四輪：複雜聚合與查詢 =====
  describe('round 4: complex queries', () => {
    it('handles aggregate with multiple stages', () => {
      const result = parseQuery(
        'db.orders.aggregate([{$match: {status: "completed"}}, {$group: {_id: "$userId", total: {$sum: "$amount"}}}, {$sort: {total: -1}}])'
      );
      expect(result.args).toEqual([[
        { $match: { status: 'completed' } },
        { $group: { _id: '$userId', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]]);
    });

    it('handles $and with multiple conditions', () => {
      const result = parseQuery(
        'db.users.find({$and: [{age: {$gte: 18}}, {age: {$lte: 65}}, {active: true}]})'
      );
      expect(result.args).toEqual([{
        $and: [
          { age: { $gte: 18 } },
          { age: { $lte: 65 } },
          { active: true },
        ],
      }]);
    });

    it('handles $or with ObjectId and string', () => {
      const result = parseQuery(
        'db.users.find({$or: [{_id: ObjectId("507f1f77bcf86cd799439011")}, {email: "admin@test.com"}]})'
      );
      expect(result.args).toEqual([{
        $or: [
          { _id: new ObjectId('507f1f77bcf86cd799439011') },
          { email: 'admin@test.com' },
        ],
      }]);
    });

    it('handles aggregate $lookup', () => {
      const result = parseQuery(
        'db.orders.aggregate([{$lookup: {from: "users", localField: "userId", foreignField: "_id", as: "user"}}])'
      );
      expect(result.args).toEqual([[{
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      }]]);
    });

    it('handles insertOne with ObjectId field', () => {
      const result = parseQuery(
        'db.posts.insertOne({title: "Hello", authorId: ObjectId("507f1f77bcf86cd799439011"), tags: ["news", "tech"]})'
      );
      expect(result.args).toEqual([{
        title: 'Hello',
        authorId: new ObjectId('507f1f77bcf86cd799439011'),
        tags: ['news', 'tech'],
      }]);
    });
  });

  // ===== 第五輪：邊界與異常 =====
  describe('round 5: boundary and error cases', () => {
    it('handles $exists operator', () => {
      const result = parseQuery('db.users.find({email: {$exists: true}})');
      expect(result.args).toEqual([{ email: { $exists: true } }]);
    });

    it('handles $ne with null', () => {
      const result = parseQuery('db.users.find({deletedAt: {$ne: null}})');
      expect(result.args).toEqual([{ deletedAt: { $ne: null } }]);
    });

    it('handles unicode in string values', () => {
      const result = parseQuery('db.users.find({name: "日本語テスト"})');
      expect(result.args).toEqual([{ name: '日本語テスト' }]);
    });

    it('handles unicode in single-quoted values', () => {
      const result = parseQuery("db.users.find({city: '台北市'})");
      expect(result.args).toEqual([{ city: '台北市' }]);
    });

    it('handles $type operator', () => {
      const result = parseQuery('db.data.find({value: {$type: "number"}})');
      expect(result.args).toEqual([{ value: { $type: 'number' } }]);
    });

    it('handles empty array value', () => {
      const result = parseQuery('db.users.find({tags: []})');
      expect(result.args).toEqual([{ tags: [] }]);
    });

    it('handles mixed array of numbers and strings', () => {
      const result = parseQuery('db.items.find({codes: {$in: [1, "two", 3, "four"]}})');
      expect(result.args).toEqual([{ codes: { $in: [1, 'two', 3, 'four'] } }]);
    });

    it('handles already-quoted JSON keys', () => {
      const result = parseQuery('db.users.find({"name": "test", "age": 25})');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });
  });

  // ===== 第六輪：BSON 文字出現在字串值內（不應被替換） =====
  describe('round 6: BSON-like text inside string values', () => {
    it('preserves NumberInt() inside double-quoted string', () => {
      const result = parseQuery('db.logs.find({msg: "NumberInt(5) was used"})');
      expect(result.args).toEqual([{ msg: 'NumberInt(5) was used' }]);
    });

    it('preserves NumberLong() inside double-quoted string', () => {
      const result = parseQuery('db.logs.find({msg: "NumberLong(999) overflow"})');
      expect(result.args).toEqual([{ msg: 'NumberLong(999) overflow' }]);
    });

    it('preserves ISODate() inside double-quoted string', () => {
      const result = parseQuery('db.logs.find({msg: "ISODate(2024) is wrong"})');
      expect(result.args).toEqual([{ msg: 'ISODate(2024) is wrong' }]);
    });

    it('preserves ObjectId reference text in string', () => {
      const result = parseQuery('db.logs.find({msg: "missing ObjectId field"})');
      expect(result.args).toEqual([{ msg: 'missing ObjectId field' }]);
    });
  });

  // ===== 第七輪：語法容錯 =====
  describe('round 7: syntax tolerance', () => {
    it('handles trailing comma in object', () => {
      const result = parseQuery('db.users.find({name: "test", age: 25,})');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('handles extra whitespace around values', () => {
      const result = parseQuery('db.users.find({ name:  "test" ,  age:  25 })');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('handles new Date() as ISODate alternative', () => {
      const result = parseQuery('db.logs.find({created: new Date("2024-06-15")})');
      expect(result.args).toEqual([{ created: new Date('2024-06-15') }]);
    });

    it('handles scientific notation', () => {
      const result = parseQuery('db.data.find({value: {$gt: 1e3}})');
      expect(result.args).toEqual([{ value: { $gt: 1000 } }]);
    });
  });

  // ===== 第八輪：字串轉義與特殊字元 =====
  describe('round 8: escape sequences and special chars', () => {
    it('handles backslash in double-quoted string', () => {
      const result = parseQuery('db.files.find({path: "C:\\\\Users\\\\test"})');
      expect(result.args).toEqual([{ path: 'C:\\Users\\test' }]);
    });

    it('handles url with slashes in value', () => {
      const result = parseQuery('db.links.find({url: "https://example.com/path?q=1&b=2"})');
      expect(result.args).toEqual([{ url: 'https://example.com/path?q=1&b=2' }]);
    });

    it('handles email with @ and dots', () => {
      const result = parseQuery('db.users.find({email: "user@example.co.jp"})');
      expect(result.args).toEqual([{ email: 'user@example.co.jp' }]);
    });

    it('handles dollar sign in string value (not operator)', () => {
      const result = parseQuery('db.products.find({price: "$99.99"})');
      expect(result.args).toEqual([{ price: '$99.99' }]);
    });
  });

  // ===== 第九輪：多元參數模式 =====
  describe('round 9: diverse argument patterns', () => {
    it('handles single string argument (dropIndex)', () => {
      const result = parseQuery('db.users.dropIndex("email_1")');
      expect(result.args).toEqual(['email_1']);
    });

    it('handles single string argument with single quotes', () => {
      const result = parseQuery("db.users.dropIndex('email_1')");
      expect(result.args).toEqual(['email_1']);
    });

    it('handles createIndex with options', () => {
      const result = parseQuery('db.users.createIndex({email: 1}, {unique: true, sparse: true})');
      expect(result.args).toEqual([
        { email: 1 },
        { unique: true, sparse: true },
      ]);
    });

    it('handles compound index keys', () => {
      const result = parseQuery('db.orders.createIndex({userId: 1, created: -1})');
      expect(result.args).toEqual([{ userId: 1, created: -1 }]);
    });
  });

  // ===== 第十輪：Collection 名稱邊界 =====
  describe('round 10: collection name boundaries', () => {
    it('handles collection name starting with underscore', () => {
      const result = parseQuery('db._internal.find({})');
      expect(result.collection).toBe('_internal');
      expect(result.type).toBe('read');
    });

    it('handles collection name with multiple dots', () => {
      const result = parseQuery('db.a.b.c.find({})');
      expect(result.collection).toBe('a.b.c');
      expect(result.method).toBe('find');
    });

    it('handles single-char collection name', () => {
      const result = parseQuery('db.x.find({})');
      expect(result.collection).toBe('x');
    });

    it('handles numeric collection name', () => {
      const result = parseQuery('db.2024logs.find({})');
      expect(result.collection).toBe('2024logs');
    });
  });

  // ===== 第十一輪：查詢運算子 =====
  describe('round 11: query operators', () => {
    it('handles $not with regex-like string', () => {
      const result = parseQuery('db.users.find({name: {$not: {$regex: "^admin"}}})');
      expect(result.args).toEqual([{ name: { $not: { $regex: '^admin' } } }]);
    });

    it('handles $nin operator', () => {
      const result = parseQuery('db.users.find({role: {$nin: ["banned", "deleted"]}})');
      expect(result.args).toEqual([{ role: { $nin: ['banned', 'deleted'] } }]);
    });

    it('handles $all operator', () => {
      const result = parseQuery('db.posts.find({tags: {$all: ["js", "ts"]}})');
      expect(result.args).toEqual([{ tags: { $all: ['js', 'ts'] } }]);
    });

    it('handles $size operator', () => {
      const result = parseQuery('db.posts.find({comments: {$size: 5}})');
      expect(result.args).toEqual([{ comments: { $size: 5 } }]);
    });
  });

  // ===== 第十二輪：更新運算子 =====
  describe('round 12: update operators', () => {
    it('handles $push with value', () => {
      const result = parseQuery('db.users.updateOne({_id: "1"}, {$push: {tags: "new"}})');
      expect(result.args).toEqual([
        { _id: '1' },
        { $push: { tags: 'new' } },
      ]);
    });

    it('handles $inc operator', () => {
      const result = parseQuery('db.counters.updateOne({name: "visits"}, {$inc: {count: 1}})');
      expect(result.args).toEqual([
        { name: 'visits' },
        { $inc: { count: 1 } },
      ]);
    });

    it('handles $unset operator', () => {
      const result = parseQuery('db.users.updateMany({}, {$unset: {tmpField: ""}})');
      expect(result.args).toEqual([
        {},
        { $unset: { tmpField: '' } },
      ]);
    });

    it('handles multiple update operators', () => {
      const result = parseQuery(
        'db.users.updateOne({_id: "1"}, {$set: {name: "new"}, $inc: {version: 1}, $unset: {tmp: ""}})'
      );
      expect(result.args).toEqual([
        { _id: '1' },
        { $set: { name: 'new' }, $inc: { version: 1 }, $unset: { tmp: '' } },
      ]);
    });
  });

  // ===== 第十三輪：聚合管線進階 =====
  describe('round 13: advanced aggregate pipeline', () => {
    it('handles $project stage', () => {
      const result = parseQuery(
        'db.users.aggregate([{$project: {fullName: {$concat: ["$first", " ", "$last"]}, _id: 0}}])'
      );
      expect(result.args).toEqual([[{
        $project: { fullName: { $concat: ['$first', ' ', '$last'] }, _id: 0 },
      }]]);
    });

    it('handles $unwind stage', () => {
      const result = parseQuery('db.orders.aggregate([{$unwind: "$items"}])');
      expect(result.args).toEqual([[{ $unwind: '$items' }]]);
    });

    it('handles $addFields with expression', () => {
      const result = parseQuery(
        'db.orders.aggregate([{$addFields: {totalWithTax: {$multiply: ["$total", 1.1]}}}])'
      );
      expect(result.args).toEqual([[{
        $addFields: { totalWithTax: { $multiply: ['$total', 1.1] } },
      }]]);
    });

    it('handles $facet with multiple sub-pipelines', () => {
      const result = parseQuery(
        'db.orders.aggregate([{$facet: {byStatus: [{$group: {_id: "$status"}}], byDate: [{$group: {_id: "$date"}}]}}])'
      );
      expect(result.args).toEqual([[{
        $facet: {
          byStatus: [{ $group: { _id: '$status' } }],
          byDate: [{ $group: { _id: '$date' } }],
        },
      }]]);
    });
  });

  // ===== 第十四輪：大型/深層巢狀查詢 =====
  describe('round 14: large and deeply nested queries', () => {
    it('handles 4 levels of nesting', () => {
      const result = parseQuery('db.data.find({a: {b: {c: {d: {e: 1}}}}})');
      expect(result.args).toEqual([{ a: { b: { c: { d: { e: 1 } } } } }]);
    });

    it('handles many fields in one object', () => {
      const result = parseQuery(
        'db.users.find({a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8})'
      );
      expect(result.args).toEqual([{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 }]);
    });

    it('handles array of mixed-type objects', () => {
      const result = parseQuery(
        'db.data.insertMany([{type: "a", val: 1}, {type: "b", val: "two"}, {type: "c", val: true}])'
      );
      expect(result.args).toEqual([[
        { type: 'a', val: 1 },
        { type: 'b', val: 'two' },
        { type: 'c', val: true },
      ]]);
    });

    it('handles nested arrays inside objects', () => {
      const result = parseQuery(
        'db.users.find({$or: [{tags: {$in: ["a", "b"]}}, {scores: {$all: [90, 95]}}]})'
      );
      expect(result.args).toEqual([{
        $or: [
          { tags: { $in: ['a', 'b'] } },
          { scores: { $all: [90, 95] } },
        ],
      }]);
    });
  });

  // ===== 第十五輪：空白與格式化邊界 =====
  describe('round 15: whitespace and formatting', () => {
    it('handles tabs in query', () => {
      const result = parseQuery('db.users.find({\tname:\t"test"\t})');
      expect(result.args).toEqual([{ name: 'test' }]);
    });

    it('handles newlines in query', () => {
      const result = parseQuery('db.users.find({\n  name: "test",\n  age: 25\n})');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('handles no space after colon', () => {
      const result = parseQuery('db.users.find({name:"test",age:25})');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('handles spaces inside array', () => {
      const result = parseQuery('db.users.find({tags: { $in: [ "a" , "b" , "c" ] }})');
      expect(result.args).toEqual([{ tags: { $in: ['a', 'b', 'c'] } }]);
    });
  });

  // ===== 第十六輪：已加引號的 key 混合未加引號 =====
  describe('round 16: mixed quoted and unquoted keys', () => {
    it('handles all quoted keys', () => {
      const result = parseQuery('db.users.find({"name": "test", "age": 25})');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('handles mixed quoted and unquoted keys', () => {
      const result = parseQuery('db.users.find({"name": "test", age: 25})');
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('handles single-quoted keys', () => {
      const result = parseQuery("db.users.find({'name': 'test', 'age': 25})");
      expect(result.args).toEqual([{ name: 'test', age: 25 }]);
    });

    it('handles key with $ as quoted string', () => {
      const result = parseQuery('db.users.find({"$or": [{a: 1}, {b: 2}]})');
      expect(result.args).toEqual([{ $or: [{ a: 1 }, { b: 2 }] }]);
    });
  });

  // ===== 第十七輪：值為特殊 JSON 型別 =====
  describe('round 17: special JSON value types', () => {
    it('handles array of numbers', () => {
      const result = parseQuery('db.data.find({values: [1, 2, 3, 4, 5]})');
      expect(result.args).toEqual([{ values: [1, 2, 3, 4, 5] }]);
    });

    it('handles nested array of arrays', () => {
      const result = parseQuery('db.geo.find({coords: [[0, 0], [1, 1]]})');
      expect(result.args).toEqual([{ coords: [[0, 0], [1, 1]] }]);
    });

    it('handles object value with only $-prefixed keys', () => {
      const result = parseQuery('db.data.find({val: {$gt: 10, $lt: 100}})');
      expect(result.args).toEqual([{ val: { $gt: 10, $lt: 100 } }]);
    });

    it('handles mix of null, boolean, number, string in one object', () => {
      const result = parseQuery(
        'db.data.insertOne({str: "hello", num: 42, bool: true, nil: null})'
      );
      expect(result.args).toEqual([{ str: 'hello', num: 42, bool: true, nil: null }]);
    });
  });

  // ===== 第十八輪：insertMany 與陣列邊界 =====
  describe('round 18: insertMany and array boundaries', () => {
    it('handles insertMany with single document', () => {
      const result = parseQuery('db.users.insertMany([{name: "only"}])');
      expect(result.args).toEqual([[{ name: 'only' }]]);
    });

    it('handles insertMany with empty array', () => {
      const result = parseQuery('db.users.insertMany([])');
      expect(result.args).toEqual([[]]);
    });

    it('handles insertMany with ObjectId fields', () => {
      const result = parseQuery(
        'db.posts.insertMany([{title: "A", authorId: ObjectId("111111111111111111111111")}, {title: "B", authorId: ObjectId("222222222222222222222222")}])'
      );
      expect(result.args).toEqual([[
        { title: 'A', authorId: new ObjectId('111111111111111111111111') },
        { title: 'B', authorId: new ObjectId('222222222222222222222222') },
      ]]);
    });
  });

  // ===== 第十九輪：estimatedDocumentCount / dropIndexes / stats =====
  describe('round 19: no-arg and single-arg methods', () => {
    it('handles estimatedDocumentCount()', () => {
      const result = parseQuery('db.users.estimatedDocumentCount()');
      expect(result.type).toBe('read');
      expect(result.method).toBe('estimatedDocumentCount');
      expect(result.args).toEqual([]);
    });

    it('handles dropIndexes()', () => {
      const result = parseQuery('db.users.dropIndexes()');
      expect(result.type).toBe('write');
      expect(result.method).toBe('dropIndexes');
    });

    it('handles stats()', () => {
      const result = parseQuery('db.users.stats()');
      expect(result.type).toBe('read');
      expect(result.method).toBe('stats');
    });

    it('handles indexes()', () => {
      const result = parseQuery('db.users.indexes()');
      expect(result.type).toBe('read');
      expect(result.method).toBe('indexes');
    });
  });

  // ===== 第二十輪：ObjectId 在更新/投影語境 =====
  describe('round 20: BSON types in update/projection context', () => {
    it('handles ObjectId in updateOne filter', () => {
      const result = parseQuery(
        'db.users.updateOne({_id: ObjectId("507f1f77bcf86cd799439011")}, {$set: {name: "updated"}})'
      );
      expect(result.args).toEqual([
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        { $set: { name: 'updated' } },
      ]);
    });

    it('handles ISODate in $set update', () => {
      const result = parseQuery(
        'db.users.updateOne({_id: "1"}, {$set: {lastLogin: ISODate("2024-12-25T10:30:00Z")}})'
      );
      expect(result.args).toEqual([
        { _id: '1' },
        { $set: { lastLogin: new Date('2024-12-25T10:30:00Z') } },
      ]);
    });

    it('handles deleteOne with ObjectId', () => {
      const result = parseQuery(
        'db.sessions.deleteOne({_id: ObjectId("507f1f77bcf86cd799439011")})'
      );
      expect(result.args).toEqual([
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
      ]);
    });

    it('handles replaceOne with mixed BSON types', () => {
      const result = parseQuery(
        'db.records.replaceOne({_id: ObjectId("507f1f77bcf86cd799439011")}, {name: "new", created: ISODate("2024-01-01"), count: NumberLong(100)})'
      );
      expect(result.args).toEqual([
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        { name: 'new', created: new Date('2024-01-01'), count: Long.fromString('100') },
      ]);
    });
  });

  // ===== 掃描輪 A：trailing comma regex 破壞字串值 =====
  describe('scan A: trailing comma must not corrupt string values', () => {
    it('preserves string value containing ", }"', () => {
      const result = parseQuery('db.logs.find({msg: "end, }"})');
      expect(result.args).toEqual([{ msg: 'end, }' }]);
    });

    it('preserves string value containing ", ]"', () => {
      const result = parseQuery('db.logs.find({msg: "items: [a, ]"})');
      expect(result.args).toEqual([{ msg: 'items: [a, ]' }]);
    });

    it('handles trailing comma in array', () => {
      const result = parseQuery('db.users.find({tags: ["a", "b",]})');
      expect(result.args).toEqual([{ tags: ['a', 'b'] }]);
    });

    it('handles trailing comma in nested object', () => {
      const result = parseQuery('db.users.find({addr: {city: "Tokyo", zip: "100",},})');
      expect(result.args).toEqual([{ addr: { city: 'Tokyo', zip: '100' } }]);
    });

    it('preserves complex string with multiple }, ] patterns', () => {
      const result = parseQuery('db.logs.find({body: "json: {a: [1, ]}"})');
      expect(result.args).toEqual([{ body: 'json: {a: [1, ]}' }]);
    });
  });

  // ===== 掃描輪 B：BSON 在各種位置的邊界 =====
  describe('scan B: BSON at unusual positions', () => {
    it('handles ObjectId as sole argument (not in object)', () => {
      const result = parseQuery('db.users.findOne(ObjectId("507f1f77bcf86cd799439011"))');
      expect(result.args).toEqual([new ObjectId('507f1f77bcf86cd799439011')]);
    });

    it('handles string argument followed by object argument', () => {
      const result = parseQuery('db.users.createIndex({name: 1}, {name: "idx_name", unique: true})');
      expect(result.args).toEqual([
        { name: 1 },
        { name: 'idx_name', unique: true },
      ]);
    });

    it('handles BSON type after array open bracket', () => {
      const result = parseQuery(
        'db.changes.aggregate([{$match: {since: {$gte: ISODate("2024-01-01")}}}])'
      );
      expect(result.args).toEqual([[
        { $match: { since: { $gte: new Date('2024-01-01') } } },
      ]]);
    });
  });

  // ===== 掃描輪 C：引號與轉義邊界 =====
  describe('scan C: quote and escape edge cases', () => {
    it('handles empty single-quoted string', () => {
      const result = parseQuery("db.users.find({tag: ''})");
      expect(result.args).toEqual([{ tag: '' }]);
    });

    it('handles value with both quote types', () => {
      // double-quoted value containing single quotes
      const result = parseQuery('db.users.find({bio: "it\'s a \\"test\\""})');
      expect(result.args).toEqual([{ bio: 'it\'s a "test"' }]);
    });

    it('handles key immediately after opening brace (no space)', () => {
      const result = parseQuery('db.users.find({name:"test"})');
      expect(result.args).toEqual([{ name: 'test' }]);
    });

    it('handles multiple commas between args', () => {
      const result = parseQuery('db.users.find({a: 1}, {b: 1})');
      expect(result.args).toEqual([{ a: 1 }, { b: 1 }]);
    });
  });

  // ===== 掃描輪 D：掃描器邊界——尾逗號修復後的迴歸 =====
  describe('scan D: trailing comma fix regression', () => {
    it('normal comma between args is preserved', () => {
      const result = parseQuery('db.users.updateOne({a: 1}, {$set: {b: 2}})');
      expect(result.args).toEqual([{ a: 1 }, { $set: { b: 2 } }]);
    });

    it('comma in array is preserved', () => {
      const result = parseQuery('db.users.find({ids: [1, 2, 3]})');
      expect(result.args).toEqual([{ ids: [1, 2, 3] }]);
    });

    it('multiple trailing commas at different levels', () => {
      const result = parseQuery('db.users.find({tags: ["a",], active: true,})');
      expect(result.args).toEqual([{ tags: ['a'], active: true }]);
    });

    it('trailing comma followed by whitespace then closing', () => {
      const result = parseQuery('db.users.find({name: "test"  ,  })');
      expect(result.args).toEqual([{ name: 'test' }]);
    });
  });

  // ===== 掃描輪 E：BSON 與尾逗號交互 =====
  describe('scan E: BSON + trailing comma interaction', () => {
    it('BSON type before trailing comma', () => {
      const result = parseQuery('db.users.find({_id: ObjectId("507f1f77bcf86cd799439011"),})');
      expect(result.args).toEqual([{ _id: new ObjectId('507f1f77bcf86cd799439011') }]);
    });

    it('ISODate before trailing comma', () => {
      const result = parseQuery('db.logs.find({ts: ISODate("2024-01-01"),})');
      expect(result.args).toEqual([{ ts: new Date('2024-01-01') }]);
    });

    it('NumberLong before trailing comma in array', () => {
      const result = parseQuery('db.data.find({vals: {$in: [NumberLong(1), NumberLong(2),]}})');
      expect(result.args).toEqual([{
        vals: { $in: [Long.fromString('1'), Long.fromString('2')] },
      }]);
    });
  });

  // ===== 掃描輪 F：key quoting 邊界 =====
  describe('scan F: key quoting edge cases', () => {
    it('key starting with number', () => {
      const result = parseQuery('db.data.find({0: "first"})');
      expect(result.args).toEqual([{ '0': 'first' }]);
    });

    it('single-char key', () => {
      const result = parseQuery('db.data.find({x: 1})');
      expect(result.args).toEqual([{ x: 1 }]);
    });

    it('key with underscore only', () => {
      const result = parseQuery('db.data.find({_: true})');
      expect(result.args).toEqual([{ _: true }]);
    });

    it('$-prefixed key in nested position', () => {
      const result = parseQuery('db.data.find({a: {$gt: 1, $lt: 10}})');
      expect(result.args).toEqual([{ a: { $gt: 1, $lt: 10 } }]);
    });

    it('many $-prefixed keys in one object', () => {
      const result = parseQuery(
        'db.data.find({age: {$gte: 18, $lte: 65, $ne: 30, $exists: true}})'
      );
      expect(result.args).toEqual([{
        age: { $gte: 18, $lte: 65, $ne: 30, $exists: true },
      }]);
    });
  });

  // ===== 掃描輪 G：parseDbQuery 正則邊界 =====
  describe('scan G: parseDbQuery regex edge cases', () => {
    it('handles query with closing paren inside string value', () => {
      const result = parseQuery('db.logs.find({fn: "alert()"})');
      expect(result.args).toEqual([{ fn: 'alert()' }]);
    });

    it('handles query with multiple parens in string', () => {
      const result = parseQuery('db.logs.find({expr: "fn(a, b(c))"})');
      expect(result.args).toEqual([{ expr: 'fn(a, b(c))' }]);
    });

    it('handles query ending with string containing paren', () => {
      const result = parseQuery('db.logs.find({msg: "end)"})');
      expect(result.args).toEqual([{ msg: 'end)' }]);
    });

    it('handles findOne with ObjectId as direct arg', () => {
      const result = parseQuery('db.users.findOne(ObjectId("aabbccddee1122334455ff00"))');
      expect(result.args).toEqual([new ObjectId('aabbccddee1122334455ff00')]);
    });
  });

  // ===== 掃描輪 H：deserializeBsonTypes 邊界 =====
  describe('scan H: BSON deserialization edge cases', () => {
    it('does not convert $oid with extra keys', () => {
      // {$oid: "...", extra: 1} should NOT become ObjectId
      const result = parseQuery('db.data.find({filter: {$oid: "abc", extra: 1}})');
      expect(result.args).toEqual([{ filter: { $oid: 'abc', extra: 1 } }]);
    });

    it('handles deeply nested BSON type', () => {
      const result = parseQuery(
        'db.data.find({a: {b: {c: {id: ObjectId("507f1f77bcf86cd799439011")}}}})'
      );
      expect(result.args).toEqual([{
        a: { b: { c: { id: new ObjectId('507f1f77bcf86cd799439011') } } },
      }]);
    });

    it('handles BSON type in array inside nested object', () => {
      const result = parseQuery(
        'db.data.find({filters: [{ts: {$gte: ISODate("2024-01-01")}}, {ts: {$lte: ISODate("2024-12-31")}}]})'
      );
      expect(result.args).toEqual([{
        filters: [
          { ts: { $gte: new Date('2024-01-01') } },
          { ts: { $lte: new Date('2024-12-31') } },
        ],
      }]);
    });

    it('preserves regular $-prefixed object (not BSON)', () => {
      const result = parseQuery('db.data.find({val: {$gt: 10}})');
      const args = result.args as Array<Record<string, unknown>>;
      // $gt with value 10 should remain as-is, not be deserialized
      expect(args[0]).toEqual({ val: { $gt: 10 } });
    });
  });

  // ===== 掃描輪 I：完整查詢端到端 =====
  describe('scan I: end-to-end realistic queries', () => {
    it('complex updateOne with multiple operators and BSON', () => {
      const result = parseQuery(
        'db.users.updateOne({_id: ObjectId("507f1f77bcf86cd799439011")}, {$set: {name: "new", updatedAt: ISODate("2024-06-15")}, $inc: {loginCount: NumberLong(1)}})'
      );
      expect(result.args).toEqual([
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        {
          $set: { name: 'new', updatedAt: new Date('2024-06-15') },
          $inc: { loginCount: Long.fromString('1') },
        },
      ]);
    });

    it('aggregate with match + group + sort + limit pipeline', () => {
      const result = parseQuery(
        'db.orders.aggregate([{$match: {status: "paid", date: {$gte: ISODate("2024-01-01")}}}, {$group: {_id: "$userId", total: {$sum: "$amount"}}}, {$sort: {total: -1}}, {$limit: 10}])'
      );
      expect(result.args).toEqual([[
        { $match: { status: 'paid', date: { $gte: new Date('2024-01-01') } } },
        { $group: { _id: '$userId', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]]);
    });

    it('insertOne with nested object and array containing BSON', () => {
      const result = parseQuery(
        'db.events.insertOne({type: "click", userId: ObjectId("507f1f77bcf86cd799439011"), tags: ["ui", "btn"], meta: {ip: "1.2.3.4", ua: "Chrome"}, ts: ISODate("2024-06-15T12:00:00Z")})'
      );
      expect(result.args).toEqual([{
        type: 'click',
        userId: new ObjectId('507f1f77bcf86cd799439011'),
        tags: ['ui', 'btn'],
        meta: { ip: '1.2.3.4', ua: 'Chrome' },
        ts: new Date('2024-06-15T12:00:00Z'),
      }]);
    });
  });

  // ===== 掃描輪 J：壓力測試——刁鑽組合 =====
  describe('scan J: adversarial combinations', () => {
    it('string with BSON-like text + trailing comma + nested structure', () => {
      const result = parseQuery(
        'db.logs.find({msg: "ObjectId(123) failed, }", code: NumberInt(500),})'
      );
      expect(result.args).toEqual([{
        msg: 'ObjectId(123) failed, }',
        code: 500,
      }]);
    });

    it('single-quoted value with colon, comma, braces', () => {
      const result = parseQuery("db.data.find({tpl: '{name: \"test\", items: [1,]}'})");
      expect(result.args).toEqual([{ tpl: '{name: "test", items: [1,]}' }]);
    });

    it('aggregate with $concat containing special chars', () => {
      const result = parseQuery(
        'db.users.aggregate([{$project: {label: {$concat: ["ID:", " ", "$_id"]}}}])'
      );
      expect(result.args).toEqual([[{
        $project: { label: { $concat: ['ID:', ' ', '$_id'] } },
      }]]);
    });

    it('deleteMany with $and + $or + BSON combo', () => {
      const result = parseQuery(
        'db.sessions.deleteMany({$and: [{$or: [{expired: true}, {ts: {$lt: ISODate("2024-01-01")}}]}, {userId: ObjectId("507f1f77bcf86cd799439011")}]})'
      );
      expect(result.args).toEqual([{
        $and: [
          { $or: [{ expired: true }, { ts: { $lt: new Date('2024-01-01') } }] },
          { userId: new ObjectId('507f1f77bcf86cd799439011') },
        ],
      }]);
    });

    it('handles value "null" as string (not JSON null)', () => {
      const result = parseQuery('db.users.find({status: "null"})');
      expect(result.args).toEqual([{ status: 'null' }]);
    });

    it('handles numeric string value (not parsed as number)', () => {
      const result = parseQuery('db.users.find({zip: "12345"})');
      expect(result.args).toEqual([{ zip: '12345' }]);
    });

    it('aggregate $cond with nested ternary-like logic', () => {
      const result = parseQuery(
        'db.data.aggregate([{$project: {tier: {$cond: {if: {$gte: ["$score", 90]}, then: "A", else: "B"}}}}])'
      );
      expect(result.args).toEqual([[{
        $project: {
          tier: { $cond: { if: { $gte: ['$score', 90] }, then: 'A', else: 'B' } },
        },
      }]]);
    });
  });

  // ===== 掃描輪 K：單引號↔雙引號轉義修復後迴歸 =====
  describe('scan K: single-quote to double-quote escaping', () => {
    it('single-quoted value with embedded double quotes', () => {
      const result = parseQuery("db.data.find({html: '<div class=\"box\">'})");
      expect(result.args).toEqual([{ html: '<div class="box">' }]);
    });

    it('single-quoted value with no special chars', () => {
      const result = parseQuery("db.users.find({name: 'simple'})");
      expect(result.args).toEqual([{ name: 'simple' }]);
    });

    it('mixed single and double quoted values in same query', () => {
      const result = parseQuery("db.users.find({first: 'John', last: \"Doe\"})");
      expect(result.args).toEqual([{ first: 'John', last: 'Doe' }]);
    });

    it('single-quoted key with embedded double quotes', () => {
      // This is unusual but should not crash
      const result = parseQuery("db.data.find({'key': 'val'})");
      expect(result.args).toEqual([{ key: 'val' }]);
    });
  });

  // ===== 掃描輪 L：極端巢狀結構 =====
  describe('scan L: extreme nesting stress', () => {
    it('5 levels of object nesting with BSON at leaf', () => {
      const result = parseQuery(
        'db.data.find({a: {b: {c: {d: {e: ObjectId("507f1f77bcf86cd799439011")}}}}})'
      );
      expect(result.args).toEqual([{
        a: { b: { c: { d: { e: new ObjectId('507f1f77bcf86cd799439011') } } } },
      }]);
    });

    it('array of arrays of objects', () => {
      const result = parseQuery(
        'db.data.find({matrix: [[{x: 1}, {x: 2}], [{x: 3}, {x: 4}]]})'
      );
      expect(result.args).toEqual([{
        matrix: [[{ x: 1 }, { x: 2 }], [{ x: 3 }, { x: 4 }]],
      }]);
    });

    it('$or containing $and containing comparisons', () => {
      const result = parseQuery(
        'db.users.find({$or: [{$and: [{age: {$gte: 18}}, {age: {$lt: 30}}]}, {role: "admin"}]})'
      );
      expect(result.args).toEqual([{
        $or: [
          { $and: [{ age: { $gte: 18 } }, { age: { $lt: 30 } }] },
          { role: 'admin' },
        ],
      }]);
    });
  });

  // ===== 掃描輪 M：各方法的回傳型別正確性 =====
  describe('scan M: method type classification', () => {
    it.each([
      { query: 'db.x.find({})', type: 'read', method: 'find' },
      { query: 'db.x.findOne({})', type: 'read', method: 'findOne' },
      { query: 'db.x.countDocuments({})', type: 'read', method: 'countDocuments' },
      { query: 'db.x.estimatedDocumentCount()', type: 'read', method: 'estimatedDocumentCount' },
      { query: 'db.x.aggregate([])', type: 'read', method: 'aggregate' },
      { query: 'db.x.getIndexes()', type: 'read', method: 'getIndexes' },
      { query: 'db.x.indexes()', type: 'read', method: 'indexes' },
      { query: 'db.x.stats()', type: 'read', method: 'stats' },
      { query: 'db.x.insertOne({})', type: 'write', method: 'insertOne' },
      { query: 'db.x.insertMany([])', type: 'write', method: 'insertMany' },
      { query: 'db.x.updateOne({}, {})', type: 'write', method: 'updateOne' },
      { query: 'db.x.updateMany({}, {})', type: 'write', method: 'updateMany' },
      { query: 'db.x.replaceOne({}, {})', type: 'write', method: 'replaceOne' },
      { query: 'db.x.deleteOne({})', type: 'write', method: 'deleteOne' },
      { query: 'db.x.deleteMany({})', type: 'write', method: 'deleteMany' },
      { query: 'db.x.drop()', type: 'write', method: 'drop' },
      { query: 'db.x.createIndex({})', type: 'write', method: 'createIndex' },
      { query: 'db.x.dropIndex("a")', type: 'write', method: 'dropIndex' },
      { query: 'db.x.dropIndexes()', type: 'write', method: 'dropIndexes' },
    ])('$method → $type', ({ query, type, method }) => {
      const result = parseQuery(query);
      expect(result.type).toBe(type);
      expect(result.method).toBe(method);
    });
  });

  // ===== 掃描輪 N：isReadonlyOperation + hasWriteStages 交叉驗證 =====
  describe('scan N: readonly classification cross-check', () => {
    it('aggregate with $out is detected as write stage', () => {
      const parsed = parseQuery('db.data.aggregate([{$match: {}}, {$out: "result"}])');
      expect(parsed.type).toBe('read'); // parser says read
      expect(hasWriteStages(parsed.args[0] as unknown[])).toBe(true); // but has write stages
    });

    it('aggregate without $out/$merge is safe', () => {
      const parsed = parseQuery('db.data.aggregate([{$match: {}}, {$group: {_id: null}}])');
      expect(hasWriteStages(parsed.args[0] as unknown[])).toBe(false);
    });

    it('admin operations readonly check', () => {
      expect(isReadonlyOperation(parseQuery('show dbs'))).toBe(true);
      expect(isReadonlyOperation(parseQuery('show collections'))).toBe(true);
      expect(isReadonlyOperation(parseQuery('db.stats()'))).toBe(true);
      expect(isReadonlyOperation(parseQuery('db.dropDatabase()'))).toBe(false);
    });
  });

  // ===== 掃描輪 O：尾逗號 + 引號 + BSON 極端組合 =====
  describe('scan O: extreme combinations', () => {
    it('BSON in single-quoted key context (unusual but valid)', () => {
      // key in single quotes, value is BSON
      const result = parseQuery("db.data.find({'userId': ObjectId('507f1f77bcf86cd799439011')})");
      expect(result.args).toEqual([{ userId: new ObjectId('507f1f77bcf86cd799439011') }]);
    });

    it('empty object as one of multiple args', () => {
      const result = parseQuery('db.users.updateMany({}, {$set: {active: false}})');
      expect(result.args).toEqual([{}, { $set: { active: false } }]);
    });

    it('string value identical to BSON function name', () => {
      const result = parseQuery('db.data.find({type: "ObjectId"})');
      expect(result.args).toEqual([{ type: 'ObjectId' }]);
    });

    it('string value that is a partial BSON call', () => {
      const result = parseQuery('db.data.find({note: "use ObjectId( to query"})');
      expect(result.args).toEqual([{ note: 'use ObjectId( to query' }]);
    });

    it('number 0 in array', () => {
      const result = parseQuery('db.data.find({flags: {$all: [0, 1]}})');
      expect(result.args).toEqual([{ flags: { $all: [0, 1] } }]);
    });

    it('boolean false in nested position', () => {
      const result = parseQuery('db.data.find({settings: {notify: false, theme: "dark"}})');
      expect(result.args).toEqual([{ settings: { notify: false, theme: 'dark' } }]);
    });
  });

  // ===== 掃描輪 P：最終極端測試——混合所有已修復的 pattern =====
  describe('scan P: final adversarial battery', () => {
    it('single-quoted string with double quotes + trailing comma + BSON', () => {
      const result = parseQuery(
        "db.logs.insertOne({msg: 'error at \"line 5\", retried', ts: ISODate('2024-06-15'), code: NumberInt(500),})"
      );
      expect(result.args).toEqual([{
        msg: 'error at "line 5", retried',
        ts: new Date('2024-06-15'),
        code: 500,
      }]);
    });

    it('dotted collection + new Date + negative NumberLong + trailing comma', () => {
      const result = parseQuery(
        'db.audit.events.find({ts: {$gte: new Date("2024-01-01")}, offset: NumberLong(-100),})'
      );
      expect(result.args).toEqual([{
        ts: { $gte: new Date('2024-01-01') },
        offset: Long.fromString('-100'),
      }]);
    });

    it('aggregate with ISODate in $match + $project with $concat + trailing commas', () => {
      const result = parseQuery(
        'db.system.logs.aggregate([{$match: {ts: {$gte: ISODate("2024-01-01"),},},}, {$project: {label: {$concat: ["[", "$level", "] ", "$msg",]},},},])'
      );
      expect(result.args).toEqual([[
        { $match: { ts: { $gte: new Date('2024-01-01') } } },
        { $project: { label: { $concat: ['[', '$level', '] ', '$msg'] } } },
      ]]);
    });

    it('updateOne with ObjectId filter + $set with new Date + $inc NumberLong', () => {
      const result = parseQuery(
        "db.users.updateOne({_id: new ObjectId('507f1f77bcf86cd799439011')}, {$set: {lastSeen: new Date('2024-12-25')}, $inc: {visits: NumberLong(1)}})"
      );
      expect(result.args).toEqual([
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        { $set: { lastSeen: new Date('2024-12-25') }, $inc: { visits: Long.fromString('1') } },
      ]);
    });

    it('find with string value containing all dangerous patterns', () => {
      // String containing: comma+colon, trailing-comma-like, BSON-like text, braces
      const result = parseQuery(
        'db.logs.find({raw: "status: ok, data: {count: NumberLong(5), items: [1,]}"})'
      );
      expect(result.args).toEqual([{
        raw: 'status: ok, data: {count: NumberLong(5), items: [1,]}',
      }]);
    });

    it('insertMany with diverse BSON types per document', () => {
      const result = parseQuery(
        'db.events.insertMany([{uid: ObjectId("111111111111111111111111"), ts: ISODate("2024-01-01"), seq: NumberLong(1)}, {uid: ObjectId("222222222222222222222222"), ts: ISODate("2024-02-01"), seq: NumberLong(2)}])'
      );
      expect(result.args).toEqual([[
        {
          uid: new ObjectId('111111111111111111111111'),
          ts: new Date('2024-01-01'),
          seq: Long.fromString('1'),
        },
        {
          uid: new ObjectId('222222222222222222222222'),
          ts: new Date('2024-02-01'),
          seq: Long.fromString('2'),
        },
      ]]);
    });
  });

  describe('unknown queries', () => {
    it('returns unknown for invalid syntax', () => {
      expect(parseQuery('invalid').type).toBe('unknown');
      expect(parseQuery('select * from users').type).toBe('unknown');
      expect(parseQuery('').type).toBe('unknown');
    });

    it('returns unknown for whitespace only', () => {
      expect(parseQuery('   ').type).toBe('unknown');
      expect(parseQuery('\t\n').type).toBe('unknown');
    });

    it('returns unknown for partial db syntax', () => {
      expect(parseQuery('db').type).toBe('unknown');
      expect(parseQuery('database.users.find()').type).toBe('unknown');
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

describe('掃描第2輪', () => {
  it('巢狀 BSON：物件內含 ObjectId + NumberLong', () => {
    const result = parseQuery('db.data.find({nested: {id: ObjectId("507f1f77bcf86cd799439011"), count: NumberLong(123)}})');
    expect(result.args).toEqual([{
      nested: {
        id: new ObjectId('507f1f77bcf86cd799439011'),
        count: Long.fromString('123'),
      },
    }]);
  });

  it('陣列中的多個 ObjectId', () => {
    const result = parseQuery('db.data.find({ids: [ObjectId("aaaaaaaaaaaaaaaaaaaaaa11"), ObjectId("bbbbbbbbbbbbbbbbbbbbbb22")]})');
    expect(result.args).toEqual([{
      ids: [
        new ObjectId('aaaaaaaaaaaaaaaaaaaaaa11'),
        new ObjectId('bbbbbbbbbbbbbbbbbbbbbb22'),
      ],
    }]);
  });

  it('空字串 ObjectId 應解析（建構子處理驗證）', () => {
    // ObjectId("") 會被 parser 嘗試建構，mongodb driver 會拋錯或產生隨機 id
    // 這裡驗證 parser 不會崩潰
    const result = parseQuery('db.users.find({_id: ObjectId("")})');
    // parser 應該有回傳結果，不論 ObjectId 建構是否成功
    expect(result).toBeDefined();
    expect(result.method).toBe('find');
  });
});

describe('掃描第3輪', () => {
  describe('多行查詢', () => {
    it('查詢含換行符應正確解析', () => {
      const result = parseQuery('db.users.find({\n  name: "test"\n})');
      expect(result.method).toBe('find');
      expect(result.args).toEqual([{ name: 'test' }]);
    });

    it('多行查詢含多個欄位', () => {
      const result = parseQuery('db.users.find({\n  name: "test",\n  age: 25,\n  active: true\n})');
      expect(result.args).toEqual([{ name: 'test', age: 25, active: true }]);
    });
  });

  describe('方法鏈（不支援但不應崩潰）', () => {
    it('find().sort() 應返回 unknown 而非拋錯', () => {
      // db.users.find({}).sort({name: 1}) — 外層正則匹配到最外面的括號
      // 正則 ^db\.([\w.]+)\.(\w+)\(([\s\S]*)\)$ 需要最外面配對的括號
      const result = parseQuery('db.users.find({}).sort({name: 1})');
      // 不應拋錯
      expect(result).toBeDefined();
      // 由於正則 greedy 匹配，可能匹配到 sort 的結尾括號
      // 重點是不崩潰
      expect(['read', 'unknown']).toContain(result.type);
    });

    it('find().limit() 不應拋錯', () => {
      const result = parseQuery('db.users.find({}).limit(10)');
      expect(result).toBeDefined();
    });
  });

  describe('正規表達式', () => {
    it('$regex 操作符應正確解析', () => {
      const result = parseQuery('db.users.find({name: {$regex: "^test", $options: "i"}})');
      expect(result.args).toEqual([{ name: { $regex: '^test', $options: 'i' } }]);
    });

    it('regex literal 語法 /^test/i 解析不崩潰', () => {
      // regex literal 不是合法 JSON，parser 可能 fallback 到 raw string
      const result = parseQuery('db.users.find({name: /^test/i})');
      expect(result).toBeDefined();
      expect(result.method).toBe('find');
    });
  });

  describe('空白引號', () => {
    it('含空格的字串值', () => {
      const result = parseQuery('db.users.find({name: " "})');
      expect(result.args).toEqual([{ name: ' ' }]);
    });

    it('含多個空格的字串值', () => {
      const result = parseQuery('db.users.find({name: "   "})');
      expect(result.args).toEqual([{ name: '   ' }]);
    });
  });

  describe('巢狀陣列中的物件', () => {
    it('$or 含多個物件', () => {
      const result = parseQuery('db.users.find({$or: [{a: 1}, {b: 2}]})');
      expect(result.args).toEqual([{ $or: [{ a: 1 }, { b: 2 }] }]);
    });

    it('$and + $or 巢狀', () => {
      const result = parseQuery('db.users.find({$and: [{$or: [{x: 1}, {y: 2}]}, {z: 3}]})');
      expect(result.args).toEqual([{
        $and: [
          { $or: [{ x: 1 }, { y: 2 }] },
          { z: 3 },
        ],
      }]);
    });
  });

  describe('壓力測試：非常長的查詢', () => {
    it('很多欄位的查詢不應崩潰', () => {
      const fields = Array.from({ length: 20 }, (_, i) => `field${i}: ${i}`).join(', ');
      const query = `db.data.find({${fields}})`;
      const result = parseQuery(query);
      expect(result.method).toBe('find');
      expect(result.type).toBe('read');
      const arg = result.args[0] as Record<string, unknown>;
      expect(arg['field0']).toBe(0);
      expect(arg['field19']).toBe(19);
    });

    it('很長的字串值', () => {
      const longStr = 'x'.repeat(500);
      const result = parseQuery(`db.data.find({msg: "${longStr}"})`);
      expect(result.args).toEqual([{ msg: longStr }]);
    });
  });

  describe('中文欄位名和值', () => {
    it('中文 key 和 value', () => {
      const result = parseQuery('db.users.find({姓名: "張三"})');
      // 中文 key 無法被 $?\w+ 匹配（\w 不含中文）
      // 所以 parser 可能 fallback 到 raw string
      expect(result).toBeDefined();
      expect(result.method).toBe('find');
    });

    it('已加引號的中文 key', () => {
      const result = parseQuery('db.users.find({"姓名": "張三"})');
      // 雙引號包裹的中文 key 是合法 JSON key
      expect(result).toBeDefined();
      expect(result.method).toBe('find');
      // 加了引號的中文 key 應該通過 JSON.parse 正確解析
      const arg = result.args[0] as Record<string, unknown>;
      expect(arg['姓名']).toBe('張三');
    });
  });

  describe('不合法的查詢格式', () => {
    it('db.users. (結尾是點) 應返回 unknown', () => {
      const result = parseQuery('db.users.');
      expect(result.type).toBe('unknown');
    });

    it('db. 結尾應返回 unknown', () => {
      const result = parseQuery('db.');
      expect(result.type).toBe('unknown');
    });

    it('db.users.find( 缺少右括號不應崩潰', () => {
      const result = parseQuery('db.users.find(');
      expect(result).toBeDefined();
      // 正則不會匹配，返回 unknown
      expect(result.type).toBe('unknown');
    });

    it('db.users.find) 缺少左括號', () => {
      const result = parseQuery('db.users.find)');
      expect(result.type).toBe('unknown');
    });
  });

  describe('find with projection 傳遞驗證', () => {
    it('projection 作為第二個參數正確解析', () => {
      const result = parseQuery('db.users.find({}, {name: 1, _id: 0})');
      expect(result.args).toEqual([{}, { name: 1, _id: 0 }]);
    });

    it('有 filter 的 projection', () => {
      const result = parseQuery('db.users.find({active: true}, {name: 1, email: 1})');
      expect(result.args).toEqual([
        { active: true },
        { name: 1, email: 1 },
      ]);
    });
  });

  describe('aggregate 空 pipeline', () => {
    it('aggregate([]) 應正確解析', () => {
      const result = parseQuery('db.users.aggregate([])');
      expect(result.method).toBe('aggregate');
      expect(result.args).toEqual([[]]);
    });
  });

  describe('isReadonlyOperation 邊界', () => {
    it('unknown type 方法為 undefined', () => {
      expect(isReadonlyOperation({ type: 'unknown', args: [] })).toBe(false);
    });

    it('admin 的 dropDatabase 不是 readonly', () => {
      expect(isReadonlyOperation({ type: 'admin', method: 'dropDatabase', args: [] })).toBe(false);
    });

    it('admin 的空 method 不是 readonly', () => {
      expect(isReadonlyOperation({ type: 'admin', method: '', args: [] })).toBe(false);
    });
  });

  describe('hasWriteStages 邊界', () => {
    it('只有 $out 的 pipeline', () => {
      expect(hasWriteStages([{ $out: 'collection' }])).toBe(true);
    });

    it('$merge 在 pipeline 中間', () => {
      expect(hasWriteStages([
        { $match: {} },
        { $merge: { into: 'target' } },
        { $sort: { _id: 1 } },
      ])).toBe(true);
    });

    it('pipeline 含 null/undefined/string 混合', () => {
      expect(hasWriteStages([null, 'string', undefined, { $match: {} }])).toBe(false);
    });
  });

  describe('掃描第4輪', () => {
    describe('巢狀括號與深層結構', () => {
      it('陣列內含物件內含陣列內含物件', () => {
        const result = parseQuery('db.users.find({arr: [{a: [{b: 1}]}]})');
        expect(result.args).toEqual([{ arr: [{ a: [{ b: 1 }] }] }]);
      });

      it('物件值是字串但含 JSON-like 內容（單引號）', () => {
        const result = parseQuery("db.users.insertOne({data: '{\"key\": \"value\"}'})");
        expect(result.args).toEqual([{ data: '{"key": "value"}' }]);
      });

      it('物件值是字串但含 JSON-like 內容（雙引號）', () => {
        const result = parseQuery('db.users.insertOne({data: "{\\"key\\": \\"value\\"}"})');
        expect(result.args).toEqual([{ data: '{"key": "value"}' }]);
      });
    });

    describe('反斜線與 Unicode 轉義', () => {
      it('反斜線轉義：Windows 路徑', () => {
        const result = parseQuery('db.users.find({path: "C:\\\\Users\\\\test"})');
        expect(result.args).toEqual([{ path: 'C:\\Users\\test' }]);
      });

      it('Unicode escape 序列', () => {
        const result = parseQuery('db.users.find({name: "\\u4e2d\\u6587"})');
        // JSON.parse 會處理 \u escape
        const args = result.args as Array<Record<string, unknown>>;
        expect(args[0].name).toBe('中文');
      });
    });

    describe('連續多個 BSON type', () => {
      it('三個 ObjectId 在同一查詢', () => {
        const result = parseQuery(
          'db.users.find({a: ObjectId("aaaaaaaaaaaaaaaaaaaaaa11"), b: ObjectId("bbbbbbbbbbbbbbbbbbbbbb22"), c: ObjectId("cccccccccccccccccccccc33")})'
        );
        expect(result.args).toEqual([{
          a: new ObjectId('aaaaaaaaaaaaaaaaaaaaaa11'),
          b: new ObjectId('bbbbbbbbbbbbbbbbbbbbbb22'),
          c: new ObjectId('cccccccccccccccccccccc33'),
        }]);
      });

      it('ObjectId + ObjectId + NumberLong 混合', () => {
        const result = parseQuery(
          'db.users.find({a: ObjectId("aaaaaaaaaaaaaaaaaaaaaa11"), b: ObjectId("bbbbbbbbbbbbbbbbbbbbbb22"), c: NumberLong(123)})'
        );
        expect(result.args).toEqual([{
          a: new ObjectId('aaaaaaaaaaaaaaaaaaaaaa11'),
          b: new ObjectId('bbbbbbbbbbbbbbbbbbbbbb22'),
          c: Long.fromString('123'),
        }]);
      });
    });

    describe('方法名大小寫敏感', () => {
      it('db.users.Find({}) 大寫 F 應為 unknown', () => {
        const result = parseQuery('db.users.Find({})');
        // find 在 READONLY_METHODS 和 WRITE_METHODS 中，但 Find 不在
        expect(result.type).toBe('unknown');
        expect(result.method).toBe('Find');
      });

      it('db.users.INSERT({}) 全大寫應為 unknown', () => {
        const result = parseQuery('db.users.INSERT({})');
        expect(result.type).toBe('unknown');
        expect(result.method).toBe('INSERT');
      });
    });

    describe('collection 名稱邊界', () => {
      it('collection 名含數字', () => {
        const result = parseQuery('db.logs2024.find({})');
        expect(result.collection).toBe('logs2024');
        expect(result.type).toBe('read');
      });

      it('collection 名含底線', () => {
        const result = parseQuery('db.user_logs.find({})');
        expect(result.collection).toBe('user_logs');
        expect(result.type).toBe('read');
      });
    });

    describe('ObjectId 邊界', () => {
      it('ObjectId() 無參數不應崩潰', () => {
        // ObjectId() 沒有引號包裹的參數，BSON_PATTERNS 的正則不會匹配
        // parser 會 fallback 到原始字串
        const result = parseQuery('db.users.find({_id: ObjectId()})');
        expect(result).toBeDefined();
        expect(result.method).toBe('find');
        // 不應崩潰，args 可能是 fallback
      });

      it('ObjectId 含非 hex 字元不應崩潰', () => {
        // BSON_PATTERNS 會匹配 ObjectId("...") 不論內容
        // 但 new ObjectId("ZZZ...") 會拋錯，被 catch 處理
        const result = parseQuery('db.users.find({_id: ObjectId("ZZZZZZZZZZZZZZZZZZZZZZZZ")})');
        expect(result).toBeDefined();
        expect(result.method).toBe('find');
        // parser 的 catch 會返回原始字串 fallback
      });
    });

    describe('NumberLong 溢出', () => {
      it('超大數字不應崩潰', () => {
        const result = parseQuery('db.data.find({n: NumberLong(99999999999999999999)})');
        expect(result).toBeDefined();
        expect(result.method).toBe('find');
        // NumberLong 模式匹配 (-?\d+)，超大數字仍會被匹配
        // Long.fromString 可能會截斷或拋錯，但 parseArguments 有 catch
      });
    });

    describe('JS 注釋語法', () => {
      it('查詢含 /* comment */ 不應崩潰', () => {
        const result = parseQuery('db.users.find({/* comment */name: "test"})');
        expect(result).toBeDefined();
        expect(result.method).toBe('find');
        // convertToJson 不處理 JS 注釋，可能導致 JSON.parse 失敗
        // 但 parseArguments 有 catch，會 fallback 到原始字串
      });
    });

    describe('$in 操作符含多值', () => {
      it('$in 含 3 個字串值', () => {
        const result = parseQuery('db.users.find({status: {$in: ["active", "pending", "blocked"]}})');
        expect(result.args).toEqual([{
          status: { $in: ['active', 'pending', 'blocked'] },
        }]);
      });
    });

    describe('projection 含 0/1 混合', () => {
      it('find 的 projection 含 inclusion 和 exclusion', () => {
        const result = parseQuery('db.users.find({}, {name: 1, age: 0})');
        expect(result.args).toEqual([{}, { name: 1, age: 0 }]);
      });

      it('projection 含多個 0 和 1', () => {
        const result = parseQuery('db.users.find({}, {name: 1, email: 1, age: 0, _id: 0})');
        expect(result.args).toEqual([{}, { name: 1, email: 1, age: 0, _id: 0 }]);
      });
    });

    describe('show 命令大小寫', () => {
      it('SHOW DBS 全大寫', () => {
        const result = parseQuery('SHOW DBS');
        expect(result.type).toBe('admin');
        expect(result.method).toBe('listDatabases');
      });

      it('Show Collections 混合大小寫', () => {
        const result = parseQuery('Show Collections');
        expect(result.type).toBe('admin');
        expect(result.method).toBe('listCollections');
      });

      it('sHoW dBs 隨機大小寫', () => {
        const result = parseQuery('sHoW dBs');
        expect(result.type).toBe('admin');
        expect(result.method).toBe('listDatabases');
      });
    });

    describe('use 命令含空格資料庫名', () => {
      it('use my db 應只取第一個 word', () => {
        const result = parseQuery('use my db');
        // parseUseCommand 的正則 /^use\s+(\w+)/i 只匹配第一個 word
        expect(result.type).toBe('admin');
        expect(result.method).toBe('use');
        expect(result.args).toEqual(['my']);
      });
    });

    describe('show 未知目標', () => {
      it('show users 應返回 unknown', () => {
        const result = parseQuery('show users');
        expect(result.type).toBe('unknown');
      });

      it('show indexes 應返回 unknown', () => {
        const result = parseQuery('show indexes');
        expect(result.type).toBe('unknown');
      });

      it('show 後面跟數字', () => {
        const result = parseQuery('show 123');
        expect(result.type).toBe('unknown');
      });
    });

    describe('極端 BSON 邊界組合', () => {
      it('ObjectId 在 $nin 陣列中', () => {
        const result = parseQuery(
          'db.users.find({_id: {$nin: [ObjectId("aaaaaaaaaaaaaaaaaaaaaa11"), ObjectId("bbbbbbbbbbbbbbbbbbbbbb22")]}})'
        );
        expect(result.args).toEqual([{
          _id: {
            $nin: [
              new ObjectId('aaaaaaaaaaaaaaaaaaaaaa11'),
              new ObjectId('bbbbbbbbbbbbbbbbbbbbbb22'),
            ],
          },
        }]);
      });

      it('ISODate + NumberLong + ObjectId 全在 $and 內', () => {
        const result = parseQuery(
          'db.data.find({$and: [{ts: {$gte: ISODate("2024-01-01")}}, {count: {$gt: NumberLong(100)}}, {uid: ObjectId("507f1f77bcf86cd799439011")}]})'
        );
        expect(result.args).toEqual([{
          $and: [
            { ts: { $gte: new Date('2024-01-01') } },
            { count: { $gt: Long.fromString('100') } },
            { uid: new ObjectId('507f1f77bcf86cd799439011') },
          ],
        }]);
      });

      it('NumberLong 負值 + trailing comma + nested object', () => {
        const result = parseQuery(
          'db.data.find({meta: {offset: NumberLong(-50), limit: NumberLong(10),},})'
        );
        expect(result.args).toEqual([{
          meta: {
            offset: Long.fromString('-50'),
            limit: Long.fromString('10'),
          },
        }]);
      });
    });

    describe('字串中含所有危險模式', () => {
      it('字串同時含 ObjectId()、ISODate()、NumberLong()', () => {
        const result = parseQuery(
          'db.logs.find({msg: "ObjectId(abc) ISODate(2024) NumberLong(999)"})'
        );
        expect(result.args).toEqual([{
          msg: 'ObjectId(abc) ISODate(2024) NumberLong(999)',
        }]);
      });

      it('單引號字串含巢狀括號和逗號', () => {
        const result = parseQuery("db.data.find({raw: 'fn(a, b(c, d))'})");
        expect(result.args).toEqual([{ raw: 'fn(a, b(c, d))' }]);
      });
    });
  });
});
