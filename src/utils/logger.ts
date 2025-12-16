import chalk from 'chalk';

/** 是否啟用詳細模式 */
let verboseMode = false;

/** 是否啟用靜默模式 */
let quietMode = false;

/**
 * 設定日誌模式
 * @param verbose - 詳細模式
 * @param quiet - 靜默模式
 */
export function setLogMode(verbose: boolean, quiet: boolean): void {
  verboseMode = verbose;
  quietMode = quiet;
}

/**
 * 日誌工具
 */
export const logger = {
  /**
   * 除錯訊息（需啟用 verbose）
   */
  debug(message: string): void {
    if (verboseMode && !quietMode) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  },

  /**
   * 一般訊息
   */
  info(message: string): void {
    if (!quietMode) {
      console.log(chalk.blue(message));
    }
  },

  /**
   * 成功訊息
   */
  success(message: string): void {
    if (!quietMode) {
      console.log(chalk.green(`✅ ${message}`));
    }
  },

  /**
   * 警告訊息
   */
  warn(message: string): void {
    if (!quietMode) {
      console.log(chalk.yellow(`⚠️  ${message}`));
    }
  },

  /**
   * 錯誤訊息
   */
  error(message: string): void {
    console.error(chalk.red(`❎ ${message}`));
  },

  /**
   * 純資料輸出（不受 quiet 影響）
   */
  output(data: string): void {
    console.log(data);
  },

  /**
   * 表格標題
   */
  title(text: string): void {
    if (!quietMode) {
      console.log(chalk.bold.cyan(`\n${text}`));
      console.log(chalk.cyan('─'.repeat(text.length + 2)));
    }
  },

  /**
   * 欄位標籤
   */
  label(key: string, value: string | number): void {
    if (!quietMode) {
      console.log(`${chalk.gray(key + ':')} ${value}`);
    }
  },
};
