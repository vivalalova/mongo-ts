import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock mongodb with class
vi.mock('mongodb', () => {
  const mockDb = {
    collection: vi.fn().mockReturnValue({}),
    admin: vi.fn().mockReturnValue({}),
    listCollections: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    stats: vi.fn().mockResolvedValue({}),
    dropDatabase: vi.fn().mockResolvedValue(true),
    command: vi.fn().mockResolvedValue({}),
  };

  class MockMongoClient {
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    db = vi.fn().mockReturnValue(mockDb);
  }

  return {
    MongoClient: MockMongoClient,
    Db: vi.fn(),
    Admin: vi.fn(),
  };
});

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('mongoClient', () => {
  let mongoClient: typeof import('./client.js').mongoClient;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('./client.js');
    mongoClient = module.mongoClient;
  });

  afterEach(async () => {
    await mongoClient.close();
  });

  describe('connect', () => {
    it('connects to MongoDB', async () => {
      const client = await mongoClient.connect('mongodb://localhost:27017');
      expect(client).toBeDefined();
    });

    it('returns same client on multiple connects', async () => {
      const client1 = await mongoClient.connect('mongodb://localhost:27017');
      const client2 = await mongoClient.connect('mongodb://localhost:27017');
      expect(client1).toBe(client2);
    });

    it('parses database name from URI', async () => {
      await mongoClient.connect('mongodb://localhost:27017/testdb');
      expect(mongoClient.getCurrentDbName()).toBe('testdb');
    });

    it('parses database name from URI with options', async () => {
      await mongoClient.connect('mongodb://user:pass@localhost:27017/mydb?authSource=admin');
      expect(mongoClient.getCurrentDbName()).toBe('mydb');
    });

    it('does not set database when URI has no database', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      expect(mongoClient.getCurrentDbName()).toBe(null);
    });

    it('does not set database when URI ends with only slash', async () => {
      await mongoClient.connect('mongodb://localhost:27017/');
      expect(mongoClient.getCurrentDbName()).toBe(null);
    });

    it('handles invalid URI gracefully', async () => {
      await mongoClient.connect('not-a-valid-uri');
      expect(mongoClient.getCurrentDbName()).toBe(null);
    });
  });

  describe('getClient', () => {
    it('throws when not connected', () => {
      expect(() => mongoClient.getClient()).toThrow('Not connected');
    });

    it('returns client when connected', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      expect(() => mongoClient.getClient()).not.toThrow();
    });
  });

  describe('getDb', () => {
    it('throws when not connected', () => {
      expect(() => mongoClient.getDb()).toThrow('Not connected');
    });

    it('throws when no database selected', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      expect(() => mongoClient.getDb()).toThrow('No database selected');
    });

    it('returns db when database is set', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      mongoClient.setCurrentDb('testdb');
      expect(() => mongoClient.getDb()).not.toThrow();
    });

    it('returns specified db', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      mongoClient.setCurrentDb('default');
      const db = mongoClient.getDb('specific');
      expect(db).toBeDefined();
    });
  });

  describe('setCurrentDb', () => {
    it('sets current database', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      mongoClient.setCurrentDb('mydb');
      expect(mongoClient.getCurrentDbName()).toBe('mydb');
    });
  });

  describe('getCurrentDbName', () => {
    it('returns null when no database set', () => {
      expect(mongoClient.getCurrentDbName()).toBe(null);
    });

    it('returns database name when set', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      mongoClient.setCurrentDb('testdb');
      expect(mongoClient.getCurrentDbName()).toBe('testdb');
    });
  });

  describe('getAdmin', () => {
    it('throws when not connected', () => {
      expect(() => mongoClient.getAdmin()).toThrow('Not connected');
    });

    it('returns admin when connected', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      expect(() => mongoClient.getAdmin()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('returns false when not connected', () => {
      expect(mongoClient.isConnected()).toBe(false);
    });

    it('returns true when connected', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      expect(mongoClient.isConnected()).toBe(true);
    });
  });

  describe('close', () => {
    it('closes connection', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      await mongoClient.close();
      expect(mongoClient.isConnected()).toBe(false);
    });

    it('resets database name', async () => {
      await mongoClient.connect('mongodb://localhost:27017');
      mongoClient.setCurrentDb('testdb');
      await mongoClient.close();
      expect(mongoClient.getCurrentDbName()).toBe(null);
    });

    it('handles close when not connected', async () => {
      await expect(mongoClient.close()).resolves.not.toThrow();
    });
  });
});
