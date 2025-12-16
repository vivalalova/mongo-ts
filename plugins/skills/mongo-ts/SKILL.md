---
name: mongo-ts
description: MongoDB CLI 工具。直接執行 MongoDB 查詢語法，支援 CRUD、聚合、索引管理。輸出格式：table/json/csv/yaml。預設唯讀模式保護生產環境。
---

# mongo-ts

MongoDB 命令列工具，直接執行查詢語法。

## 執行方式

Plugin 安裝後首次需 build：

```bash
# PLUGIN_ROOT = 此 skill 所在 repo 的根目錄（往上三層）
cd ${PLUGIN_ROOT} && pnpm install && pnpm build
```

之後可直接執行：

```bash
node ${PLUGIN_ROOT}/dist/bin/mongots.js <options>
```

## 使用方式

| 操作 | 範例 |
|------|------|
| 查詢 | `mongots -u "mongodb://..." -q "db.users.find()"` |
| 新增 | `mongots --allow-write -q "db.users.insertOne({name: 'test'})"` |
| 更新 | `mongots --allow-write -q "db.users.updateOne({_id: '...'}, {$set: {name: 'new'}})"` |
| 刪除 | `mongots --allow-write -q "db.users.deleteOne({_id: '...'})"` |
| 聚合 | `mongots -q "db.orders.aggregate([{$group: {_id: '$status'}}])"` |
| Shell | `mongots`（無參數進入互動模式）|

## 命令選項

| 選項 | 說明 |
|------|------|
| `-q, --query <query>` | 執行查詢字串 |
| `-u, --uri <uri>` | MongoDB 連線字串 |
| `-d, --db <database>` | 指定資料庫 |
| `-f, --format <type>` | 輸出格式：table/json/csv/yaml（預設 table）|
| `--allow-write` | 允許寫入操作（預設唯讀）|
| `--quiet` | 靜默模式，只輸出資料 |
| `--verbose` | 詳細模式 |

## 連線設定

優先順序：CLI 參數 > 環境變數 > 設定檔

1. **CLI 參數**：`-u "mongodb://localhost:27017"`
2. **環境變數**：`MONGO_URI`、`MONGO_DB`
3. **設定檔**：`~/.mongots/config.json`

```json
{
  "uri": "mongodb://localhost:27017",
  "defaultDb": "mydb",
  "format": "table",
  "allowWrite": false
}
```

## 支援的查詢語法

| 類型 | 範例 |
|------|------|
| 查詢 | `db.coll.find({})`, `db.coll.findOne({})` |
| 新增 | `db.coll.insertOne({})`, `db.coll.insertMany([])` |
| 更新 | `db.coll.updateOne({}, {})`, `db.coll.updateMany({}, {})` |
| 刪除 | `db.coll.deleteOne({})`, `db.coll.deleteMany({})` |
| 聚合 | `db.coll.aggregate([])` |
| 計數 | `db.coll.countDocuments({})` |
| 索引 | `db.coll.createIndex({})`, `db.coll.getIndexes()` |
| 管理 | `show dbs`, `show collections`, `db.stats()` |

## 唯讀模式（預設）

預設為唯讀模式，使用 `--allow-write` 啟用寫入操作。

**唯讀允許**：find, findOne, countDocuments, aggregate（無 $out/$merge）, getIndexes, stats, show dbs/collections

**需要 `--allow-write`**：insert*, update*, delete*, drop*, createIndex, dropIndex
