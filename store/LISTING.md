# Chrome Web Store listing

Copy these fields into the developer dashboard. Do not keyword-stuff or claim features that are not in the side panel.

After `PRIVACY.md` is on the default branch, the privacy URL is:

`https://github.com/arverma/Dev-ToolBox-Pro/blob/main/PRIVACY.md`

## Product

| Field | Value |
| :--- | :--- |
| Title | Dev ToolBox Pro |
| Language | English |
| Category | Developer Tools |
| Visibility | Public |
| Pricing | Free |

## Short description (≤132 characters)

Format JSON and SQL, decode Base64 and JWT, convert Unix time, and diff text — locally in a Chrome side panel.

## Detailed description

Dev ToolBox Pro is a Chrome side panel for everyday developer text. Formatting, decode, encode, timestamp conversion, and diff all run in the extension. Nothing is sent to a remote server.

**Format**
Pretty-print or minify JSON. Format SQL with auto-detect or a pinned dialect (default Trino / Presto, plus other dialects from sql-formatter). Copy the result in one click.

**Decode and encode**
Decode Base64, JWT (header and payload only; the signature is not verified), URL encoding, and Unicode escapes. Encode to Base64.

**Convert**
Convert Unix epoch timestamps to local, UTC, or IANA timezones. Auto-detect seconds, milliseconds, microseconds, or nanoseconds.

**Diff**
Compare two JSON or SQL documents side by side with line highlights.

**Editor**
Find and replace, editor themes, a resizable split, and local drafts. Right-click selected page text and choose “Format with Dev ToolBox Pro” to send it into the panel.

Use the toolbar icon to open or close the side panel.

## Single purpose

A local developer utility for formatting, decoding, converting, and comparing structured text in a Chrome side panel.

## Permission justifications

| Permission | Why it is required |
| :--- | :--- |
| `sidePanel` | The product UI is a Chrome side panel, not a popup. |
| `storage` | Remember panel open state, persist editor drafts and prefs, and hand off context-menu text into the panel. Data stays in Chrome storage / localStorage on the device. |
| `contextMenus` | Adds “Format with Dev ToolBox Pro” on selected page text. |
| `activeTab` | Used with the context-menu gesture to read the current tab’s selection when the menu item is chosen. |
| `scripting` | Injects a small helper on the active tab only after that user gesture, so a longer selection can be copied into the panel when the context-menu snippet is truncated. |

No `host_permissions` and no remote endpoints.

## Notes for reviewers

No account or login. The extension does not call a backend.

1. Load the uploaded package (or `dist/` unpacked).
2. Click the toolbar icon to open the side panel.
3. Paste `{"a":1}` into Format — output should pretty-print as JSON.
4. Switch mode to Decode, paste a JWT, confirm header/payload JSON (signature is not verified).
5. On any `https://` page, select text, right-click, “Format with Dev ToolBox Pro” — the selection should appear in the panel.

## Store media (this folder)

| File | Dashboard field |
| :--- | :--- |
| `../icons/icon128.png` | Store icon 128×128 |
| `small promo.png` | Small promo tile (required) |
| `Marquee promo tile  1400x560.png` | Marquee promo tile (optional) |
| `screenshot-1.png` | Screenshot 1 |
| `screenshot-2.jpg` | Screenshot 2 |
| `screenshot-3.jpg` | Screenshot 3 |
| `screenshot-4.jpg` | Screenshot 4 |
| `screenshot-5.jpg` | Screenshot 5 |

Package upload ZIP: `npm run pack` → `store/dev-toolbox-pro-<version>.zip`.
