# Dev Formatter Pro

A Chrome MV3 side panel for formatting, validating, and editing **JSON** and **SQL** (default **Trino**, plus 19 dialects via `sql-formatter`).

## Features
- **Auto-detect** JSON vs SQL (comment-aware), with a manual Auto / JSON / SQL override.
- **SQL dialects**: Trino / Presto (default), BigQuery, PostgreSQL, Snowflake, MySQL, Spark, ClickHouse, TiDB, and more.
- **JSON tools**: pretty-print or minify, plus escape / unescape as a JSON string.
- **Copy**, **editor themes** (dark, light, and a few CodeMirror themes), and a **resizable** split view. Settings persist locally.
- **Context menu**: “Format with Dev Formatter Pro” on selected text.
- **Offline**: formatting runs in the browser; nothing is sent to a server.

## Getting Started

**Prerequisites:** Node.js 18+ and npm.

```bash
npm install
npm run build
```

Watch: `npm run watch` · Tests: `npm test` · Types: `npm run typecheck`

### Load in Chrome
1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** and choose the **`dist/`** folder (not the repo root).

## Architecture
- `src/script.ts` — side panel UI and CodeMirror.
- `src/background.ts` — MV3 service worker (toolbar, side panel, context menu).
- `src/utils/` — language detection, JSON/SQL formatters, JSON escape, pending selection.

## License
MIT
