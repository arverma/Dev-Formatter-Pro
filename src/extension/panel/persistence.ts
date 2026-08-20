export const THEME_KEY = 'devFormatterEditorTheme';
export const DIALECT_KEY = 'devFormatterSqlDialect';
export const MODE_KEY = 'devFormatterManualMode';
const INPUT_STATE_KEY = 'devFormatterInputState';
export const MINIFY_KEY = 'devFormatterJsonMinify';
export const WORKSPACE_KEY = 'devFormatterWorkspace';
const DIFF_B_KEY = 'devFormatterDiffB';
export const SHELL_KEY = 'devFormatterShell';
export const DECODE_KIND_KEY = 'devFormatterDecodeKind';

/** Skip draft writes over this size so we keep last-good snapshot and stay under quota. */
const DRAFT_VALUE_MAX_CHARS = 1_500_000;
/** Do not run formatters / diff / decode above this size (UI-thread budget). */
export const INPUT_WORK_MAX_CHARS = 1_500_000;
/** Find match counting / overlay skipped above this doc size. */
export const FIND_DOC_MAX_CHARS = 250_000;
export const FIND_QUERY_MAX_CHARS = 200;

export interface SavedInputState {
  value: string;
  cursor: { line: number; ch: number };
  selection?: { anchor: { line: number; ch: number }; head: { line: number; ch: number } };
}

export function isOverWorkBudget(text: string): boolean {
  return text.length > INPUT_WORK_MAX_CHARS;
}

export function notifyPanelClosed() {
  try {
    void chrome.runtime.sendMessage({ type: 'panelClosed' }).catch(() => {
      // SW unavailable — ignore
    });
  } catch {
    // Extension context invalidated — ignore
  }
}

export function loadInputState(): SavedInputState | null {
  try {
    const raw = localStorage.getItem(INPUT_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedInputState;
    if (typeof parsed?.value !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveInputState(state: SavedInputState) {
  if (state.value.length > DRAFT_VALUE_MAX_CHARS) return;
  try {
    localStorage.setItem(INPUT_STATE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage blocked — ignore
  }
}

export function loadDiffBState(): SavedInputState | null {
  try {
    const raw = localStorage.getItem(DIFF_B_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedInputState;
    if (typeof parsed?.value !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDiffBState(state: SavedInputState) {
  if (state.value.length > DRAFT_VALUE_MAX_CHARS) return;
  try {
    localStorage.setItem(DIFF_B_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function captureEditorState(editor: {
  getCursor: () => { line: number; ch: number };
  listSelections: () => Array<{
    anchor: { line: number; ch: number };
    head: { line: number; ch: number };
  }> | null | undefined;
  getValue: () => string;
}): SavedInputState {
  const cursor = editor.getCursor();
  const primary = editor.listSelections()?.[0];
  const hasSelection =
    !!primary &&
    (primary.anchor.line !== primary.head.line ||
      primary.anchor.ch !== primary.head.ch);

  return {
    value: editor.getValue(),
    cursor: { line: cursor.line, ch: cursor.ch },
    selection: hasSelection
      ? {
          anchor: { line: primary.anchor.line, ch: primary.anchor.ch },
          head: { line: primary.head.line, ch: primary.head.ch },
        }
      : undefined,
  };
}
