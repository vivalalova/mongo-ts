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
      expect(result.success).toBe(true);
      expect(mockCollection.find).toHaveBeenCalled();
    });

    it('executes findOne', async () => {
      mockCollection.findOne.mockResolvedValueOnce({ _id: '1', name: 'test' });
      const result = await executeQuery('db.users.findOne({name: "test"})');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ _id: '1', name: 'test' });
    });

    it('returns message when findOne finds nothing', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null);
      const result = await executeQuery('db.users.findOne({name: "notfound"})');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ _message: 'No document found' });
    });

    it('executes countDocuments', async () => {
      mockCollection.countDocuments.mockResolvedValueOnce(10);
      const result = await executeQuery('db.users.countDocuments({})');
      expect(result.success).toBe(true);
      expect(result.data).toBe(10);
    });

    it('executes aggregate', async () => {
      const result = await executeQuery('db.orders.aggregate([{$group: {_id: "$status"}}])');
      expect(result.success).toBe(true);
      expect(mockCollection.aggregate).toHaveBeenCalled();
    });

    it('executes getIndexes', async () => {
      const result = await executeQuery('db.users.getIndexes()');
      expect(result.success).toBe(true);
      expect(mockCollection.indexes).toHaveBeenCalled();
    });

    it('executes stats', async () => {
      const result = await executeQuery('db.users.stats()');
      expect(result.success).toBe(true);
      expect(mockDb.command).toHaveBeenCalledWith({ collStats: 'users' });
    });
  });

  describe('write operations', () => {
    it('executes insertOne', async () => {
      const result = await executeQuery('db.users.insertOne({name: "test"})');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('insertedId');
    });

    it('executes insertMany', async () => {
      const result = await executeQuery('db.users.insertMany([{name: "a"}, {name: "b"}])');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('insertedCount');
    });

    it('executes updateOne', async () => {
      const result = await executeQuery('db.users.updateOne({name: "test"}, {$set: {age: 30}})');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('modifiedCount');
    });

    it('executes updateMany', async () => {
      const result = await executeQuery('db.users.updateMany({active: true}, {$set: {status: "active"}})');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('modifiedCount');
    });

    it('executes replaceOne', async () => {
      const result = await executeQuery('db.users.replaceOne({_id: "1"}, {name: "new"})');
      expect(result.success).toBe(true);
    });

    it('executes deleteOne', async () => {
      const result = await executeQuery('db.users.deleteOne({name: "test"})');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deletedCount');
    });

    it('executes deleteMany', async () => {
      const result = await executeQuery('db.users.deleteMany({active: false})');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deletedCount');
    });

    it('executes drop', async () => {
      const result = await executeQuery('db.users.drop()');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('dropped');
    });

    it('executes createIndex', async () => {
      const result = await executeQuery('db.users.createIndex({email: 1})');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('indexName');
    });

    it('executes dropIndex', async () => {
      const result = await executeQuery('db.users.dropIndex("email_1")');
      expect(result.success).toBe(true);
    });

    it('executes dropIndexes', async () => {
      const result = await executeQuery('db.users.dropIndexes()');
      expect(result.success).toBe(true);
    });
  });

  describe('admin operations', () => {
    it('executes show dbs', async () => {
      const result = await executeQuery('show dbs');
      expect(result.success).toBe(true);
      expect(mockAdmin.listDatabases).toHaveBeenCalled();
    });

    it('executes use database', async () => {
      const result = await executeQuery('use mydb');
      expect(result.success).toBe(true);
      expect(result.data).toBe('switched to db mydb');
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
