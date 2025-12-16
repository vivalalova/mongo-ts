import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setLogMode } from './logger.js';

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setLogMode(false, false);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('debug', () => {
    it('does not log when verbose is false', () => {
      setLogMode(false, false);
      logger.debug('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('logs when verbose is true', () => {
      setLogMode(true, false);
      logger.debug('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('does not log when quiet is true even with verbose', () => {
      setLogMode(true, true);
      logger.debug('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('logs when not quiet', () => {
      logger.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('does not log when quiet', () => {
      setLogMode(false, true);
      logger.info('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('success', () => {
    it('logs when not quiet', () => {
      logger.success('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('does not log when quiet', () => {
      setLogMode(false, true);
      logger.success('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('logs when not quiet', () => {
      logger.warn('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('does not log when quiet', () => {
      setLogMode(false, true);
      logger.warn('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('always logs errors', () => {
      logger.error('test error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('logs errors even when quiet', () => {
      setLogMode(false, true);
      logger.error('test error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('output', () => {
    it('always outputs data', () => {
      logger.output('test data');
      expect(consoleSpy).toHaveBeenCalledWith('test data');
    });

    it('outputs even when quiet', () => {
      setLogMode(false, true);
      logger.output('test data');
      expect(consoleSpy).toHaveBeenCalledWith('test data');
    });
  });

  describe('title', () => {
    it('logs title when not quiet', () => {
      logger.title('Test Title');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('does not log title when quiet', () => {
      setLogMode(false, true);
      logger.title('Test Title');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('label', () => {
    it('logs label when not quiet', () => {
      logger.label('key', 'value');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('does not log label when quiet', () => {
      setLogMode(false, true);
      logger.label('key', 'value');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('handles numeric values', () => {
      logger.label('count', 42);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
