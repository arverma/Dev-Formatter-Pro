# Privacy Policy — Dev ToolBox Pro

Last updated: 20 August 2026

Dev ToolBox Pro is a Chrome extension that formats, decodes, encodes, converts, and diffs developer text in a side panel on your device.

## What we collect

The extension does **not** collect analytics, account data, or crash reports. It does **not** send your editor contents, page selections, or preferences to a remote server operated by us.

## Data processed on your device

- **Editor input and output** stay in the side panel while you work.
- **Drafts and preferences** (mode, theme, layout, and similar) may be saved in `localStorage` and/or `chrome.storage` on this browser profile, with a size cap so oversized pastes are not written.
- **Context-menu text** (“Format with Dev ToolBox Pro”) is stored briefly in `chrome.storage.local` so the panel can paste it, then removed after it is applied.

JWT decode shows header and payload JSON only. The signature is **not** verified and tokens are not transmitted.

## Permissions

Chrome permissions (`sidePanel`, `storage`, `contextMenus`, `activeTab`, `scripting`) exist only so the panel can open, remember local state, and receive selected text from the current tab after you choose the context-menu item. There are no host-wide network permissions.

## Third parties

The packaged extension includes client-side libraries (for example CodeMirror and sql-formatter). They run locally. This policy does not cover Google’s operation of Chrome or the Chrome Web Store.

## Children

The extension is a developer tool and is not directed at children.

## Changes

Material changes will be reflected in this file and the “Last updated” date.

## Contact

Open an issue on the project repository: [https://github.com/arverma/Dev-ToolBox-Pro](https://github.com/arverma/Dev-ToolBox-Pro)
