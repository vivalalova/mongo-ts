import { Command } from 'commander';
import { loadConfig, isValidFormat } from './lib/config.js';
import { mongoClient } from './lib/client.js';
import { executeQuery } from './lib/executor.js';
import { formatOutput } from './lib/formatters/index.js';
import { logger, setLogMode } from './utils/logger.js';
import type { GlobalOptions, OutputFormat } from './types/index.js';

const program = new Command();

program
  .name('mongots')
  .description('MongoDB CLI Tool - 直接執行 MongoDB 查詢')
  .version('1.0.0')
  .option('-q, --query <query>', '執行查詢字串')
  .option('-u, --uri <uri>', 'MongoDB 連線字串')
  .option('-d, --db <database>', '指定資料庫')
  .option('-f, --format <type>', '輸出格式: table|json|csv|yaml', 'table')
  .option('--allow-write', '允許寫入操作（預設為唯讀模式）', false)
  .option('--quiet', '靜默模式，只輸出資料', false)
  .option('--verbose', '詳細模式', false)
  .option('--config <path>', '指定設定檔路徑')
  .action(async (opts) => {
    try {
      await main(opts);
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * 主程式入口
 */
async function main(cliOpts: Record<string, unknown>): Promise<void> {
  // 載入設定
  const config = loadConfig(cliOpts['config'] as string | undefined);

  // 合併選項（CLI 優先）
  const options: GlobalOptions = {
    uri: (cliOpts['uri'] as string) || config.uri,
    db: (cliOpts['db'] as string) || config.defaultDb,
    format: validateFormat((cliOpts['format'] as string) || config.format || 'table'),
    allowWrite: (cliOpts['allowWrite'] as boolean) || config.allowWrite || false,
    quiet: cliOpts['quiet'] as boolean,
    verbose: cliOpts['verbose'] as boolean,
  };

  // 設定日誌模式
  setLogMode(options.verbose, options.quiet);

  // 檢查連線字串
  if (!options.uri) {
    logger.error('Missing MongoDB URI. Use -u option or set MONGO_URI environment variable.');
    process.exit(1);
  }

  // 連線到 MongoDB
  await mongoClient.connect(options.uri);

  // 設定資料庫
  if (options.db) {
    mongoClient.setCurrentDb(options.db);
  }

  const query = cliOpts['query'] as string | undefined;

  if (!query) {
    logger.error('Missing query. Use -q option to specify a query.');
    process.exit(1);
  }

  // 執行查詢
  await executeAndPrint(query, options);
  await mongoClient.close();
}

/**
 * 執行查詢並輸出結果
 */
async function executeAndPrint(query: string, options: GlobalOptions): Promise<void> {
  const result = await executeQuery(query, !options.allowWrite);

  if (!result.success) {
    logger.error(result.error || 'Unknown error');
    process.exit(1);
  }

  if (result.data !== undefined) {
    const output = formatOutput(result.data, options.format);
    logger.output(output);
  }
}

/**
 * 驗證輸出格式
 */
function validateFormat(format: string): OutputFormat {
  if (isValidFormat(format)) {
    return format;
  }
  logger.warn(`Invalid format "${format}", using "table"`);
  return 'table';
}

// 處理未捕獲的錯誤
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// 優雅關閉
process.on('SIGINT', async () => {
  await mongoClient.close();
  process.exit(0);
});

export { program };
