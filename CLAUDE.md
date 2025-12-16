# MongoDB CLI Tool (mongo-ts)

## 專案概述

簡潔的 MongoDB 命令列工具，直接執行 MongoDB 查詢語法。

## 技術棧

- **Runtime**: Node.js 20+ / TypeScript 5.6+
- **CLI 框架**: Commander.js v14
- **MongoDB**: mongodb v7 官方驅動
- **輸出格式化**: chalk, cli-table3, yaml

## 專案結構

```text
src/
├── index.ts                    # CLI 主入口
├── shell.ts                    # 互動式 Shell
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

# 互動式 Shell
mongots
mongots shell
```

## CLI 選項

| 選項 | 說明 |
|------|------|
| `-q, --query <query>` | 執行查詢字串 |
| `-u, --uri <uri>` | MongoDB 連線字串 |
| `-d, --db <database>` | 指定資料庫 |
| `-f, --format <type>` | 輸出格式：table/json/csv/yaml |
| `--readonly` | 唯讀模式，禁止寫入操作 |
| `--quiet` | 靜默模式，只輸出資料 |
| `--verbose` | 詳細模式 |

## 環境變數

| 變數 | 說明 |
|------|------|
| `MONGO_URI` | MongoDB 連線字串 |
| `MONGO_DB` | 預設資料庫 |

## 設定檔

設定檔位置：`~/.mongots/config.json`

```json
{
  "uri": "mongodb://localhost:27017",
  "defaultDb": "test",
  "format": "table",
  "readonly": false
}
```

優先順序：CLI 選項 > 環境變數 > 設定檔 > 預設值

## Readonly 模式

啟用 `--readonly` 時，僅允許執行讀取操作：

**允許**：find, findOne, countDocuments, aggregate, getIndexes, stats, show

**禁止**：insert*, update*, delete*, drop*, createIndex

## 注意事項

- 連線字串含密碼時，避免記錄到日誌
- 生產環境建議啟用 `--readonly` 模式
