# mongo-ts

MongoDB CLI 工具，直接執行 MongoDB 查詢語法。

## Claude Code Skill 安裝

```bash
# 從 marketplace 安裝
/plugin marketplace add vivalalova/mongo-ts
/plugin install mongo-ts@vivalalova/mongo-ts
```

首次使用需 build：

```bash
cd ${PLUGIN_ROOT} && pnpm install && pnpm build
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
