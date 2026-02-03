import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// Define mocks at module level
const mockCollection = {
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  estimatedDocumentCount: vi.fn(),
  aggregate: vi.fn(),
  indexes: vi.fn(),
  insertOne: vi.fn(),
  insertMany: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
  replaceOne: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  drop: vi.fn(),
  createIndex: vi.fn(),
  dropIndex: vi.fn(),
  dropIndexes: vi.fn(),
};

const mockDb = {
  collection: vi.fn(() => mockCollection),
  listCollections: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
  stats: vi.fn(),
  command: vi.fn(),
  dropDatabase: vi.fn(),
};

const mockAdmin = {
  listDatabases: vi.fn(),
};

// Mock client module
vi.mock('./client.js', () => ({
  mongoClient: {
    getDb: vi.fn(() => mockDb),
    getAdmin: vi.fn(() => mockAdmin),
    setCurrentDb: vi.fn(),
  },
}));

import { executeQuery } from './executor.js';

describe('executeQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock implementations
    mockCollection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.countDocuments.mockResolvedValue(0);
    mockCollection.estimatedDocumentCount.mockResolvedValue(0);
    mockCollection.aggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
    mockCollection.indexes.mockResolvedValue([]);
    mockCollection.insertOne.mockResolvedValue({ insertedId: '123', acknowledged: true });
    mockCollection.insertMany.mockResolvedValue({ insertedCount: 2, insertedIds: {}, acknowledged: true });
    mockCollection.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1, acknowledged: true });
    mockCollection.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2, acknowledged: true });
    mockCollection.replaceOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1, acknowledged: true });
    mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1, acknowledged: true });
    mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5, acknowledged: true });
    mockCollection.drop.mockResolvedValue(true);
    mockCollection.createIndex.mockResolvedValue('index_1');
    mockCollection.dropIndex.mockResolvedValue(undefined);
    mockCollection.dropIndexes.mockResolvedValue(undefined);

    mockDb.stats.mockResolvedValue({ db: 'test', collections: 5 });
    mockDb.command.mockResolvedValue({ ns: 'test.users' });
    mockDb.dropDatabase.mockResolvedValue(true);

    mockAdmin.listDatabases.mockResolvedValue({ databases: [{ name: 'test' }] });
  });

  describe('read operations', () => {
    it('executes find', async () => {
      const result = await executeQuery('db.users.find()');
      expect(result).toEqual({
        success: true,
        data: [],
      });
      expect(mockCollection.find).toHaveBeenCalled();
    });

    it('executes findOne', async () => {
      mockCollection.findOne.mockResolvedValueOnce({ _id: '1', name: 'test' });
      const result = await executeQuery('db.users.findOne({name: "test"})');
      expect(result).toEqual({
        success: true,
        data: { _id: '1', name: 'test' },
      });
    });

    it('returns message when findOne finds nothing', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null);
      const result = await executeQuery('db.users.findOne({name: "notfound"})');
      expect(result).toEqual({
        success: true,
        data: { _message: 'No document found' },
      });
    });

    it('executes countDocuments', async () => {
      mockCollection.countDocuments.mockResolvedValueOnce(10);
      const result = await executeQuery('db.users.countDocuments({})');
      expect(result).toEqual({
        success: true,
        data: 10,
      });
    });

    it('executes aggregate', async () => {
      const result = await executeQuery('db.orders.aggregate([{$group: {_id: "$status"}}])');
      expect(result).toEqual({
        success: true,
        data: [],
      });
      expect(mockCollection.aggregate).toHaveBeenCalled();
    });

    it('executes getIndexes', async () => {
      const result = await executeQuery('db.users.getIndexes()');
      expect(result).toEqual({
        success: true,
        data: [],
      });
      expect(mockCollection.indexes).toHaveBeenCalled();
    });

    it('executes stats', async () => {
      const result = await executeQuery('db.users.stats()');
      expect(result).toEqual({
        success: true,
        data: { ns: 'test.users' },
      });
      expect(mockDb.command).toHaveBeenCalledWith({ collStats: 'users' });
    });

    it('executes estimatedDocumentCount', async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValueOnce(1000);
      const result = await executeQuery('db.users.estimatedDocumentCount()');
      expect(result).toEqual({
        success: true,
        data: 1000,
      });
    });

    it('executes indexes (alias)', async () => {
      mockCollection.indexes.mockResolvedValueOnce([{ key: { _id: 1 } }]);
      const result = await executeQuery('db.users.indexes()');
      expect(result).toEqual({
        success: true,
        data: [{ key: { _id: 1 } }],
      });
    });
  });

  describe('write operations', () => {
    it('executes insertOne', async () => {
      const result = await executeQuery('db.users.insertOne({name: "test"})');
      expect(result).toEqual({
        success: true,
        data: { insertedId: '123', acknowledged: true },
      });
    });

    it('executes insertMany', async () => {
      const result = await executeQuery('db.users.insertMany([{name: "a"}, {name: "b"}])');
      expect(result).toEqual({
        success: true,
        data: { insertedCount: 2, insertedIds: {}, acknowledged: true },
      });
    });

    it('executes updateOne', async () => {
      const result = await executeQuery('db.users.updateOne({name: "test"}, {$set: {age: 30}})');
      expect(result).toEqual({
        success: true,
        data: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      });
    });

    it('executes updateMany', async () => {
      const result = await executeQuery('db.users.updateMany({active: true}, {$set: {status: "active"}})');
      expect(result).toEqual({
        success: true,
        data: { matchedCount: 2, modifiedCount: 2, acknowledged: true },
      });
    });

    it('executes replaceOne', async () => {
      const result = await executeQuery('db.users.replaceOne({_id: "1"}, {name: "new"})');
      expect(result).toEqual({
        success: true,
        data: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      });
    });

    it('executes deleteOne', async () => {
      const result = await executeQuery('db.users.deleteOne({name: "test"})');
      expect(result).toEqual({
        success: true,
        data: { deletedCount: 1, acknowledged: true },
      });
    });

    it('executes deleteMany', async () => {
      const result = await executeQuery('db.users.deleteMany({active: false})');
      expect(result).toEqual({
        success: true,
        data: { deletedCount: 5, acknowledged: true },
      });
    });

    it('executes drop', async () => {
      const result = await executeQuery('db.users.drop()');
      expect(result).toEqual({
        success: true,
        data: { dropped: true },
      });
    });

    it('executes createIndex', async () => {
      const result = await executeQuery('db.users.createIndex({email: 1})');
      expect(result).toEqual({
        success: true,
        data: { indexName: 'index_1' },
      });
    });

    it('executes dropIndex', async () => {
      const result = await executeQuery('db.users.dropIndex("email_1")');
      expect(result).toEqual({
        success: true,
        data: { dropped: true },
      });
    });

    it('executes dropIndexes', async () => {
      const result = await executeQuery('db.users.dropIndexes()');
      expect(result).toEqual({
        success: true,
        data: { dropped: true },
      });
    });
  });

  describe('admin operations', () => {
    it('executes show dbs', async () => {
      const result = await executeQuery('show dbs');
      expect(result).toEqual({
        success: true,
        data: [{ name: 'test' }],
      });
      expect(mockAdmin.listDatabases).toHaveBeenCalled();
    });

    it('executes use database', async () => {
      const result = await executeQuery('use mydb');
      expect(result).toEqual({
        success: true,
        data: 'switched to db mydb',
      });
    });

    it('executes show collections', async () => {
      mockDb.listCollections.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([{ name: 'users' }, { name: 'orders' }]),
      });
      const result = await executeQuery('show collections');
      expect(result).toEqual({
        success: true,
        data: [{ name: 'users' }, { name: 'orders' }],
      });
    });

    it('executes db.stats()', async () => {
      const result = await executeQuery('db.stats()');
      expect(result).toEqual({
        success: true,
        data: { db: 'test', collections: 5 },
      });
      expect(mockDb.stats).toHaveBeenCalled();
    });

    it('executes db.dropDatabase()', async () => {
      const result = await executeQuery('db.dropDatabase()');
      expect(result).toEqual({
        success: true,
        data: { dropped: true },
      });
      expect(mockDb.dropDatabase).toHaveBeenCalled();
    });

    it('executes db.getCollectionNames()', async () => {
      mockDb.listCollections.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([{ name: 'users' }]),
      });
      const result = await executeQuery('db.getCollectionNames()');
      expect(result).toEqual({
        success: true,
        data: [{ name: 'users' }],
      });
    });
  });

  describe('readonly mode', () => {
    it('allows read operations', async () => {
      const result = await executeQuery('db.users.find()', true);
      expect(result.success).toBe(true);
    });

    it('blocks write operations', async () => {
      const result = await executeQuery('db.users.insertOne({name: "test"})', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed in readonly mode');
    });

    it('blocks aggregate with $out', async () => {
      const result = await executeQuery('db.orders.aggregate([{$out: "results"}])', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed in readonly mode');
    });

    it('blocks aggregate with $merge', async () => {
      const result = await executeQuery('db.orders.aggregate([{$merge: {into: "results"}}])', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed in readonly mode');
    });

    it('allows aggregate without write stages', async () => {
      const result = await executeQuery('db.orders.aggregate([{$group: {_id: "$status"}}])', true);
      expect(result.success).toBe(true);
    });

    it('blocks dropDatabase in readonly mode', async () => {
      const result = await executeQuery('db.dropDatabase()', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed in readonly mode');
    });

    it('allows show dbs in readonly mode', async () => {
      const result = await executeQuery('show dbs', true);
      expect(result.success).toBe(true);
    });

    it('allows db.stats() in readonly mode', async () => {
      const result = await executeQuery('db.stats()', true);
      expect(result.success).toBe(true);
    });

    it('allows use command in readonly mode', async () => {
      const result = await executeQuery('use testdb', true);
      expect(result.success).toBe(true);
    });

    it('blocks updateOne in readonly mode', async () => {
      const result = await executeQuery('db.users.updateOne({}, {$set: {a: 1}})', true);
      expect(result.success).toBe(false);
    });

    it('blocks deleteOne in readonly mode', async () => {
      const result = await executeQuery('db.users.deleteOne({})', true);
      expect(result.success).toBe(false);
    });

    it('blocks drop in readonly mode', async () => {
      const result = await executeQuery('db.users.drop()', true);
      expect(result.success).toBe(false);
    });
  });

  describe('error handling', () => {
    it('returns error for unknown query', async () => {
      const result = await executeQuery('invalid query');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown query format');
    });

    it('returns error for unsupported method syntax', async () => {
      // unsupportedMethod is parsed as 'unknown' type by parser
      const result = await executeQuery('db.users.unsupportedMethod()');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles database errors', async () => {
      mockCollection.find.mockReturnValueOnce({
        toArray: vi.fn().mockRejectedValueOnce(new Error('Connection lost')),
      });
      const result = await executeQuery('db.users.find()');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection lost');
    });

    it('handles non-Error objects', async () => {
      mockCollection.find.mockReturnValueOnce({
        toArray: vi.fn().mockRejectedValueOnce('string error'),
      });
      const result = await executeQuery('db.users.find()');
      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('returns error for unsupported admin method', async () => {
      // This would require a custom parsed query, but we can test via the error path
      const result = await executeQuery('db.unknownAdminMethod()');
      expect(result.success).toBe(false);
    });
  });

  describe('掃描第2輪', () => {
    it('find with ObjectId filter 應正確傳入 collection.find', async () => {
      mockCollection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439011', name: 'test' }]) });
      const result = await executeQuery('db.users.find({_id: ObjectId("507f1f77bcf86cd799439011")})');
      expect(result.success).toBe(true);
      // 驗證 find 被呼叫時的第一個參數包含 ObjectId 實例
      const callArgs = mockCollection.find.mock.calls[0];
      expect(callArgs[0]).toEqual({ _id: new ObjectId('507f1f77bcf86cd799439011') });
    });

    it('insertOne with Date 應正確傳入 collection.insertOne', async () => {
      const result = await executeQuery('db.logs.insertOne({msg: "hello", ts: ISODate("2024-06-15T12:00:00Z")})');
      expect(result.success).toBe(true);
      const callArgs = mockCollection.insertOne.mock.calls[0];
      expect(callArgs[0].msg).toBe('hello');
      expect(callArgs[0].ts).toEqual(new Date('2024-06-15T12:00:00Z'));
    });
  });

  describe('掃描第3輪', () => {
    it('find with projection 應正確傳遞第二個參數', async () => {
      mockCollection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ name: 'test' }]) });
      const result = await executeQuery('db.users.find({}, {name: 1, _id: 0})');
      expect(result.success).toBe(true);
      const callArgs = mockCollection.find.mock.calls[0];
      // 第一個參數：filter
      expect(callArgs[0]).toEqual({});
      // 第二個參數：projection
      expect(callArgs[1]).toEqual({ name: 1, _id: 0 });
    });

    it('aggregate 空 pipeline 應正確執行', async () => {
      mockCollection.aggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
      const result = await executeQuery('db.users.aggregate([])');
      expect(result.success).toBe(true);
      expect(mockCollection.aggregate).toHaveBeenCalledWith([]);
    });

    it('不合法的查詢格式：db.users. 結尾是點', async () => {
      const result = await executeQuery('db.users.');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown query format');
    });

    it('findOne with projection 應正確傳遞', async () => {
      mockCollection.findOne.mockResolvedValueOnce({ name: 'test' });
      const result = await executeQuery('db.users.findOne({active: true}, {name: 1})');
      expect(result.success).toBe(true);
      const callArgs = mockCollection.findOne.mock.calls[0];
      expect(callArgs[0]).toEqual({ active: true });
      expect(callArgs[1]).toEqual({ name: 1 });
    });

    it('updateOne with upsert option 應傳遞第三個參數', async () => {
      const result = await executeQuery('db.users.updateOne({name: "test"}, {$set: {age: 30}}, {upsert: true})');
      expect(result.success).toBe(true);
      const callArgs = mockCollection.updateOne.mock.calls[0];
      expect(callArgs[0]).toEqual({ name: 'test' });
      expect(callArgs[1]).toEqual({ $set: { age: 30 } });
      expect(callArgs[2]).toEqual({ upsert: true });
    });

    it('readonly 模式下 find 允許執行', async () => {
      mockCollection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
      const result = await executeQuery('db.users.find({})', true);
      expect(result.success).toBe(true);
    });

    it('readonly 模式下 aggregate 含 $out 應被拒絕', async () => {
      const result = await executeQuery('db.data.aggregate([{$match: {}}, {$out: "result"}])', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed in readonly mode');
    });

    it('readonly 模式下 aggregate 含 $merge 應被拒絕', async () => {
      const result = await executeQuery('db.data.aggregate([{$merge: {into: "target"}}])', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed in readonly mode');
    });

    it('collection 操作錯誤應回傳 error', async () => {
      mockCollection.countDocuments.mockRejectedValueOnce(new Error('timeout'));
      const result = await executeQuery('db.users.countDocuments({})');
      expect(result.success).toBe(false);
      expect(result.error).toBe('timeout');
    });

    it('unknown method 應回傳 Unsupported method 錯誤', async () => {
      const result = await executeQuery('db.users.unknownMethod()');
      expect(result.success).toBe(false);
      // parser 回傳 unknown type → "Unknown query format"
      expect(result.error).toBeDefined();
    });

    it('空查詢字串應回傳 error', async () => {
      const result = await executeQuery('');
      expect(result.success).toBe(false);
    });
  });

  describe('掃描第4輪', () => {
    it('SHOW DBS 全大寫應正確執行', async () => {
      const result = await executeQuery('SHOW DBS');
      expect(result.success).toBe(true);
      expect(mockAdmin.listDatabases).toHaveBeenCalled();
    });

    it('Show Collections 混合大小寫應正確執行', async () => {
      mockDb.listCollections.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([{ name: 'test_col' }]),
      });
      const result = await executeQuery('Show Collections');
      expect(result.success).toBe(true);
    });

    it('use my db 含空格應只取第一個 word', async () => {
      const result = await executeQuery('use my db');
      expect(result.success).toBe(true);
      expect(result.data).toBe('switched to db my');
    });

    it('show users 未知目標應回傳 error', async () => {
      const result = await executeQuery('show users');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown query format');
    });

    it('show indexes 未知目標應回傳 error', async () => {
      const result = await executeQuery('show indexes');
      expect(result.success).toBe(false);
    });

    it('readonly 模式下 createIndex 應被拒絕', async () => {
      const result = await executeQuery('db.users.createIndex({email: 1})', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed in readonly mode');
    });

    it('readonly 模式下 dropIndexes 應被拒絕', async () => {
      const result = await executeQuery('db.users.dropIndexes()', true);
      expect(result.success).toBe(false);
    });

    it('readonly 模式下 replaceOne 應被拒絕', async () => {
      const result = await executeQuery('db.users.replaceOne({_id: "1"}, {name: "new"})', true);
      expect(result.success).toBe(false);
    });

    it('readonly 模式下 deleteMany 應被拒絕', async () => {
      const result = await executeQuery('db.users.deleteMany({})', true);
      expect(result.success).toBe(false);
    });

    it('insertMany 錯誤應正確回傳', async () => {
      mockCollection.insertMany.mockRejectedValueOnce(new Error('Duplicate key'));
      const result = await executeQuery('db.users.insertMany([{name: "dup"}, {name: "dup"}])');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Duplicate key');
    });

    it('updateMany 含 upsert option', async () => {
      const result = await executeQuery('db.users.updateMany({status: "old"}, {$set: {status: "new"}}, {upsert: true})');
      expect(result.success).toBe(true);
      const callArgs = mockCollection.updateMany.mock.calls[0];
      expect(callArgs[2]).toEqual({ upsert: true });
    });

    it('replaceOne 含 option', async () => {
      const result = await executeQuery('db.users.replaceOne({_id: "1"}, {name: "replaced"}, {upsert: true})');
      expect(result.success).toBe(true);
      const callArgs = mockCollection.replaceOne.mock.calls[0];
      expect(callArgs[2]).toEqual({ upsert: true });
    });

    it('readonly 模式下 show tables 應允許', async () => {
      mockDb.listCollections.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([]),
      });
      const result = await executeQuery('show tables', true);
      expect(result.success).toBe(true);
    });

    it('readonly 模式下 estimatedDocumentCount 應允許', async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValueOnce(42);
      const result = await executeQuery('db.users.estimatedDocumentCount()', true);
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });
  });
});
