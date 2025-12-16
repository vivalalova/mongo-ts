import { describe, it, expect } from 'vitest';
import { formatOutput } from './index.js';

describe('formatOutput', () => {
  describe('scalar values', () => {
    it('returns string for string input', () => {
      expect(formatOutput('hello', 'json')).toBe('hello');
    });

    it('returns string for number input', () => {
      expect(formatOutput(42, 'json')).toBe('42');
    });
  });

  describe('empty data', () => {
    it('returns "No results" for empty array in table format', () => {
      expect(formatOutput([], 'table')).toBe('No results');
    });

    it('returns "[]" for empty array in json format', () => {
      expect(formatOutput([], 'json')).toBe('[]');
    });

    it('returns "No results" for empty array in csv format', () => {
      expect(formatOutput([], 'csv')).toBe('No results');
    });

    it('returns "No results" for empty array in yaml format', () => {
      expect(formatOutput([], 'yaml')).toBe('No results');
    });
  });

  describe('format selection', () => {
    const docs = [{ _id: '1', name: 'test' }];

    it('formats as table', () => {
      const result = formatOutput(docs, 'table');
      expect(result).toBe(
        '_id | name\n' +
        '--- | ----\n' +
        '1   | test'
      );
    });

    it('formats as json', () => {
      const result = formatOutput(docs, 'json');
      expect(JSON.parse(result)).toEqual({ _id: '1', name: 'test' });
    });

    it('formats as csv', () => {
      const result = formatOutput(docs, 'csv');
      expect(result).toBe('_id,name\n1,test');
    });

    it('formats as yaml', () => {
      const result = formatOutput(docs, 'yaml');
      expect(result).toBe('_id: "1"\nname: test\n');
    });

    it('defaults to table for unknown format', () => {
      const result = formatOutput(docs, 'unknown' as never);
      expect(result).toBe(
        '_id | name\n' +
        '--- | ----\n' +
        '1   | test'
      );
    });
  });

  describe('single document', () => {
    it('normalizes single document to array for processing', () => {
      const doc = { _id: '1', name: 'test' };
      const result = formatOutput(doc, 'table');
      expect(result).toBe(
        '_id | name\n' +
        '--- | ----\n' +
        '1   | test'
      );
    });

    it('returns single document (not array) in json format', () => {
      const doc = { _id: '1', name: 'test' };
      const result = formatOutput(doc, 'json');
      expect(JSON.parse(result)).toEqual({ _id: '1', name: 'test' });
    });
  });

  describe('multiple documents', () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];

    it('formats multiple documents as table', () => {
      const result = formatOutput(docs, 'table');
      expect(result).toBe(
        '_id | name \n' +
        '--- | -----\n' +
        '1   | Alice\n' +
        '2   | Bob  '
      );
    });

    it('formats multiple documents as json array', () => {
      const result = formatOutput(docs, 'json');
      expect(JSON.parse(result)).toEqual([
        { _id: '1', name: 'Alice' },
        { _id: '2', name: 'Bob' },
      ]);
    });

    it('formats multiple documents as csv', () => {
      const result = formatOutput(docs, 'csv');
      expect(result).toBe('_id,name\n1,Alice\n2,Bob');
    });

    it('formats multiple documents as yaml', () => {
      const result = formatOutput(docs, 'yaml');
      expect(result).toBe('- _id: "1"\n  name: Alice\n- _id: "2"\n  name: Bob\n');
    });
  });

  describe('edge cases', () => {
    it('handles null data', () => {
      expect(formatOutput(null as never, 'table')).toBe('No results');
    });

    it('handles undefined data', () => {
      expect(formatOutput(undefined as never, 'table')).toBe('No results');
    });

    it('handles 0 as number', () => {
      expect(formatOutput(0, 'json')).toBe('0');
    });

    it('handles empty string', () => {
      expect(formatOutput('', 'json')).toBe('');
    });

    it('handles negative number', () => {
      expect(formatOutput(-42, 'json')).toBe('-42');
    });

    it('handles float number', () => {
      expect(formatOutput(3.14159, 'json')).toBe('3.14159');
    });
  });
});
