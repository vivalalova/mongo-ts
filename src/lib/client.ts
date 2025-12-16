import { MongoClient, Db, Admin } from 'mongodb';
import { URL } from 'node:url';
import { logger } from '../utils/logger.js';

/**
 * MongoDB 客戶端管理器（單例模式）
 */
class MongoClientManager {
  private static instance: MongoClientManager;
  private client: MongoClient | null = null;
  private currentDbName: string | null = null;

  private constructor() {}

  /**
   * 取得單例實例
   */
  static getInstance(): MongoClientManager {
    if (!MongoClientManager.instance) {
      MongoClientManager.instance = new MongoClientManager();
    }
    return MongoClientManager.instance;
  }

  /**
   * 連線到 MongoDB
   * @param uri - 連線字串
   */
  async connect(uri: string): Promise<MongoClient> {
    if (this.client) {
      return this.client;
    }

    logger.debug(`Connecting to MongoDB...`);
    this.client = new MongoClient(uri);
    await this.client.connect();
    logger.debug('Connected successfully');

    // 從 URI 解析資料庫名稱
    const dbFromUri = this.parseDbFromUri(uri);
    if (dbFromUri) {
      this.currentDbName = dbFromUri;
      logger.debug(`Database from URI: ${dbFromUri}`);
    }

    return this.client;
  }

  /**
   * 從 URI 解析資料庫名稱
   * @param uri - MongoDB 連線字串
   */
  private parseDbFromUri(uri: string): string | null {
    try {
      // mongodb://user:pass@host:port/database?options
      const url = new URL(uri);
      const pathname = url.pathname;
      if (pathname && pathname.length > 1) {
        return pathname.slice(1); // 移除開頭的 /
      }
    } catch (error) {
      logger.debug(`Failed to parse database from URI: ${error}`);
    }
    return null;
  }

  /**
   * 取得 MongoClient 實例
   */
  getClient(): MongoClient {
    if (!this.client) {
      throw new Error('Not connected to MongoDB. Call connect() first.');
    }
    return this.client;
  }

  /**
   * 取得資料庫實例
   * @param name - 資料庫名稱（可選，使用目前資料庫）
   */
  getDb(name?: string): Db {
    if (!this.client) {
      throw new Error('Not connected to MongoDB. Call connect() first.');
    }

    const dbName = name || this.currentDbName;
    if (!dbName) {
      throw new Error('No database selected. Use -d option or "use <database>" command.');
    }

    return this.client.db(dbName);
  }

  /**
   * 設定目前資料庫
   * @param name - 資料庫名稱
   */
  setCurrentDb(name: string): void {
    this.currentDbName = name;
    logger.debug(`Switched to database: ${name}`);
  }

  /**
   * 取得目前資料庫名稱
   */
  getCurrentDbName(): string | null {
    return this.currentDbName;
  }

  /**
   * 取得 Admin 實例
   */
  getAdmin(): Admin {
    if (!this.client) {
      throw new Error('Not connected to MongoDB. Call connect() first.');
    }
    return this.client.db().admin();
  }

  /**
   * 檢查是否已連線
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * 關閉連線
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.currentDbName = null;
      logger.debug('Connection closed');
    }
  }
}

/** 匯出單例 */
export const mongoClient = MongoClientManager.getInstance();
