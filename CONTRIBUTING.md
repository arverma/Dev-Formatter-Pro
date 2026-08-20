# Contributing to Dev ToolBox Pro

Thanks for helping improve Dev ToolBox Pro.

## How to contribute

- **Bugs / features:** Open an [issue](https://github.com/arverma/Dev-ToolBox-Pro/issues) with steps to reproduce (and a screenshot if useful).
- **Pull requests:** Fork, branch (`git checkout -b feature/my-feature`), commit, push, and open a PR.

## Local setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

Load **`dist/`** as an unpacked extension in Chrome to try UI changes. After edits, rebuild (or use `npm run watch`) and **Reload** the extension.

## Architecture (keep layers clean)

| Layer | Path | May import |
|-------|------|------------|
| Core | `src/core/` | nothing from `features` / `extension` |
| Features | `src/features/` | `core` (and other features sparingly) |
| Extension UI / SW | `src/extension/` | `core`, `features`, DOM, Chrome APIs |
| Entrypoints | `src/background.ts`, `src/script.ts` | extension modules only |

- Put **pure** formatting / decode / diff logic in `core/` or `features/` and cover it with tests under `tests/`.
- Put **Chrome / DOM** wiring in `src/extension/background/` or `src/extension/panel/`.
- Do **not** grow the thin entry files into god-objects again — extend the right module under `extension/`.

## Coding style

- TypeScript and CSS, 2-space indent, match existing style.
- Prefer move/extract over rewrite when refactoring; preserve storage key strings and debounce timings unless the PR is intentionally changing behavior.
- Clear commit messages.

## Smoke checklist (UI PRs)

After loading `dist/`:

- [ ] Format JSON/SQL (live update after a short pause while typing)
- [ ] Diff: paste both sides → highlights; typing does not fully rewrite panes
- [ ] Decode / Encode Base64 (and JWT if touched)
- [ ] Find in editor still works
- [ ] Extension icon opens/closes the side panel; closing with Chrome’s X still lets the icon reopen
- [ ] Context menu “Format with Dev ToolBox Pro” on an https page pastes selection into the panel

## Code of Conduct

Be respectful. Thanks for helping improve Dev ToolBox Pro.
