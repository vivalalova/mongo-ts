import * as readline from 'readline';
import { mongoClient } from './lib/client.js';
import { executeQuery } from './lib/executor.js';
import { formatOutput } from './lib/formatters/index.js';
import { logger } from './utils/logger.js';
import type { GlobalOptions, OutputFormat } from './types/index.js';

/** Shell 狀態 */
interface ShellState {
  options: GlobalOptions;
  history: string[];
  multilineBuffer: string;
  inMultiline: boolean;
}

/**
 * 啟動互動式 Shell
 */
export async function startShell(options: GlobalOptions): Promise<void> {
  const state: ShellState = {
    options,
    history: [],
    multilineBuffer: '',
    inMultiline: false,
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(state),
    historySize: 1000,
  });

  logger.info('MongoDB Shell - 輸入 .help 查看指令說明');
  if (options.readonly) {
    logger.warn('Readonly mode enabled');
  }

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    // 處理多行輸入
    if (state.inMultiline) {
      if (input === '') {
        // 空行結束多行輸入
        state.inMultiline = false;
        await processInput(state.multilineBuffer, state, rl);
        state.multilineBuffer = '';
      } else {
        state.multilineBuffer += ' ' + input;
      }
      rl.setPrompt(getPrompt(state));
      rl.prompt();
      return;
    }

    // 檢查是否需要多行輸入（括號不完整）
    if (needsMultiline(input)) {
      state.inMultiline = true;
      state.multilineBuffer = input;
      rl.setPrompt('... ');
      rl.prompt();
      return;
    }

    await processInput(input, state, rl);
    rl.setPrompt(getPrompt(state));
    rl.prompt();
  });

  rl.on('close', async () => {
    await mongoClient.close();
    logger.info('Goodbye!');
    process.exit(0);
  });
}

/**
 * 處理輸入
 */
async function processInput(
  input: string,
  state: ShellState,
  rl: readline.Interface
): Promise<void> {
  if (!input) {
    return;
  }

  // 記錄歷史
  state.history.push(input);

  // 處理 Shell 內建命令
  if (input.startsWith('.')) {
    await handleShellCommand(input, state, rl);
    return;
  }

  // 執行查詢
  try {
    const result = await executeQuery(input, state.options.readonly);

    if (!result.success) {
      logger.error(result.error || 'Unknown error');
      return;
    }

    if (result.data !== undefined) {
      const output = formatOutput(result.data, state.options.format);
      logger.output(output);
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * 處理 Shell 內建命令
 */
async function handleShellCommand(
  input: string,
  state: ShellState,
  rl: readline.Interface
): Promise<void> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts[1];

  switch (cmd) {
    case '.help':
    case '.h':
      printHelp();
      break;

    case '.exit':
    case '.quit':
    case '.q':
      rl.close();
      break;

    case '.clear':
    case '.cls':
      console.clear();
      break;

    case '.use':
      if (arg) {
        mongoClient.setCurrentDb(arg);
        logger.success(`Switched to db: ${arg}`);
      } else {
        logger.error('Usage: .use <database>');
      }
      break;

    case '.format':
      if (arg && ['table', 'json', 'csv', 'yaml'].includes(arg)) {
        state.options.format = arg as OutputFormat;
        logger.success(`Format set to: ${arg}`);
      } else {
        logger.error('Usage: .format <table|json|csv|yaml>');
      }
      break;

    case '.readonly':
      state.options.readonly = !state.options.readonly;
      logger.info(`Readonly mode: ${state.options.readonly ? 'ON' : 'OFF'}`);
      break;

    case '.db':
      logger.info(`Current database: ${mongoClient.getCurrentDbName() || '(none)'}`);
      break;

    case '.history':
      state.history.slice(-20).forEach((h, i) => logger.output(`${i + 1}: ${h}`));
      break;

    default:
      logger.error(`Unknown command: ${cmd}. Type .help for available commands.`);
  }
}

/**
 * 取得命令提示符
 */
function getPrompt(state: ShellState): string {
  if (state.inMultiline) {
    return '... ';
  }

  const dbName = mongoClient.getCurrentDbName() || 'test';
  const readonlyFlag = state.options.readonly ? ' [RO]' : '';
  return `${dbName}${readonlyFlag}> `;
}

/**
 * 檢查是否需要多行輸入
 */
function needsMultiline(input: string): boolean {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (const char of input) {
    if (inString) {
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
    }
  }

  return depth > 0;
}

/**
 * 顯示幫助
 */
function printHelp(): void {
  const help = `
Shell 內建命令:
  .help, .h        顯示此說明
  .exit, .quit, .q 離開 Shell
  .clear, .cls     清除畫面
  .use <db>        切換資料庫
  .db              顯示目前資料庫
  .format <type>   設定輸出格式 (table|json|csv|yaml)
  .readonly        切換唯讀模式
  .history         顯示歷史紀錄

查詢語法:
  show dbs                        列出所有資料庫
  show collections                列出目前資料庫的集合
  db.stats()                      資料庫統計
  db.<collection>.find({})        查詢文件
  db.<collection>.findOne({})     查詢單一文件
  db.<collection>.insertOne({})   新增文件
  db.<collection>.updateOne({},{}) 更新文件
  db.<collection>.deleteOne({})   刪除文件
  db.<collection>.aggregate([])   聚合查詢
  db.<collection>.getIndexes()    列出索引
`;
  logger.output(help);
}
