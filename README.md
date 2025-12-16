# mongo-ts

MongoDB CLI 工具，直接執行 MongoDB 查詢語法。

## 安裝為 Claude Code Plugin

```bash
# 加入 plugin
claude mcp add-skill /path/to/mongo-ts/plugins/skills/mongo-ts
```

或手動在 `~/.claude/settings.json` 加入：

```json
{
  "skills": [
    "/path/to/mongo-ts/plugins/skills/mongo-ts"
  ]
}
```

首次使用需 build：

```bash
cd /path/to/mongo-ts && pnpm install && pnpm build
```

## 使用說明

詳見 [SKILL.md](plugins/skills/mongo-ts/SKILL.md)

## 開發

```bash
pnpm install      # 安裝依賴
pnpm build        # 編譯
pnpm typecheck    # 型別檢查
pnpm test         # 執行測試
```

## License

MIT
