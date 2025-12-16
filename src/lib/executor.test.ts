import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  });
});
