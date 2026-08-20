# Dev ToolBox Pro

A Chrome MV3 **side panel** for formatting, decoding, and comparing developer text — offline, in the browser.

This repository is a **Chrome extension**, not an npm library. Load the built `dist/` folder as an unpacked extension.

## Features

- **Format** — JSON and SQL with auto-detect (or manual JSON / SQL). SQL defaults to **Trino / Presto**, with 19 dialects via `sql-formatter`.
- **JSON tools** — pretty-print or minify; escape / unescape as a JSON string.
- **Decode** — Base64, JWT (header/payload, signature not verified), URL, Unicode escapes; auto-detect or pinned kind.
- **Encode** — Base64.
- **Convert** — Unix epoch ↔ human timestamp (seconds/ms/µs/ns auto-detect) with IANA timezone support.
- **Diff** — side-by-side JSON/SQL with line highlights (semantic format when pasting / entering Diff).
- **Find / replace** — CodeMirror search with match counts.
- **Editor themes**, resizable split, cursor pill; prefs and drafts persist locally.
- **Context menu** — “Format with Dev ToolBox Pro” on selected page text.
- **Offline** — no network calls for formatting or decode.

## Prerequisites

- Node.js 18+
- npm
- Chrome (or Chromium) with MV3 support

## Setup

```bash
npm install
npm run build
```

Useful scripts:

| Script | Purpose |
|--------|---------|
| `npm run build` | Bundle to `dist/` |
| `npm run watch` | Rebuild on change |
| `npm test` | Unit tests (`core` / `features`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerate PNG icons (16 / 32 / 48 / 128) |
| `npm run pack` | Build and zip `dist/` to `store/dev-toolbox-pro-<version>.zip` |

### Load in Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** and select the **`dist/`** directory (not the repo root).
3. After code changes, run `npm run build` (or `watch`) and click **Reload** on the extension card.

## Architecture

```
src/
  core/                 # Pure primitives (language detect, error positions, banners, pending-input contract)
  features/             # Pure feature logic (JSON/SQL format, decode/encode, epoch convert, diff)
  extension/
    background/         # MV3 service worker modules (panel toggle, context menu, messages)
    panel/              # Side panel UI (editors, workspaces, persistence, chrome handoff)
  background.ts         # Thin SW entry (stable path for build.mjs)
  script.ts             # Thin panel entry (stable path for sidepanel.html)
  sidepanel.html
  styles/style.css
```

**Layering rules:**

1. `core` does not import `features` or `extension`.
2. `features` may import `core` (and sparingly other features, e.g. decode → JSON pretty-print).
3. `extension/*` may import `core` + `features` and use DOM / Chrome APIs.
4. Entrypoints (`background.ts`, `script.ts`) only wire modules — nothing imports them.

Formatting and decode logic under `core/` and `features/` is unit-tested and reusable inside the repo. The UI under `extension/panel/` is the Chrome-specific shell.

## Privacy

- All processing runs in the extension (side panel / service worker).
- Editor drafts and prefs use `localStorage` (size-capped); context-menu handoff uses `chrome.storage.local`.
- Nothing is sent to a remote server by this extension.

Full policy: [PRIVACY.md](PRIVACY.md) (HTML: [docs/privacy.html](docs/privacy.html)). Chrome Web Store listing copy and permission justifications: [store/LISTING.md](store/LISTING.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
