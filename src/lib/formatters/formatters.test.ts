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
  });

  describe('format selection', () => {
    const docs = [{ _id: '1', name: 'test' }];

    it('formats as table by default', () => {
      const result = formatOutput(docs, 'table');
      expect(result).toContain('_id');
      expect(result).toContain('name');
    });

    it('formats as json', () => {
      const result = formatOutput(docs, 'json');
      expect(JSON.parse(result)).toEqual({ _id: '1', name: 'test' });
    });

    it('formats as csv', () => {
      const result = formatOutput(docs, 'csv');
      expect(result).toContain(',');
    });

    it('formats as yaml', () => {
      const result = formatOutput(docs, 'yaml');
      expect(result).toContain('_id:');
    });

    it('defaults to table for unknown format', () => {
      const result = formatOutput(docs, 'unknown' as never);
      expect(result).toContain('│');
    });
  });

  describe('single document', () => {
    it('normalizes single document to array for processing', () => {
      const doc = { _id: '1', name: 'test' };
      const result = formatOutput(doc, 'table');
      expect(result).toContain('test');
    });
  });
});
