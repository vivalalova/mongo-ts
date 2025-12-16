import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConfigPath, isValidFormat } from './config.js';

describe('getConfigPath', () => {
  it('returns config path', () => {
    const path = getConfigPath();
    expect(path).toContain('.mongots');
    expect(path).toContain('config.json');
  });
});

describe('isValidFormat', () => {
  it.each([
    { format: 'table', expected: true },
    { format: 'json', expected: true },
    { format: 'csv', expected: true },
    { format: 'yaml', expected: true },
    { format: 'invalid', expected: false },
    { format: 'TABLE', expected: false },
    { format: '', expected: false },
  ])('isValidFormat("$format") returns $expected', ({ format, expected }) => {
    expect(isValidFormat(format)).toBe(expected);
  });
});
