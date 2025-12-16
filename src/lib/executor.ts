import { Document } from 'mongodb';
import { mongoClient } from './client.js';
import { parseQuery, isReadonlyOperation, hasWriteStages } from '../utils/parser.js';
import type { ExecutionResult, ParsedQuery } from '../types/index.js';

/**
 * 執行 MongoDB 查詢
 * @param query - 查詢字串
 * @param readonly - 是否為唯讀模式
 */
export async function executeQuery(
  query: string,
  readonly: boolean = false
): Promise<ExecutionResult> {
  const parsed = parseQuery(query);

  // 唯讀模式檢查
  if (readonly && !isReadonlyOperation(parsed)) {
    return {
      success: false,
      error: `Operation not allowed in readonly mode: ${parsed.method || query}`,
    };
  }

  try {
    const result = await executeOperation(parsed, readonly);
    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * 執行解析後的操作
 */
async function executeOperation(
  parsed: ParsedQuery,
  readonly: boolean
): Promise<Document | Document[] | string | number> {
  const { type, collection, method, args } = parsed;

  // Admin 操作
  if (type === 'admin') {
    return executeAdminOperation(method!, args);
  }

  // 未知查詢
  if (type === 'unknown') {
    throw new Error(`Unknown query format. Use "db.<collection>.<method>(...)" syntax.`);
  }

  // 集合操作
  if (!collection || !method) {
    throw new Error('Invalid query: missing collection or method');
  }

  const db = mongoClient.getDb();
  const coll = db.collection(collection);

  // 特殊處理 aggregate
  if (method === 'aggregate' && readonly) {
    const pipeline = (args[0] as Document[]) || [];
    if (hasWriteStages(pipeline)) {
      throw new Error('Aggregate with $out or $merge is not allowed in readonly mode');
    }
  }

  switch (method) {
    // 讀取操作
    case 'find':
      return coll.find(args[0] as Document, args[1] as Document).toArray();

    case 'findOne':
      return (await coll.findOne(args[0] as Document, args[1] as Document)) || { _message: 'No document found' };

    case 'countDocuments':
      return coll.countDocuments(args[0] as Document);

    case 'estimatedDocumentCount':
      return coll.estimatedDocumentCount();

    case 'aggregate':
      return coll.aggregate(args[0] as Document[]).toArray();

    case 'getIndexes':
    case 'indexes':
      return coll.indexes();

    case 'stats':
      return db.command({ collStats: collection });

    // 寫入操作
    case 'insertOne': {
      const insertResult = await coll.insertOne(args[0] as Document);
      return { insertedId: insertResult.insertedId, acknowledged: insertResult.acknowledged };
    }

    case 'insertMany': {
      const insertManyResult = await coll.insertMany(args[0] as Document[]);
      return {
        insertedCount: insertManyResult.insertedCount,
        insertedIds: insertManyResult.insertedIds,
        acknowledged: insertManyResult.acknowledged,
      };
    }

    case 'updateOne': {
      const updateResult = await coll.updateOne(
        args[0] as Document,
        args[1] as Document,
        args[2] as Document
      );
      return {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        acknowledged: updateResult.acknowledged,
      };
    }

    case 'updateMany': {
      const updateManyResult = await coll.updateMany(
        args[0] as Document,
        args[1] as Document,
        args[2] as Document
      );
      return {
        matchedCount: updateManyResult.matchedCount,
        modifiedCount: updateManyResult.modifiedCount,
        acknowledged: updateManyResult.acknowledged,
      };
    }

    case 'replaceOne': {
      const replaceResult = await coll.replaceOne(
        args[0] as Document,
        args[1] as Document,
        args[2] as Document
      );
      return {
        matchedCount: replaceResult.matchedCount,
        modifiedCount: replaceResult.modifiedCount,
        acknowledged: replaceResult.acknowledged,
      };
    }

    case 'deleteOne': {
      const deleteResult = await coll.deleteOne(args[0] as Document);
      return {
        deletedCount: deleteResult.deletedCount,
        acknowledged: deleteResult.acknowledged,
      };
    }

    case 'deleteMany': {
      const deleteManyResult = await coll.deleteMany(args[0] as Document);
      return {
        deletedCount: deleteManyResult.deletedCount,
        acknowledged: deleteManyResult.acknowledged,
      };
    }

    case 'drop': {
      const dropped = await coll.drop();
      return { dropped };
    }

    case 'createIndex': {
      const indexName = await coll.createIndex(args[0] as Document, args[1] as Document);
      return { indexName };
    }

    case 'dropIndex': {
      await coll.dropIndex(args[0] as string);
      return { dropped: true };
    }

    case 'dropIndexes': {
      await coll.dropIndexes();
      return { dropped: true };
    }

    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

/**
 * 執行管理操作
 */
async function executeAdminOperation(
  method: string,
  args: unknown[]
): Promise<Document | Document[] | string> {
  switch (method) {
    case 'listDatabases': {
      const admin = mongoClient.getAdmin();
      const result = await admin.listDatabases();
      return result.databases;
    }

    case 'listCollections': {
      const db = mongoClient.getDb();
      const collections = await db.listCollections().toArray();
      return collections;
    }

    case 'use': {
      const dbName = args[0] as string;
      mongoClient.setCurrentDb(dbName);
      return `switched to db ${dbName}`;
    }

    case 'dbStats': {
      const db = mongoClient.getDb();
      return db.stats();
    }

    case 'dropDatabase': {
      const db = mongoClient.getDb();
      const result = await db.dropDatabase();
      return { dropped: result };
    }

    default:
      throw new Error(`Unsupported admin method: ${method}`);
  }
}
