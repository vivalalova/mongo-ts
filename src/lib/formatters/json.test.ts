import { describe, it, expect } from 'vitest';
import { Long, ObjectId } from 'mongodb';
import { formatJson } from './json.js';

describe('formatJson', () => {
  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ _id: '123', name: 'test' });
  });

  it('formats multiple documents as array', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual([
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ]);
  });

  it('outputs pretty format by default', () => {
    const docs = [{ _id: '123' }];
    const result = formatJson(docs);

    expect(result).toBe('{\n  "_id": "123"\n}');
  });

  it('outputs compact format when pretty is false', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatJson(docs, { pretty: false });

    expect(result).toBe('{"_id":"123","name":"test"}');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ created: date }];
    const result = formatJson(docs);

    // Date is serialized as ISO string by JSON.stringify's default toJSON behavior
    expect(JSON.parse(result)).toEqual({
      created: '2024-01-01T00:00:00.000Z',
    });
  });

  it('handles null values', () => {
    const docs = [{ a: null, b: 'value' }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ a: null, b: 'value' });
  });

  it('handles nested objects', () => {
    const docs = [{ meta: { nested: { deep: 'value' } } }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      meta: { nested: { deep: 'value' } },
    });
  });

  it('handles arrays', () => {
    const docs = [{ tags: ['a', 'b', 'c'], counts: [1, 2, 3] }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      tags: ['a', 'b', 'c'],
      counts: [1, 2, 3],
    });
  });

  it('handles boolean values', () => {
    const docs = [{ active: true, deleted: false }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ active: true, deleted: false });
  });

  it('handles numeric values', () => {
    const docs = [{ count: 42, price: 19.99 }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({ count: 42, price: 19.99 });
  });

  it('handles empty object', () => {
    const docs = [{}];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({});
  });

  it('handles complex nested structure', () => {
    const docs = [{
      _id: '1',
      user: {
        name: 'Alice',
        profile: {
          age: 30,
          tags: ['admin', 'active'],
        },
      },
      active: true,
    }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      _id: '1',
      user: {
        name: 'Alice',
        profile: {
          age: 30,
          tags: ['admin', 'active'],
        },
      },
      active: true,
    });
  });

  it('handles BSON ObjectId', () => {
    const mockObjectId = {
      _bsontype: 'ObjectId',
      toString: () => '507f1f77bcf86cd799439011',
    };
    const docs = [{ _id: mockObjectId, name: 'test' }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      _id: { $oid: '507f1f77bcf86cd799439011' },
      name: 'test',
    });
  });

  it('handles BigInt values', () => {
    const docs = [{ bigValue: BigInt('9007199254740993') }];
    const result = formatJson(docs);

    expect(JSON.parse(result)).toEqual({
      bigValue: { $numberLong: '9007199254740993' },
    });
  });

  it('handles undefined values', () => {
    const docs = [{ a: undefined, b: 'value' }];
    const result = formatJson(docs);

    // undefined values are omitted by JSON.stringify
    expect(JSON.parse(result)).toEqual({ b: 'value' });
  });

  // 掃描第1輪
  describe('掃描第1輪 — BSON Long 處理', () => {
    it('Long 值應序列化為 $numberLong', () => {
      const longVal = Long.fromString('9007199254740993');
      const docs = [{ count: longVal }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      // Long 應該被 replacer 轉為 { $numberLong: "9007199254740993" }
      expect(parsed.count).toEqual({ $numberLong: '9007199254740993' });
    });
  });

  describe('掃描第2輪', () => {
    it('Date 物件經 JSON.stringify 後應轉為 $date 格式（如果 replacer 正確處理）', () => {
      const date = new Date('2024-06-15T12:00:00.000Z');
      const docs = [{ created: date }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      // JSON.stringify 的 toJSON 會先把 Date 轉成 string
      // 所以 replacer 收到的是 string，Date 分支不會觸發
      // 實際行為：Date 被序列化為 ISO string 而非 { $date: "..." }
      expect(parsed.created).toBe('2024-06-15T12:00:00.000Z');
      // 注意：replacer 中的 Date 分支是死碼
    });

    it('Long.fromNumber(0) 應序列化為 $numberLong', () => {
      const docs = [{ count: Long.fromNumber(0) }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.count).toEqual({ $numberLong: '0' });
    });

    it('Long.fromNumber(-1) 應序列化為 $numberLong', () => {
      const docs = [{ count: Long.fromNumber(-1) }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.count).toEqual({ $numberLong: '-1' });
    });

    it('混合 BSON 類型：ObjectId + Long + Date 在同一文件', () => {
      const realObjectId = new ObjectId('507f1f77bcf86cd799439011');
      const longVal = Long.fromString('9007199254740993');
      const date = new Date('2024-01-01T00:00:00.000Z');
      const docs = [{ _id: realObjectId, count: longVal, created: date }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      // ObjectId 也有 toJSON()，會先於 replacer 觸發，回傳 hex string
      // 所以 replacer 中的 ObjectId _bsontype 分支對真正的 ObjectId 也是死碼
      // （只有 mock ObjectId 沒有 toJSON 時才會觸發 replacer）
      expect(parsed._id).toBe('507f1f77bcf86cd799439011');
      expect(parsed.count).toEqual({ $numberLong: '9007199254740993' });
      // Date 因 toJSON 會先觸發，replacer 的 Date 分支不會執行
      expect(parsed.created).toBe('2024-01-01T00:00:00.000Z');
    });

    it('ObjectId 的 replacer _bsontype 分支只對沒有 toJSON 的 mock 生效', () => {
      // 真正的 ObjectId 有 toJSON()，replacer 不會看到 _bsontype
      const realOid = new ObjectId('507f1f77bcf86cd799439011');
      const docsReal = [{ _id: realOid }];
      const resultReal = formatJson(docsReal);
      const parsedReal = JSON.parse(resultReal);
      // 真正 ObjectId: toJSON 先觸發 → replacer 收到 string → 不會轉為 $oid
      expect(parsedReal._id).toBe('507f1f77bcf86cd799439011');

      // mock ObjectId（沒有 toJSON）: replacer 的 _bsontype 分支才會觸發
      const mockOid = { _bsontype: 'ObjectId', toString: () => '507f1f77bcf86cd799439011' };
      const docsMock = [{ _id: mockOid }];
      const resultMock = formatJson(docsMock);
      const parsedMock = JSON.parse(resultMock);
      expect(parsedMock._id).toEqual({ $oid: '507f1f77bcf86cd799439011' });
    });
  });

  describe('掃描第3輪', () => {
    it('空陣列文件：[{tags: []}]', () => {
      const docs = [{ tags: [] }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.tags).toEqual([]);
    });

    it('含特殊字元的 key：{"a.b": 1, "c d": 2}', () => {
      const docs = [{ 'a.b': 1, 'c d': 2 }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed['a.b']).toBe(1);
      expect(parsed['c d']).toBe(2);
    });

    it('巢狀空物件', () => {
      const docs = [{ meta: {} }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.meta).toEqual({});
    });

    it('陣列中有 null 元素', () => {
      const docs = [{ items: [1, null, 3] }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.items).toEqual([1, null, 3]);
    });

    it('多層巢狀 + 混合型態', () => {
      const docs = [{
        level1: {
          level2: {
            str: 'hello',
            num: 42,
            arr: [true, false],
            nil: null,
          },
        },
      }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.level1.level2.str).toBe('hello');
      expect(parsed.level1.level2.num).toBe(42);
      expect(parsed.level1.level2.arr).toEqual([true, false]);
      expect(parsed.level1.level2.nil).toBeNull();
    });

    it('compact 格式下的空陣列', () => {
      const docs = [{ data: [] }];
      const result = formatJson(docs, { pretty: false });
      expect(result).toBe('{"data":[]}');
    });

    it('single doc 展開 vs multiple docs 展開', () => {
      const singleResult = formatJson([{ a: 1 }]);
      const multiResult = formatJson([{ a: 1 }, { b: 2 }]);
      // single → 物件，multiple → 陣列
      const singleParsed = JSON.parse(singleResult);
      const multiParsed = JSON.parse(multiResult);
      expect(Array.isArray(singleParsed)).toBe(false);
      expect(Array.isArray(multiParsed)).toBe(true);
    });

    it('BSON Decimal128 mock 應轉為 $numberDecimal', () => {
      const mockDecimal = {
        _bsontype: 'Decimal128',
        toString: () => '123.456',
      };
      const docs = [{ price: mockDecimal }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.price).toEqual({ $numberDecimal: '123.456' });
    });
  });

  describe('掃描第4輪', () => {
    it('formatJson([]) 直接呼叫空陣列', () => {
      // docs.length === 0 不會走到 docs.length === 1 的分支
      // 但 formatJson 沒有空陣列特判，會走 docs.length === 1 ? docs[0] : docs
      // [] 的 length 是 0，所以 data = docs = []
      const result = formatJson([]);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual([]);
    });

    it('formatJson 含特殊 key："$" 開頭', () => {
      const docs = [{ $special: 'value', normal: 'ok' }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.$special).toBe('value');
    });

    it('超深巢狀：5 層', () => {
      const docs = [{ a: { b: { c: { d: { e: 'deep' } } } } }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.a.b.c.d.e).toBe('deep');
    });

    it('陣列中混合不同型別', () => {
      const docs = [{ mixed: [1, 'two', true, null, { nested: 'obj' }] }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.mixed).toEqual([1, 'two', true, null, { nested: 'obj' }]);
    });

    it('多文件但第一個為空物件', () => {
      const docs = [{}, { name: 'second' }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toEqual({});
      expect(parsed[1]).toEqual({ name: 'second' });
    });

    it('值是空字串', () => {
      const docs = [{ key: '' }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.key).toBe('');
    });

    it('值是 Number.MAX_SAFE_INTEGER', () => {
      const docs = [{ big: Number.MAX_SAFE_INTEGER }];
      const result = formatJson(docs);
      const parsed = JSON.parse(result);
      expect(parsed.big).toBe(9007199254740991);
    });

    it('compact 格式下的巢狀結構', () => {
      const docs = [{ a: { b: [1, 2] }, c: true }];
      const result = formatJson(docs, { pretty: false });
      expect(result).toBe('{"a":{"b":[1,2]},"c":true}');
    });
  });
});
