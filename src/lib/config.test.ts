import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConfigPath, isValidFormat, loadConfig, saveConfig } from './config.js';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('getConfigPath', () => {
  it('returns config path containing .mongots/config.json', () => {
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

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default config when no config file exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const config = loadConfig();

    expect(config).toEqual({
      format: 'table',
      allowWrite: false,
    });
  });

  it('loads config from file when it exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      uri: 'mongodb://localhost:27017',
      defaultDb: 'testdb',
      format: 'json',
    }));
    // Clear env vars that would override file config
    delete process.env['MONGO_URI'];
    delete process.env['MONGO_DB'];

    const config = loadConfig();

    expect(config.uri).toBe('mongodb://localhost:27017');
    expect(config.defaultDb).toBe('testdb');
    expect(config.format).toBe('json');
    expect(config.allowWrite).toBe(false);
  });

  it('merges environment variables over file config', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      uri: 'mongodb://file:27017',
      defaultDb: 'filedb',
    }));
    process.env['MONGO_URI'] = 'mongodb://env:27017';
    process.env['MONGO_DB'] = 'envdb';

    const config = loadConfig();

    expect(config.uri).toBe('mongodb://env:27017');
    expect(config.defaultDb).toBe('envdb');
  });

  it('handles invalid JSON in config file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('invalid json {');

    const config = loadConfig();

    expect(config).toEqual({
      format: 'table',
      allowWrite: false,
    });
  });

  it('uses custom config path when provided', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      uri: 'mongodb://custom:27017',
    }));

    loadConfig('/custom/path/config.json');

    expect(existsSync).toHaveBeenCalledWith('/custom/path/config.json');
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates config directory if it does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    saveConfig({ uri: 'mongodb://localhost:27017' });

    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.mongots'), { recursive: true });
  });

  it('merges new config with existing config', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      if (String(path).endsWith('config.json')) return true;
      return true;
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      uri: 'mongodb://old:27017',
      format: 'table',
    }));

    saveConfig({ defaultDb: 'newdb' });

    const expectedJson = JSON.stringify({
      uri: 'mongodb://old:27017',
      format: 'table',
      defaultDb: 'newdb',
    }, null, 2);

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expectedJson
    );
  });

  it('handles invalid JSON in existing config file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('invalid json');

    saveConfig({ uri: 'mongodb://new:27017' });

    const expectedJson = JSON.stringify({
      uri: 'mongodb://new:27017',
    }, null, 2);

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expectedJson
    );
  });

  it('creates new config when directory exists but file does not', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      if (String(path).endsWith('config.json')) return false;
      return true;
    });

    saveConfig({ uri: 'mongodb://localhost:27017' });

    expect(mkdirSync).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalled();
  });
});
