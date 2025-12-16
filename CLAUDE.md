# MongoDB CLI Tool (mongo-ts)

## 專案概述

簡潔的 MongoDB 命令列工具，直接執行 MongoDB 查詢語法。

## 技術棧

- **Runtime**: Node.js 20+ / TypeScript 5.6+
- **CLI 框架**: Commander.js v14
- **MongoDB**: mongodb v7 官方驅動
- **輸出格式化**: chalk, yaml（Table 輸出為 Markdown 格式）

## 專案結構

```text
src/
├── index.ts                    # CLI 主入口
├── lib/
│   ├── client.ts               # MongoDB 客戶端單例
│   ├── config.ts               # 設定檔管理
│   ├── executor.ts             # 查詢執行器（核心）
│   └── formatters/             # 輸出格式化
│       ├── index.ts            # 格式化入口
│       ├── table.ts            # 表格格式
│       ├── json.ts             # JSON 格式
│       ├── csv.ts              # CSV 格式
│       └── yaml.ts             # YAML 格式
├── utils/
│   ├── logger.ts               # 彩色日誌
│   └── parser.ts               # 查詢語法解析
└── types/
    └── index.ts                # 型別定義
bin/
└── mongots.ts                  # 可執行入口
```

## 開發指令

```bash
pnpm install          # 安裝依賴
pnpm dev              # 開發模式
pnpm build            # 編譯
pnpm start            # 執行 CLI
pnpm typecheck        # 型別檢查
```

## 使用方式

```bash
# 執行查詢
mongots -q "db.users.find()"
mongots -q "db.users.insertOne({name: 'test'})"

# 管理操作
mongots -q "show dbs"
mongots -q "show collections"
```

## CLI 選項

| 選項 | 說明 |
|------|------|
| `-q, --query <query>` | 執行查詢字串 |
| `-u, --uri <uri>` | MongoDB 連線字串 |
| `-d, --db <database>` | 指定資料庫 |
| `-f, --format <type>` | 輸出格式：table/json/csv/yaml |
| `--allow-write` | 允許寫入操作（預設為唯讀）|
| `--quiet` | 靜默模式，只輸出資料 |
| `--verbose` | 詳細模式 |

## 環境變數

| 變數 | 說明 |
|------|------|
| `MONGO_TS_URI` | MongoDB 連線字串 |
| `MONGO_TS_DB` | 預設資料庫（覆蓋 URI 中的 database）|
| `MONGO_TS_FORMAT` | 輸出格式：table/json/csv/yaml |
| `MONGO_TS_ALLOW_WRITE` | 允許寫入（`true` 啟用）|

## 設定檔

設定檔位置：`~/.mongots/config.json`

```json
{
  "uri": "mongodb://localhost:27017",
  "defaultDb": "test",
  "format": "table",
  "allowWrite": false
}
```

優先順序：CLI 選項 > 環境變數 > 設定檔 > 預設值

## 唯讀模式（預設）

預設為唯讀模式，使用 `--allow-write` 啟用寫入操作。

**唯讀允許**：find, findOne, countDocuments, aggregate, getIndexes, stats, show

**需要 `--allow-write`**：insert*, update*, delete*, drop*, createIndex

## 注意事項

- 連線字串含密碼時，避免記錄到日誌
- 預設為唯讀模式，保護生產環境
