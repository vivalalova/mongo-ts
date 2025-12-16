# mongo-ts

簡潔的 MongoDB 命令列工具，直接執行 MongoDB 查詢語法。

## 安裝

```bash
pnpm install
pnpm build
```

## 使用方式

### 執行查詢

```bash
# 查詢
mongots -q "db.users.find()"
mongots -q "db.users.findOne({name: 'test'})"

# 新增
mongots -q "db.users.insertOne({name: 'test', age: 25})"

# 更新
mongots -q "db.users.updateOne({name: 'test'}, {\$set: {age: 26}})"

# 刪除
mongots -q "db.users.deleteOne({name: 'test'})"

# 聚合
mongots -q "db.orders.aggregate([{\$group: {_id: '\$status', count: {\$sum: 1}}}])"
```

### 管理操作

```bash
mongots -q "show dbs"
mongots -q "show collections"
mongots -q "db.stats()"
mongots -q "db.users.getIndexes()"
mongots -q "db.users.createIndex({email: 1})"
```

### 互動式 Shell

```bash
# 進入互動模式
mongots

# Shell 內建命令
.help              # 顯示說明
.use <db>          # 切換資料庫
.format <type>     # 設定輸出格式
.allow-write       # 切換寫入模式（預設唯讀）
.exit              # 離開
```

## CLI 選項

| 選項 | 說明 |
|------|------|
| `-q, --query <query>` | 執行查詢字串 |
| `-u, --uri <uri>` | MongoDB 連線字串 |
| `-d, --db <database>` | 指定資料庫 |
| `-f, --format <type>` | 輸出格式：`table` / `json` / `csv` / `yaml` |
| `--allow-write` | 允許寫入操作（預設為唯讀模式） |
| `--quiet` | 靜默模式，只輸出資料 |
| `--verbose` | 詳細模式 |

## 設定

### 環境變數

```bash
export MONGO_URI="mongodb://localhost:27017"
export MONGO_DB="mydb"
```

### 設定檔

`~/.mongots/config.json`

```json
{
  "uri": "mongodb://localhost:27017",
  "defaultDb": "test",
  "format": "table",
  "allowWrite": false
}
```

優先順序：CLI 選項 > 環境變數 > 設定檔

## 唯讀模式（預設）

預設為唯讀模式，保護生產環境資料。使用 `--allow-write` 啟用寫入：

```bash
mongots -q "db.users.find()"                         # ✅ 允許（唯讀）
mongots -q "db.users.deleteMany({})"                 # ❌ 禁止（唯讀）
mongots --allow-write -q "db.users.deleteMany({})"   # ✅ 允許（已啟用寫入）
```

**唯讀模式允許**：find, findOne, countDocuments, aggregate, getIndexes, stats, show

**需要 `--allow-write`**：insert*, update*, delete*, drop*, createIndex

## 輸出格式範例

### Table（預設）

```
┌────────────────────────┬───────┬─────┐
│ _id                    │ name  │ age │
├────────────────────────┼───────┼─────┤
│ 507f1f77bcf86cd799439011│ Alice │ 25  │
│ 507f1f77bcf86cd799439012│ Bob   │ 30  │
└────────────────────────┴───────┴─────┘
```

### JSON

```bash
mongots -q "db.users.find()" -f json
```

```json
[
  { "_id": "507f1f77bcf86cd799439011", "name": "Alice", "age": 25 },
  { "_id": "507f1f77bcf86cd799439012", "name": "Bob", "age": 30 }
]
```

### CSV

```bash
mongots -q "db.users.find()" -f csv
```

```csv
_id,name,age
507f1f77bcf86cd799439011,Alice,25
507f1f77bcf86cd799439012,Bob,30
```

## 開發

```bash
pnpm install      # 安裝依賴
pnpm dev          # 開發模式
pnpm build        # 編譯
pnpm typecheck    # 型別檢查
```

## License

MIT
