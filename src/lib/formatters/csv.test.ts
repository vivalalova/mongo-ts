import { describe, it, expect } from 'vitest';
import { Long, ObjectId } from 'mongodb';
import { formatCsv } from './csv.js';

describe('formatCsv', () => {
  it('returns empty string for empty array', () => {
    expect(formatCsv([])).toBe('');
  });

  it('formats single document', () => {
    const docs = [{ _id: '123', name: 'test' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n123,test');
  });

  it('formats multiple documents', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n1,Alice\n2,Bob');
  });

  it('escapes commas in values', () => {
    const docs = [{ _id: '1', name: 'John, Jr.' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n1,"John, Jr."');
  });

  it('escapes quotes in values', () => {
    const docs = [{ _id: '1', name: 'Say "Hello"' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n1,"Say ""Hello"""');
  });

  it('escapes newlines in values', () => {
    const docs = [{ _id: '1', content: 'line1\nline2' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,content\n1,"line1\nline2"');
  });

  it('handles null and undefined', () => {
    const docs = [{ _id: '1', a: null, b: undefined }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,a,b\n1,,');
  });

  it('handles nested objects', () => {
    const docs = [{ _id: '1', meta: { key: 'value' } }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,meta.key\n1,value');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const docs = [{ _id: '1', created: date }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,created\n1,2024-01-01T00:00:00.000Z');
  });

  it('uses specified columns', () => {
    const docs = [{ _id: '1', name: 'test', age: 25 }];
    const result = formatCsv(docs, { columns: ['name'] });

    expect(result).toBe('name\ntest');
  });

  it('handles multiple nested objects', () => {
    const docs = [
      { _id: '1', user: { name: 'Alice', email: 'a@test.com' } },
      { _id: '2', user: { name: 'Bob', email: 'b@test.com' } },
    ];
    const result = formatCsv(docs);

    expect(result).toBe('_id,user.email,user.name\n1,a@test.com,Alice\n2,b@test.com,Bob');
  });

  it('handles arrays as JSON', () => {
    const docs = [{ _id: '1', tags: ['a', 'b'] }];
    const result = formatCsv(docs);

    // CSV escapes quotes by doubling them: " becomes ""
    expect(result).toBe('_id,tags\n1,"[""a"",""b""]"');
  });

  it('handles boolean values', () => {
    const docs = [{ _id: '1', active: true, deleted: false }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,active,deleted\n1,true,false');
  });

  it('handles numeric values', () => {
    const docs = [{ _id: '1', count: 42, price: 19.99 }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,count,price\n1,42,19.99');
  });

  it('returns empty string when no columns specified', () => {
    const docs = [{ _id: '1', name: 'test' }];
    const result = formatCsv(docs, { columns: [] });

    expect(result).toBe('');
  });

  it('handles $oid format', () => {
    const docs = [{ _id: { $oid: '507f1f77bcf86cd799439011' }, name: 'test' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n507f1f77bcf86cd799439011,test');
  });

  it('handles BSON ObjectId', () => {
    const mockObjectId = {
      _bsontype: 'ObjectId',
      toString: () => '507f1f77bcf86cd799439011',
    };
    const docs = [{ _id: mockObjectId, name: 'test' }];
    const result = formatCsv(docs);

    expect(result).toBe('_id,name\n507f1f77bcf86cd799439011,test');
  });

  it('handles $date format', () => {
    const docs = [{ _id: '1', created: { $date: '2024-01-01T00:00:00.000Z' } }];
    const result = formatCsv(docs);

    // $date is treated as special type, not flattened
    expect(result).toContain('created');
  });

  it('handles nested value with null intermediate', () => {
    const docs = [{ _id: '1', user: null }];
    const result = formatCsv(docs, { columns: ['_id', 'user.name'] });

    expect(result).toBe('_id,user.name\n1,');
  });

  // 掃描第1輪
  describe('掃描第1輪 — BSON Long 處理', () => {
    it('Long 值應顯示為數字字串', () => {
      const longVal = Long.fromNumber(12345);
      const docs = [{ _id: '1', count: longVal }];
      const result = formatCsv(docs);
      // Long 不應該被序列化為 JSON 物件
      expect(result).not.toContain('_bsontype');
      expect(result).not.toContain('{');
    });

    it('Long 值不應被 isSpecialType 視為普通物件而展開', () => {
      const longVal = Long.fromNumber(99);
      const docs = [{ _id: '1', value: longVal }];
      const result = formatCsv(docs);
      // columns 應該是 _id,value 而不是 _id,value._bsontype,value.high,...
      const headerLine = result.split('\n')[0];
      expect(headerLine).not.toContain('value.');
    });
  });

  describe('掃描第2輪', () => {
    it('Long 值不應被 collectColumnsRecursive 展開為子欄位', () => {
      const longVal = Long.fromString('9007199254740993');
      const docs = [{ _id: '1', count: longVal }];
      const result = formatCsv(docs);
      const headerLine = result.split('\n')[0];
      // 不應出現 count._bsontype, count.high, count.low 等子欄位
      expect(headerLine).not.toContain('count.');
      expect(headerLine).not.toContain('_bsontype');
      // 應該只有 _id,count
      expect(headerLine).toContain('count');
    });

    it('Long 與 ObjectId 混合', () => {
      const oid = new ObjectId('507f1f77bcf86cd799439011');
      const longVal = Long.fromNumber(42);
      const docs = [{ _id: oid, score: longVal }];
      const result = formatCsv(docs);
      const headerLine = result.split('\n')[0];
      const dataLine = result.split('\n')[1];
      // header 不應展開 BSON 子欄位
      expect(headerLine).not.toContain('_bsontype');
      expect(headerLine).not.toContain('_id.');
      expect(headerLine).not.toContain('score.');
      // data 應包含正確值
      expect(dataLine).toContain('507f1f77bcf86cd799439011');
      expect(dataLine).toContain('42');
    });
  });

  describe('掃描第3輪', () => {
    it('深度巢狀：3 層以上巢狀物件應展開為 dot-separated 欄位', () => {
      const docs = [{ _id: '1', a: { b: { c: { d: 1 } } } }];
      const result = formatCsv(docs);
      const headerLine = result.split('\n')[0];
      // collectColumnsRecursive 應遞迴展開
      expect(headerLine).toContain('a.b.c.d');
      const dataLine = result.split('\n')[1];
      expect(dataLine).toContain('1');
    });

    it('值含 carriage return \\r 應正確處理', () => {
      const docs = [{ _id: '1', data: 'line1\rline2' }];
      const result = formatCsv(docs);
      // escapeCell 只處理 comma, quote, newline(\n)
      // \r 單獨出現不會被引號包裹（除非也含 \n 或 , 或 "）
      // 驗證不崩潰
      expect(result).toBeDefined();
      expect(result).toContain('line1');
    });

    it('空物件文件應產出空行', () => {
      const docs = [{}];
      const result = formatCsv(docs);
      // 空物件沒有任何 key → collectAllColumns 回傳空 → 回傳 ''
      expect(result).toBe('');
    });

    it('不同文件有不同欄位：缺失欄位應為空', () => {
      const docs = [{ a: 1 }, { b: 2 }];
      const result = formatCsv(docs);
      const headerLine = result.split('\n')[0];
      // 應包含 a 和 b 欄位
      expect(headerLine).toContain('a');
      expect(headerLine).toContain('b');
      const dataLines = result.split('\n').slice(1);
      // 第一行：a=1, b=空
      expect(dataLines[0]).toBe('1,');
      // 第二行：a=空, b=2
      expect(dataLines[1]).toBe(',2');
    });

    it('值含 CSV 控制字元組合：comma + quote + newline', () => {
      const docs = [{ _id: '1', data: 'a,"b"\nc' }];
      const result = formatCsv(docs);
      // 應被 escapeCell 正確處理
      expect(result).toContain('"');
      // 解析後不應崩潰
      expect(result.split('\n')[0]).toBe('_id,data');
    });

    it('巢狀物件中有 null 值不應崩潰', () => {
      const docs = [{ _id: '1', meta: { a: null, b: 'ok' } }];
      const result = formatCsv(docs);
      expect(result).toContain('meta.a');
      expect(result).toContain('meta.b');
    });

    it('巢狀物件中有陣列應作為 JSON 輸出', () => {
      const docs = [{ _id: '1', meta: { tags: ['a', 'b'] } }];
      const result = formatCsv(docs);
      // 陣列不應被展開，而是作為 JSON
      const headerLine = result.split('\n')[0];
      expect(headerLine).toContain('meta.tags');
      // 值應是 JSON 陣列
      expect(result).toContain('[');
    });

    it('空陣列值', () => {
      const docs = [{ _id: '1', tags: [] }];
      const result = formatCsv(docs);
      // [] 是陣列，不被 collectColumnsRecursive 展開
      expect(result).toContain('tags');
    });
  });

  describe('掃描第4輪', () => {
    it('只有一個欄位的文件', () => {
      const docs = [{ name: 'only' }];
      const result = formatCsv(docs);
      expect(result).toBe('name\nonly');
    });

    it('值全是 null', () => {
      const docs = [{ a: null, b: null, c: null }];
      const result = formatCsv(docs);
      const headerLine = result.split('\n')[0];
      const dataLine = result.split('\n')[1];
      expect(headerLine).toBe('a,b,c');
      expect(dataLine).toBe(',,');
    });

    it('陣列含物件', () => {
      const docs = [{ _id: '1', items: [{ id: 1 }, { id: 2 }] }];
      const result = formatCsv(docs);
      // 陣列不會被 collectColumnsRecursive 展開
      expect(result).toContain('items');
      // 值應是 JSON 字串
      const dataLine = result.split('\n')[1];
      expect(dataLine).toContain('[');
    });

    it('值含 double quote 需要 escape', () => {
      const docs = [{ _id: '1', msg: 'He said "hello"' }];
      const result = formatCsv(docs);
      // escapeCell 會把 " 變成 ""
      expect(result).toContain('""hello""');
    });

    it('值是 number 0', () => {
      const docs = [{ _id: '1', count: 0 }];
      const result = formatCsv(docs);
      expect(result).toBe('_id,count\n1,0');
    });

    it('值是 boolean false', () => {
      const docs = [{ _id: '1', active: false }];
      const result = formatCsv(docs);
      expect(result).toBe('_id,active\n1,false');
    });

    it('巢狀物件中值是空字串', () => {
      const docs = [{ _id: '1', meta: { name: '', tag: 'ok' } }];
      const result = formatCsv(docs);
      expect(result).toContain('meta.name');
      expect(result).toContain('meta.tag');
    });

    it('大量文件（100 筆）不應崩潰', () => {
      const docs = Array.from({ length: 100 }, (_, i) => ({ _id: String(i), val: i }));
      const result = formatCsv(docs);
      const lines = result.split('\n');
      // 1 header + 100 data
      expect(lines).toHaveLength(101);
    });
  });
});
