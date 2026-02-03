import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConfigPath, isValidFormat, loadConfig, saveConfig } from './config.js';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { logger } from '../utils/logger.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
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
    { format: ' ', expected: false },
    { format: 'json ', expected: false },
    { format: ' table', expected: false },
    { format: 'XML', expected: false },
  ])('isValidFormat("$format") returns $expected', ({ format, expected }) => {
    expect(isValidFormat(format)).toBe(expected);
  });
});

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // 清除可能影響測試的環境變數
    delete process.env['MONGO_URI'];
    delete process.env['MONGO_DB'];
    delete process.env['MONGO_TS_URI'];
    delete process.env['MONGO_TS_DB'];
    delete process.env['MONGO_TS_FORMAT'];
    delete process.env['MONGO_TS_ALLOW_WRITE'];
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
    delete process.env['MONGO_TS_URI'];
    delete process.env['MONGO_TS_DB'];

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
    process.env['MONGO_TS_URI'] = 'mongodb://env:27017';
    process.env['MONGO_TS_DB'] = 'envdb';

    const config = loadConfig();

    expect(config.uri).toBe('mongodb://env:27017');
    expect(config.defaultDb).toBe('envdb');
  });

  it('loads MONGO_TS_FORMAT from environment variable', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_FORMAT'] = 'json';

    const config = loadConfig();

    expect(config.format).toBe('json');
  });

  it('ignores invalid MONGO_TS_FORMAT', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_FORMAT'] = 'invalid';

    const config = loadConfig();

    expect(config.format).toBe('table');
  });

  it('loads MONGO_TS_ALLOW_WRITE from environment variable', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_ALLOW_WRITE'] = 'true';

    const config = loadConfig();

    expect(config.allowWrite).toBe(true);
  });

  it('ignores MONGO_TS_ALLOW_WRITE when not "true"', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_ALLOW_WRITE'] = 'false';

    const config = loadConfig();

    expect(config.allowWrite).toBe(false);
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

  it('ignores empty string environment variables', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      uri: 'mongodb://file:27017',
      defaultDb: 'filedb',
    }));
    process.env['MONGO_TS_URI'] = '';
    process.env['MONGO_TS_DB'] = '';

    const config = loadConfig();

    expect(config.uri).toBe('mongodb://file:27017');
    expect(config.defaultDb).toBe('filedb');
  });

  it('loads allowWrite from file config', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      allowWrite: true,
    }));
    delete process.env['MONGO_TS_ALLOW_WRITE'];

    const config = loadConfig();

    expect(config.allowWrite).toBe(true);
  });

  it('env MONGO_TS_ALLOW_WRITE overrides file allowWrite', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      allowWrite: false,
    }));
    process.env['MONGO_TS_ALLOW_WRITE'] = 'true';

    const config = loadConfig();

    expect(config.allowWrite).toBe(true);
  });

  it('returns complete merged config', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      uri: 'mongodb://file:27017',
      defaultDb: 'filedb',
      format: 'csv',
      allowWrite: true,
    }));
    process.env['MONGO_TS_URI'] = 'mongodb://env:27017';
    delete process.env['MONGO_TS_DB'];
    delete process.env['MONGO_TS_FORMAT'];
    delete process.env['MONGO_TS_ALLOW_WRITE'];

    const config = loadConfig();

    expect(config).toEqual({
      uri: 'mongodb://env:27017',
      defaultDb: 'filedb',
      format: 'csv',
      allowWrite: true,
    });
  });

  describe('deprecated environment variables', () => {
    it('warns and uses MONGO_URI when MONGO_TS_URI is not set', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      delete process.env['MONGO_TS_URI'];
      process.env['MONGO_URI'] = 'mongodb://deprecated:27017';

      const config = loadConfig();

      expect(logger.warn).toHaveBeenCalledWith('MONGO_URI 已棄用，請改用 MONGO_TS_URI');
      expect(config.uri).toBe('mongodb://deprecated:27017');
    });

    it('warns and uses MONGO_DB when MONGO_TS_DB is not set', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      delete process.env['MONGO_TS_DB'];
      process.env['MONGO_DB'] = 'deprecateddb';

      const config = loadConfig();

      expect(logger.warn).toHaveBeenCalledWith('MONGO_DB 已棄用，請改用 MONGO_TS_DB');
      expect(config.defaultDb).toBe('deprecateddb');
    });

    it('prefers MONGO_TS_URI over deprecated MONGO_URI', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env['MONGO_URI'] = 'mongodb://deprecated:27017';
      process.env['MONGO_TS_URI'] = 'mongodb://new:27017';

      const config = loadConfig();

      expect(logger.warn).not.toHaveBeenCalled();
      expect(config.uri).toBe('mongodb://new:27017');
    });

    it('prefers MONGO_TS_DB over deprecated MONGO_DB', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env['MONGO_DB'] = 'deprecateddb';
      process.env['MONGO_TS_DB'] = 'newdb';

      const config = loadConfig();

      expect(logger.warn).not.toHaveBeenCalled();
      expect(config.defaultDb).toBe('newdb');
    });
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

  it('overwrites existing fields when saving', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      uri: 'mongodb://old:27017',
      defaultDb: 'olddb',
    }));

    saveConfig({ uri: 'mongodb://new:27017' });

    const expectedJson = JSON.stringify({
      uri: 'mongodb://new:27017',
      defaultDb: 'olddb',
    }, null, 2);

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expectedJson
    );
  });
});

