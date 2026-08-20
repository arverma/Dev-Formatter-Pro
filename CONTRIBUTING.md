# Contributing to Dev ToolBox Pro

## How to Contribute

- **Bugs / features:** Open an [issue](https://github.com/arverma/Dev-ToolBox-Pro/issues) with steps to reproduce (and a screenshot if useful).
- **Pull requests:** Fork, branch (`git checkout -b feature/my-feature`), commit, push, and open a PR.

## Local setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

Load **`dist/`** as an unpacked extension in Chrome to try UI changes.

## Coding Style

- TypeScript and CSS, 2-space indent, match existing style.
- Keep formatting logic in `src/utils/` and cover it with tests when you change behavior.
- Clear commit messages.

## Code of Conduct

Be respectful. Thanks for helping improve Dev ToolBox Pro.
