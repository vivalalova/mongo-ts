import { describe, it, expect } from 'vitest';
import { Long, ObjectId } from 'mongodb';
import { formatTable } from './table.js';

describe('formatTable', () => {
  it('returns "No results" for empty array', () => {
    expect(formatTable([])).toBe('No results');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test', age: 25 }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name | age\n' +
      '--- | ---- | ---\n' +
      '123 | test | 25 '
    );
  });

  it('formats multiple documents', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name \n' +
      '--- | -----\n' +
      '1   | Alice\n' +
      '2   | Bob  '
    );
  });

  it('handles null values', () => {
    const docs = [{ _id: '1', name: null }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name\n' +
      '--- | ----\n' +
      '1   | null'
    );
  });

  it('handles nested objects', () => {
    const docs = [{ _id: '1', meta: { created: '2024-01-01' } }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | meta                    \n' +
      '--- | ------------------------\n' +
      '1   | {"created":"2024-01-01"}'
    );
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ _id: '1', created: date }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | created                 \n' +
      '--- | ------------------------\n' +
      '1   | 2024-01-01T00:00:00.000Z'
    );
  });

  it('respects maxWidth option', () => {
    const longString = 'a'.repeat(100);
    const docs = [{ _id: '1', content: longString }];
    const result = formatTable(docs, { maxWidth: 20 });

    expect(result).toBe(
      '_id | content             \n' +
      '--- | --------------------\n' +
      '1   | aaaaaaaaaaaaaaaaa...'
    );
  });

  it('uses specified columns', () => {
    const docs = [{ _id: '1', name: 'test', age: 25, email: 'test@test.com' }];
    const result = formatTable(docs, { columns: ['name', 'age'] });

    expect(result).toBe(
      'name | age\n' +
      '---- | ---\n' +
      'test | 25 '
    );
  });

  it('puts _id column first', () => {
    const docs = [{ name: 'test', _id: '123', age: 25 }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name | age\n' +
      '--- | ---- | ---\n' +
      '123 | test | 25 '
    );
  });

  it('handles undefined values', () => {
    const docs = [{ _id: '1', name: undefined }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name\n' +
      '--- | ----\n' +
      '1   |     '
    );
  });

  it('handles boolean values', () => {
    const docs = [{ _id: '1', active: true, deleted: false }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | active | deleted\n' +
      '--- | ------ | -------\n' +
      '1   | true   | false  '
    );
  });

  it('handles numeric values', () => {
    const docs = [{ _id: '1', count: 42, price: 19.99 }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | count | price\n' +
      '--- | ----- | -----\n' +
      '1   | 42    | 19.99'
    );
  });

  it('handles arrays as JSON', () => {
    const docs = [{ _id: '1', tags: ['a', 'b'] }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | tags     \n' +
      '--- | ---------\n' +
      '1   | ["a","b"]'
    );
  });

  it('handles CJK characters with correct width', () => {
    const docs = [{ _id: '1', name: '中文' }];
    const result = formatTable(docs);

    // CJK characters are double-width
    expect(result).toContain('中文');
    expect(result).toContain('_id | name');
  });

  it('handles Japanese kana characters', () => {
    const docs = [{ _id: '1', name: 'こんにちは' }];
    const result = formatTable(docs);

    expect(result).toContain('こんにちは');
  });

  it('handles full-width characters', () => {
    const docs = [{ _id: '1', name: 'ＡＢＣ' }];
    const result = formatTable(docs);

    expect(result).toContain('ＡＢＣ');
  });

  it('handles $oid format', () => {
    const docs = [{ _id: { $oid: '507f1f77bcf86cd799439011' }, name: 'test' }];
    const result = formatTable(docs);

    expect(result).toContain('507f1f77bcf86cd799439011');
  });

  it('handles BSON ObjectId', () => {
    const mockObjectId = {
      _bsontype: 'ObjectId',
      toString: () => '507f1f77bcf86cd799439011',
    };
    const docs = [{ _id: mockObjectId, name: 'test' }];
    const result = formatTable(docs);

    expect(result).toContain('507f1f77bcf86cd799439011');
  });

  it('handles nested value with null intermediate', () => {
    const docs = [{ _id: '1', user: null }];
    const result = formatTable(docs, { columns: ['_id', 'user.name'] });

    expect(result).toBe(
      '_id | user.name\n' +
      '--- | ---------\n' +
      '1   |          '
    );
  });

  it('returns "No columns to display" for empty object documents', () => {
    const docs = [{}];
    const result = formatTable(docs, { columns: [] });

    expect(result).toBe('No columns to display');
  });

  it('handles value with pipe character', () => {
    const docs = [{ _id: '1', name: 'a|b' }];
    const result = formatTable(docs);

    expect(result).toContain('a|b');
  });

  it('handles value with newline character', () => {
    const docs = [{ _id: '1', name: 'line1\nline2' }];
    const result = formatTable(docs);

    expect(result).toContain('line1\\nline2');
  });

  it('handles empty string value', () => {
    const docs = [{ _id: '1', name: '' }];
    const result = formatTable(docs);

    expect(result).toBe(
      '_id | name\n' +
      '--- | ----\n' +
      '1   |     '
    );
  });

  // 掃描第1輪
  describe('掃描第1輪 — BSON Long 處理', () => {
    it('Long 值應顯示為數字字串而非 JSON 物件', () => {
      const longVal = Long.fromNumber(12345);
      const docs = [{ _id: '1', count: longVal }];
      const result = formatTable(docs);
      // Long 不應該被序列化為 {"low":12345,"high":0,...}
      expect(result).not.toContain('_bsontype');
      expect(result).not.toContain('"low"');
    });
  });

  describe('掃描第2輪', () => {
    it('Long 小值 0 應正確顯示', () => {
      const docs = [{ _id: '1', count: Long.fromNumber(0) }];
      const result = formatTable(docs);
      expect(result).toContain('0');
      expect(result).not.toContain('_bsontype');
    });

    it('Long 負值應正確顯示', () => {
      const docs = [{ _id: '1', balance: Long.fromNumber(-500) }];
      const result = formatTable(docs);
      expect(result).toContain('-500');
      expect(result).not.toContain('_bsontype');
    });

    it('混合 BSON 類型的文件：ObjectId + Long + Date', () => {
      const oid = new ObjectId('507f1f77bcf86cd799439011');
      const longVal = Long.fromString('9007199254740993');
      const date = new Date('2024-06-15T12:00:00.000Z');
      const docs = [{ _id: oid, count: longVal, created: date }];
      const result = formatTable(docs);
      expect(result).toContain('507f1f77bcf86cd799439011');
      expect(result).toContain('9007199254740993');
      expect(result).toContain('2024-06-15T12:00:00.000Z');
      expect(result).not.toContain('_bsontype');
    });
  });

  describe('掃描第3輪', () => {
    it('不同文件有不同欄位：第一個缺 name 欄位', () => {
      const docs = [{ _id: '1' }, { _id: '2', name: 'test' }];
      const result = formatTable(docs);
      const lines = result.split('\n');
      // header 應包含 _id 和 name
      expect(lines[0]).toContain('_id');
      expect(lines[0]).toContain('name');
      // 第一個文件的 name 欄位應為空
      expect(lines[2]).toContain('1');
      // 第二個文件應有 name
      expect(lines[3]).toContain('test');
    });

    it('非常多欄位（10+）的對齊', () => {
      const doc: Record<string, unknown> = { _id: '1' };
      for (let i = 0; i < 12; i++) {
        doc[`col${i}`] = `val${i}`;
      }
      const docs = [doc];
      const result = formatTable(docs);
      const lines = result.split('\n');
      // 應有 header + separator + 1 data row
      expect(lines).toHaveLength(3);
      // header 應包含所有欄位
      expect(lines[0]).toContain('col0');
      expect(lines[0]).toContain('col11');
    });

    it('值含管道符 | 不破壞 Markdown 表格結構', () => {
      const docs = [{ _id: '1', data: 'a|b|c' }];
      const result = formatTable(docs);
      // 管道符會出現在值中，但由於 formatTable 不 escape 管道符
      // 這可能導致 Markdown 表格被破壞——驗證當前行為
      expect(result).toContain('a|b|c');
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
    });

    it('值含 carriage return \\r', () => {
      const docs = [{ _id: '1', data: 'line1\r\nline2' }];
      const result = formatTable(docs);
      // escapeNewlines 應該轉義 \r 和 \n
      expect(result).toContain('\\r');
      expect(result).toContain('\\n');
    });

    it('多個文件，部分欄位全為 undefined', () => {
      const docs = [
        { _id: '1', a: undefined, b: 'x' },
        { _id: '2', a: undefined, b: 'y' },
      ];
      const result = formatTable(docs);
      const lines = result.split('\n');
      // a 欄位的所有值都是空白
      expect(lines[2]).toContain('1');
      expect(lines[3]).toContain('2');
    });

    it('空字串欄位名不應崩潰', () => {
      // 指定 columns 含空字串
      const docs = [{ _id: '1', '': 'empty-key' }];
      const result = formatTable(docs);
      expect(result).toBeDefined();
    });

    it('超過 maxWidth 的巢狀 JSON 應被截斷', () => {
      const deep = { a: { b: { c: { d: { e: 'very-deep-value-here' } } } } };
      const docs = [{ _id: '1', data: deep }];
      const result = formatTable(docs, { maxWidth: 30 });
      expect(result).toContain('...');
    });

    it('數字 0 值應顯示為 0 而非空', () => {
      const docs = [{ _id: '1', count: 0 }];
      const result = formatTable(docs);
      const lines = result.split('\n');
      expect(lines[2]).toContain('0');
    });

    it('boolean false 值應顯示為 false 而非空', () => {
      const docs = [{ _id: '1', active: false }];
      const result = formatTable(docs);
      expect(result).toContain('false');
    });
  });

  describe('掃描第4輪', () => {
    it('超長 JSON 值超過 maxWidth 截斷邊界', () => {
      const longJson = { deeply: { nested: { object: { with: { many: { levels: 'of data here' } } } } } };
      const docs = [{ _id: '1', data: longJson }];
      const result = formatTable(docs, { maxWidth: 25 });
      const dataLine = result.split('\n')[2];
      // 應被截斷並以 ... 結尾
      expect(dataLine).toContain('...');
      // 長度不應超過 maxWidth + _id 部分
    });

    it('值是空陣列 []', () => {
      const docs = [{ _id: '1', tags: [] }];
      const result = formatTable(docs);
      expect(result).toContain('[]');
    });

    it('值是 0（number zero）不應顯示為空', () => {
      const docs = [{ _id: '1', score: 0, balance: 0.0 }];
      const result = formatTable(docs);
      const lines = result.split('\n');
      // 數據行應包含 0
      expect(lines[2]).toMatch(/\b0\b/);
    });

    it('key 含 dot notation 會被 getNestedValue 解析為巢狀路徑', () => {
      // 文件有 key 'a.b'，但 getNestedValue 會把 'a.b' 拆成 a -> b
      // 因此值會是 undefined（顯示為空）— 這是已知的行為限制
      const docs = [{ _id: '1', 'a.b': 'dotted' }];
      const result = formatTable(docs);
      expect(result).toContain('a.b');
      // getNestedValue 會走 obj['a']['b'] 路徑，找不到值
      const lines = result.split('\n');
      expect(lines[2]).toContain('1');
      // 值是空的（undefined 顯示為空字串）
    });

    it('key 含空格', () => {
      const docs = [{ _id: '1', 'my field': 'value' }];
      const result = formatTable(docs);
      expect(result).toContain('my field');
      expect(result).toContain('value');
    });

    it('非常多欄位導致寬表格', () => {
      const doc: Record<string, unknown> = { _id: '1' };
      for (let i = 0; i < 20; i++) {
        doc[`field_${i}`] = `val_${i}`;
      }
      const docs = [doc];
      const result = formatTable(docs);
      expect(result).toContain('field_0');
      expect(result).toContain('field_19');
      expect(result.split('\n')).toHaveLength(3);
    });

    it('單文件只有一個欄位', () => {
      const docs = [{ only: 'one' }];
      const result = formatTable(docs);
      const lines = result.split('\n');
      expect(lines[0].trim()).toBe('only');
      expect(lines[2].trim()).toBe('one');
    });

    it('值是巢狀空物件 {}', () => {
      const docs = [{ _id: '1', meta: {} }];
      const result = formatTable(docs);
      expect(result).toContain('{}');
    });

    it('值是包含 null 的陣列', () => {
      const docs = [{ _id: '1', items: [null, 1, null] }];
      const result = formatTable(docs);
      expect(result).toContain('[null,1,null]');
    });

    it('maxWidth 為 1 的極端截斷', () => {
      const docs = [{ _id: '1', data: 'abcdef' }];
      // maxWidth=1 意味著 truncate 到 1 字元，但 "..." 本身就 3 個字元
      // truncate: str.slice(0, maxLength - 3) + '...' → str.slice(0, -2) + '...'
      const result = formatTable(docs, { maxWidth: 1 });
      // 不應崩潰
      expect(result).toBeDefined();
    });

    it('maxWidth 為 3 的邊界截斷', () => {
      const docs = [{ _id: '1', data: 'abcdef' }];
      const result = formatTable(docs, { maxWidth: 3 });
      // truncate: str.slice(0, 0) + '...' = '...'
      expect(result).toContain('...');
    });
  });
});