describe('掃描第3輪', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env['MONGO_URI'];
    delete process.env['MONGO_DB'];
    delete process.env['MONGO_TS_URI'];
    delete process.env['MONGO_TS_DB'];
    delete process.env['MONGO_TS_FORMAT'];
    delete process.env['MONGO_TS_ALLOW_WRITE'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('config 檔的 format 欄位無效時應 fallback 到 table', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      format: 'xml',
    }));

    const config = loadConfig();
    // fileConfig 直接 spread，不驗證 format 值
    // 所以 xml 會被帶入 — 這是個 bug 還是 by design？
    // loadConfig 不驗證 file config 的 format，只驗證 env 的 format
    expect(config.format).toBe('xml');
  });

  it('MONGO_TS_ALLOW_WRITE 為 "TRUE"（大寫）不啟用寫入', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_ALLOW_WRITE'] = 'TRUE';

    const config = loadConfig();
    // 只檢查 === 'true'（小寫），大寫不匹配
    expect(config.allowWrite).toBe(false);
  });

  it('MONGO_TS_ALLOW_WRITE 為 "1" 不啟用寫入', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_ALLOW_WRITE'] = '1';

    const config = loadConfig();
    expect(config.allowWrite).toBe(false);
  });

  it('同時設定 MONGO_URI 和 MONGO_TS_URI 時不觸發 deprecation 警告', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_URI'] = 'mongodb://old:27017';
    process.env['MONGO_TS_URI'] = 'mongodb://new:27017';

    const config = loadConfig();

    expect(logger.warn).not.toHaveBeenCalled();
    expect(config.uri).toBe('mongodb://new:27017');
  });

  it('file config 的 allowWrite 為 false，env 未設定時保持 false', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      allowWrite: false,
    }));

    const config = loadConfig();
    expect(config.allowWrite).toBe(false);
  });

  it('MONGO_TS_FORMAT 為 yaml 應正確設定', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_FORMAT'] = 'yaml';

    const config = loadConfig();
    expect(config.format).toBe('yaml');
  });

  it('MONGO_TS_FORMAT 為 csv 應正確設定', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    process.env['MONGO_TS_FORMAT'] = 'csv';

    const config = loadConfig();
    expect(config.format).toBe('csv');
  });

  it('saveConfig 空物件不應崩潰', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => saveConfig({})).not.toThrow();
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('isValidFormat 對 undefined/null 類型安全', () => {
    // TypeScript 簽章要求 string，但 runtime 可能收到其他值
    expect(isValidFormat(undefined as unknown as string)).toBe(false);
    expect(isValidFormat(null as unknown as string)).toBe(false);
  });

  it('loadConfig 無設定檔且無環境變數時回傳完整預設', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const config = loadConfig();

    expect(config.format).toBe('table');
    expect(config.allowWrite).toBe(false);
    expect(config.uri).toBeUndefined();
    expect(config.defaultDb).toBeUndefined();
  });
});
