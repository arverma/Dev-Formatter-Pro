// src/script.ts
// Dev ToolBox Pro — Apple Minimalist Controller (Integrated Themes, Zero Duplicate Headers)
// Seamless theme synchronization, auto-detection, dialect selection, and SVG interactions.

import { detectLanguage, DetectedLanguage } from './core/detectLanguage';
import { buildErrorBanner } from './core/errorBanner';
import { PENDING_INPUT_KEY, PendingInput } from './core/pendingInput';
import type { ErrorPosition } from './core/errorPosition';
import { getFormatter, mismatchHint } from './features/registry';
import { diffFormatted } from './features/diff/diffFormatted';
import { encodeBase64 } from './features/decode/base64';
import { detectDecode } from './features/decode/detectDecode';
import { getDecoder } from './features/decode/registry';
import type { DecodeKind } from './features/decode/types';
import { escapeJsonString, unescapeJsonString } from './features/json/jsonEscape';
import { SQL_DIALECTS, DEFAULT_SQL_DIALECT } from './features/sql/dialects';

declare const CodeMirror: any;

// ─── SVG Icon Templates ──────────────────────────────────────────────────────
const ICONS = {
  copy: `<svg class="icon icon-copy" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px">
    <rect x="5.5" y="5.5" width="8" height="8" rx="2"/>
    <path d="M3.5 10.5H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5h6A1.5 1.5 0 0 1 10.5 3v.5" stroke-linecap="round"/>
  </svg>`,
  check: `<svg class="icon icon-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
    <path d="M3.5 8.5l3 3 6-6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

// ─── Editor Themes ────────────────────────────────────────────────────────────
const DEFAULT_EDITOR_THEME = 'dev-formatter-dark';

interface EditorThemeOption {
  label: string;
  value: string;
  cssFile?: string;
  isDark: boolean;
}

const EDITOR_THEMES: EditorThemeOption[] = [
  { label: 'Dev ToolBox Dark', value: 'dev-formatter-dark', isDark: true },
  { label: 'Dev ToolBox Light', value: 'dev-formatter-light', isDark: false },
  { label: 'Dracula', value: 'dracula', cssFile: 'dracula.css', isDark: true },
  { label: 'Material Darker', value: 'material-darker', cssFile: 'material-darker.css', isDark: true },
  { label: 'Monokai', value: 'monokai', cssFile: 'monokai.css', isDark: true },
  { label: 'Midnight', value: 'midnight', cssFile: 'midnight.css', isDark: true },
  { label: 'Idea', value: 'idea', cssFile: 'idea.css', isDark: false },
];

document.addEventListener('DOMContentLoaded', () => {
  // ─── Storage Keys ────────────────────────────────────────────────────────
  const THEME_KEY = 'devFormatterEditorTheme';
  const DIALECT_KEY = 'devFormatterSqlDialect';
  const MODE_KEY = 'devFormatterManualMode';
  const INPUT_STATE_KEY = 'devFormatterInputState';
  const MINIFY_KEY = 'devFormatterJsonMinify';
  const WORKSPACE_KEY = 'devFormatterWorkspace';
  const DIFF_B_KEY = 'devFormatterDiffB';
  const SHELL_KEY = 'devFormatterShell';
  const DECODE_KIND_KEY = 'devFormatterDecodeKind';

  const FORMAT_INPUT_WM = 'Paste or type JSON or SQL…';
  const DECODE_INPUT_WM = 'Paste Base64, URL, Unicode, or JWT…';
  const ENCODE_INPUT_WM = 'Paste text to encode as Base64…';
  const DIFF_A_WM = 'Paste original JSON or SQL…';
  const DIFF_B_WM = 'Paste modified JSON or SQL…';

  interface SavedInputState {
    value: string;
    cursor: { line: number; ch: number };
    selection?: { anchor: { line: number; ch: number }; head: { line: number; ch: number } };
  }

  function loadInputState(): SavedInputState | null {
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

  function saveInputState(state: SavedInputState) {
    try {
      localStorage.setItem(INPUT_STATE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage blocked — ignore
    }
  }

  function loadDiffBState(): SavedInputState | null {
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

  function saveDiffBState(state: SavedInputState) {
    try {
      localStorage.setItem(DIFF_B_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  // ─── DOM References ──────────────────────────────────────────────────────
  const inputEditorEl = document.getElementById('jsonInputEditor') as HTMLElement;
  const outputEditorEl = document.getElementById('jsonOutputEditor') as HTMLElement;
  const splitter = document.getElementById('splitter') as HTMLElement;
  const inputArea = document.getElementById('inputArea') as HTMLElement;
  const outputArea = document.getElementById('outputArea') as HTMLElement;
  const appContainer = document.querySelector('.app-container') as HTMLElement;
  const cursorPosEl = document.getElementById('cursorPos') as HTMLElement;
  const inputWatermark = document.getElementById('inputWatermark') as HTMLElement;
  const outputWatermark = document.getElementById('outputWatermark') as HTMLElement;
  const jsonBadge = document.getElementById('jsonBadge') as HTMLElement;
  const decodeBadge = document.getElementById('decodeBadge') as HTMLElement;
  const dialectWrapper = document.getElementById('dialectWrapper') as HTMLElement;
  const dialectSelect = document.getElementById('dialectSelect') as HTMLSelectElement;
  const detectedHint = document.getElementById('detectedHint') as HTMLElement;
  const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;
  const copyIconSlot = document.getElementById('copyIconSlot') as HTMLElement;
  const copyLabel = document.getElementById('copyLabel') as HTMLElement;
  const jsonTools = document.getElementById('jsonTools') as HTMLElement;
  const minifyBtn = document.getElementById('minifyBtn') as HTMLButtonElement;
  const escapeBtn = document.getElementById('escapeBtn') as HTMLButtonElement;
  const unescapeBtn = document.getElementById('unescapeBtn') as HTMLButtonElement;
  const errorPill = document.getElementById('errorPill') as HTMLButtonElement;
  const modeButtons = document.querySelectorAll<HTMLButtonElement>('.segment-btn[data-mode]');
  const shellPicker = document.getElementById('shellPicker') as HTMLElement;
  const shellPickerBtn = document.getElementById('shellPickerBtn') as HTMLButtonElement;
  const shellPickerMenu = document.getElementById('shellPickerMenu') as HTMLElement;
  const shellPickerLabel = document.getElementById('shellPickerLabel') as HTMLElement;
  const formatterControls = document.getElementById('formatterControls') as HTMLElement;
  const decodeControls = document.getElementById('decodeControls') as HTMLElement;
  const encodeControls = document.getElementById('encodeControls') as HTMLElement;
  const decodeKindButtons = document.querySelectorAll<HTMLButtonElement>('.segment-btn[data-decode]');
  const themePicker = document.getElementById('themePicker') as HTMLElement;
  const themePickerBtn = document.getElementById('themePickerBtn') as HTMLButtonElement;
  const themePickerMenu = document.getElementById('themePickerMenu') as HTMLElement;
  const cmDynamicThemeLink = document.getElementById('cmDynamicTheme') as HTMLLinkElement;
  document.body.appendChild(shellPickerMenu);
  document.body.appendChild(themePickerMenu);

  // ─── State ───────────────────────────────────────────────────────────────
  const SHELL_LABELS: Record<'formatter' | 'decode' | 'encode' | 'diff', string> = {
    formatter: 'Format',
    decode: 'Decode',
    encode: 'Encode',
    diff: 'Diff',
  };

  const savedInputState = loadInputState();
  const savedDiffBState = loadDiffBState();
  const savedShell = localStorage.getItem(SHELL_KEY);
  let shell: 'formatter' | 'decode' | 'encode' | 'diff' =
    savedShell === 'decode' ||
    savedShell === 'diff' ||
    savedShell === 'encode' ||
    savedShell === 'formatter'
      ? savedShell
      : localStorage.getItem('devFormatterBase64Direction') === 'encode'
        ? 'encode'
        : localStorage.getItem(WORKSPACE_KEY) === 'diff'
          ? 'diff'
          : 'formatter';
  let workspace: 'format' | 'diff' = shell === 'diff' ? 'diff' : 'format';
  let decodeKind: 'auto' | DecodeKind =
    (localStorage.getItem(DECODE_KIND_KEY) as 'auto' | DecodeKind) || 'auto';
  if (
    decodeKind !== 'auto' &&
    decodeKind !== 'base64' &&
    decodeKind !== 'url' &&
    decodeKind !== 'unicode' &&
    decodeKind !== 'jwt'
  ) {
    decodeKind = 'auto';
  }
  let currentMode: 'auto' | 'json' | 'sql' =
    (localStorage.getItem(MODE_KEY) as 'auto' | 'json' | 'sql') || 'auto';
  let currentDialect: string =
    localStorage.getItem(DIALECT_KEY) || DEFAULT_SQL_DIALECT;
  let currentEditorTheme: string =
    localStorage.getItem(THEME_KEY) || DEFAULT_EDITOR_THEME;
  if (!EDITOR_THEMES.some((t) => t.value === currentEditorTheme)) {
    currentEditorTheme = DEFAULT_EDITOR_THEME;
  }
  let jsonMinify = localStorage.getItem(MINIFY_KEY) === '1';

  // ─── Populate Dialect Dropdown ───────────────────────────────────────────
  SQL_DIALECTS.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.value;
    opt.textContent = d.label;
    if (d.value === currentDialect) {
      opt.selected = true;
    }
    dialectSelect.appendChild(opt);
  });

  // ─── Populate Theme Menu ─────────────────────────────────────────────────
  EDITOR_THEMES.forEach((t) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'theme-picker-option';
    opt.role = 'option';
    opt.dataset.value = t.value;
    opt.textContent = t.label;
    themePickerMenu.appendChild(opt);
  });

  // ─── CodeMirror Initialization ───────────────────────────────────────────
  function makeSpecialCharPlaceholder(char: string) {
    const span = document.createElement('span');
    if (char === '\u00a0') {
      span.textContent = ' ';
    } else if (char === '\t') {
      span.innerHTML = '&nbsp;&nbsp;&nbsp;&nbsp;';
    } else {
      span.textContent = ' ';
    }
    return span;
  }

  const specialCharsRegex = /[\u00a0\t\u2000-\u200F\u2028-\u202F\u205F-\u206F]+/g;

  const baseOptions = {
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2,
    indentUnit: 2,
    viewportMargin: Infinity,
    specialChars: specialCharsRegex,
    specialCharPlaceholder: makeSpecialCharPlaceholder,
    foldGutter: {
      rangeFinder: CodeMirror.fold.combine(
        CodeMirror.fold.brace,
        CodeMirror.fold.indent
      ),
    },
    foldOptions: {
      widget: '…',
      minFoldSize: 1,
    },
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  };

  const inputEditor = CodeMirror(inputEditorEl, {
    ...baseOptions,
    mode: { name: 'javascript', json: true },
    autofocus: true,
    theme: currentEditorTheme,
    value: savedInputState?.value ?? '',
  });

  const outputEditor = CodeMirror(outputEditorEl, {
    ...baseOptions,
    mode: { name: 'javascript', json: true },
    readOnly: shell !== 'diff',
    theme: currentEditorTheme,
    value:
      shell === 'decode' || shell === 'encode'
        ? ''
        : workspace === 'diff'
          ? (savedDiffBState?.value ?? '')
          : '',
  });

  inputEditor.refresh();
  outputEditor.refresh();

  // Restore cursor / selection after the editor is laid out
  if (savedInputState) {
    requestAnimationFrame(() => {
      try {
        if (savedInputState.selection) {
          inputEditor.setSelection(
            savedInputState.selection.anchor,
            savedInputState.selection.head
          );
        } else if (savedInputState.cursor) {
          inputEditor.setCursor(savedInputState.cursor);
        }
      } catch {
        // Stale positions from a shorter previous document — ignore
      }
      inputEditor.focus();
    });
  } else {
    inputEditor.focus();
  }

  if (shell === 'diff' && savedDiffBState) {
    requestAnimationFrame(() => {
      try {
        if (savedDiffBState.selection) {
          outputEditor.setSelection(
            savedDiffBState.selection.anchor,
            savedDiffBState.selection.head
          );
        } else if (savedDiffBState.cursor) {
          outputEditor.setCursor(savedDiffBState.cursor);
        }
      } catch {
        // ignore
      }
    });
  }

  // ─── Persist Input + Selection ───────────────────────────────────────────
  let persistTimer: number | null = null;

  function captureEditorState(editor: typeof inputEditor): SavedInputState {
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

  function captureInputState(): SavedInputState {
    return captureEditorState(inputEditor);
  }

  function persistInputStateSoon() {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      saveInputState(captureInputState());
    }, 250);
  }

  function persistInputStateNow() {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    saveInputState(captureInputState());
  }

  let persistDiffBTimer: number | null = null;

  function persistDiffBSoon() {
    if (persistDiffBTimer !== null) clearTimeout(persistDiffBTimer);
    persistDiffBTimer = window.setTimeout(() => {
      persistDiffBTimer = null;
      saveDiffBState(captureEditorState(outputEditor));
    }, 250);
  }

  function persistDiffBNow() {
    if (persistDiffBTimer !== null) {
      clearTimeout(persistDiffBTimer);
      persistDiffBTimer = null;
    }
    saveDiffBState(captureEditorState(outputEditor));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistInputStateNow();
      if (workspace === 'diff') persistDiffBNow();
    }
  });
  window.addEventListener('pagehide', () => {
    persistInputStateNow();
    if (workspace === 'diff') persistDiffBNow();
  });

  // ─── Theme Management (Synced with App Background) ───────────────────────
  function applyTheme(themeValue: string) {
    const matched =
      EDITOR_THEMES.find((t) => t.value === themeValue) || EDITOR_THEMES[0];
    
    // Automatically match the app window background and borders to the theme type
    if (matched.isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    if (matched.cssFile) {
      cmDynamicThemeLink.href = `codemirror/theme/${matched.cssFile}`;
    } else {
      cmDynamicThemeLink.href = '';
    }

    inputEditor.setOption('theme', matched.value);
    outputEditor.setOption('theme', matched.value);

    localStorage.setItem(THEME_KEY, matched.value);
    themePickerBtn.title = matched.label;
    themePickerMenu.querySelectorAll<HTMLButtonElement>('.theme-picker-option').forEach((btn) => {
      btn.setAttribute('aria-selected', btn.dataset.value === matched.value ? 'true' : 'false');
    });
  }

  function positionAnchoredMenu(
    menu: HTMLElement,
    anchor: HTMLElement,
    align: 'left' | 'right'
  ) {
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 6)}px`;
    if (align === 'left') {
      menu.style.left = `${Math.round(r.left)}px`;
      menu.style.right = 'auto';
    } else {
      menu.style.right = `${Math.round(window.innerWidth - r.right)}px`;
      menu.style.left = 'auto';
    }
  }

  function setThemeMenuOpen(open: boolean) {
    themePickerMenu.hidden = !open;
    themePickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) positionAnchoredMenu(themePickerMenu, themePickerBtn, 'right');
  }

  function setShellMenuOpen(open: boolean) {
    shellPickerMenu.hidden = !open;
    shellPickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) positionAnchoredMenu(shellPickerMenu, shellPickerBtn, 'left');
  }

  // Initial Theme Application
  applyTheme(currentEditorTheme);

  themePickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setThemeMenuOpen(themePickerMenu.hidden);
  });

  themePickerMenu.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.theme-picker-option');
    if (!btn?.dataset.value) return;
    currentEditorTheme = btn.dataset.value;
    applyTheme(currentEditorTheme);
    setThemeMenuOpen(false);
  });

  document.addEventListener('click', (e) => {
    const t = e.target as Node;
    if (!themePickerMenu.hidden && !themePicker.contains(t) && !themePickerMenu.contains(t)) {
      setThemeMenuOpen(false);
    }
    if (!shellPickerMenu.hidden && !shellPicker.contains(t) && !shellPickerMenu.contains(t)) {
      setShellMenuOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!themePickerMenu.hidden) {
      setThemeMenuOpen(false);
      themePickerBtn.focus();
    }
    if (!shellPickerMenu.hidden) {
      setShellMenuOpen(false);
      shellPickerBtn.focus();
    }
  });

  // ─── Editor Mode Switching ───────────────────────────────────────────────
  function setEditorSyntaxMode(lang: 'json' | 'sql' | 'text') {
    if (lang === 'sql') {
      inputEditor.setOption('mode', 'text/x-sql');
      outputEditor.setOption('mode', 'text/x-sql');
    } else if (lang === 'json') {
      inputEditor.setOption('mode', { name: 'javascript', json: true });
      outputEditor.setOption('mode', { name: 'javascript', json: true });
    } else {
      inputEditor.setOption('mode', 'text/plain');
      outputEditor.setOption('mode', 'text/plain');
    }
  }

  // ─── Parse-error marks ───────────────────────────────────────────────────
  let errorMark: { clear: () => void } | null = null;
  let errorLine: number | null = null;
  let errorEditor: typeof inputEditor | null = null;
  let lastErrorPos: ErrorPosition | null = null;

  function clearErrorMarks() {
    if (errorMark) {
      errorMark.clear();
      errorMark = null;
    }
    if (errorLine !== null && errorEditor) {
      errorEditor.removeLineClass(errorLine, 'background', 'cm-error-line');
    }
    errorLine = null;
    errorEditor = null;
    lastErrorPos = null;
    errorPill.hidden = true;
    errorPill.textContent = '';
  }

  function showErrorMark(editor: typeof inputEditor, pos: ErrorPosition) {
    clearErrorMarks();
    lastErrorPos = pos;
    errorEditor = editor;
    const lineText = editor.getLine(pos.line) ?? '';
    const from = { line: pos.line, ch: Math.min(pos.ch, lineText.length) };
    const toCh = Math.min(from.ch + 1, Math.max(lineText.length, from.ch + 1));
    errorMark = editor.markText(from, { line: pos.line, ch: toCh }, {
      className: 'cm-error-mark',
    });
    editor.addLineClass(pos.line, 'background', 'cm-error-line');
    errorLine = pos.line;
    errorPill.hidden = false;
    errorPill.textContent = `${pos.line + 1}:${pos.ch + 1}`;
    errorPill.title = `Jump to parse error at ${pos.line + 1}:${pos.ch + 1}`;
  }

  function setJsonToolsVisible(visible: boolean) {
    jsonTools.hidden = !visible;
  }

  errorPill.addEventListener('click', () => {
    if (!lastErrorPos || !errorEditor) return;
    errorEditor.focus();
    errorEditor.setCursor(lastErrorPos);
    errorEditor.scrollIntoView(lastErrorPos, 40);
  });

  minifyBtn.classList.toggle('active', jsonMinify);

  let ignoreEditorChange = false;
  let focusedPane: 'input' | 'output' = 'input';
  let diffLineMarks: { editor: typeof inputEditor; line: number; cls: string }[] = [];

  function updateWatermarkCopy() {
    if (shell === 'decode') {
      inputWatermark.textContent = DECODE_INPUT_WM;
      outputWatermark.classList.add('hidden');
    } else if (shell === 'encode') {
      inputWatermark.textContent = ENCODE_INPUT_WM;
      outputWatermark.classList.add('hidden');
    } else if (workspace === 'diff') {
      inputWatermark.textContent = DIFF_A_WM;
      outputWatermark.textContent = DIFF_B_WM;
    } else {
      inputWatermark.textContent = FORMAT_INPUT_WM;
      outputWatermark.classList.add('hidden');
    }
  }

  function clearDiffMarks() {
    for (const mark of diffLineMarks) {
      mark.editor.removeLineClass(mark.line, 'background', mark.cls);
    }
    diffLineMarks = [];
  }

  function applyDiffMarks(
    hunks: ReturnType<typeof diffFormatted>
  ) {
    clearDiffMarks();
    let aLine = 0;
    let bLine = 0;
    for (const hunk of hunks) {
      if (hunk.type === 'equal') {
        aLine += hunk.lines.length;
        bLine += hunk.lines.length;
        continue;
      }
      if (hunk.type === 'remove') {
        for (let i = 0; i < hunk.lines.length; i++) {
          const line = aLine + i;
          inputEditor.addLineClass(line, 'background', 'cm-diff-remove');
          diffLineMarks.push({ editor: inputEditor, line, cls: 'cm-diff-remove' });
        }
        aLine += hunk.lines.length;
        continue;
      }
      for (let i = 0; i < hunk.lines.length; i++) {
        const line = bLine + i;
        outputEditor.addLineClass(line, 'background', 'cm-diff-add');
        diffLineMarks.push({ editor: outputEditor, line, cls: 'cm-diff-add' });
      }
      bLine += hunk.lines.length;
    }
  }

  function setValuePreserveCursor(editor: typeof inputEditor, value: string) {
    if (editor.getValue() === value) return;
    const cursor = editor.getCursor();
    const scroll = editor.getScrollInfo();
    ignoreEditorChange = true;
    editor.setValue(value);
    ignoreEditorChange = false;
    try {
      editor.setCursor(cursor);
    } catch {
      // shorter document
    }
    editor.scrollTo(scroll.left, scroll.top);
  }

  function applyLanguageChrome(targetFormat: Exclude<DetectedLanguage, 'unknown'>, jsonTools: boolean) {
    const entry = getFormatter(targetFormat);
    setEditorSyntaxMode(entry.cmLang);
    decodeBadge.hidden = true;
    jsonBadge.style.display = entry.id === 'json' ? 'inline-flex' : 'none';
    dialectWrapper.style.display = entry.id === 'sql' ? 'inline-flex' : 'none';
    setJsonToolsVisible(jsonTools && entry.id === 'json');
    return entry;
  }

  function hideLanguageChrome() {
    jsonBadge.style.display = 'none';
    decodeBadge.hidden = true;
    dialectWrapper.style.display = 'none';
    setJsonToolsVisible(false);
  }

  function languageForPane(raw: string, trim: string): DetectedLanguage {
    if (currentMode !== 'auto') return currentMode;
    if (!trim) return 'unknown';
    return detectLanguage(raw);
  }

  function resolveDiffLanguage(rawA: string, rawB: string, trimA: string, trimB: string): DetectedLanguage {
    if (currentMode !== 'auto') return currentMode;
    const a = languageForPane(rawA, trimA);
    if (a !== 'unknown') return a;
    return languageForPane(rawB, trimB);
  }

  function prettyPrintIfValid(editor: typeof inputEditor, raw: string, target: Exclude<DetectedLanguage, 'unknown'>) {
    const entry = getFormatter(target);
    const result = entry.format(raw, { dialect: currentDialect, jsonMinify: false });
    if (!result.isError) {
      setValuePreserveCursor(editor, result.formatted);
    } else {
      editor.getWrapperElement().classList.add('error-output');
      if (result.errorPosition) {
        showErrorMark(editor, result.errorPosition);
      }
    }
  }

  function runDiff() {
    const rawA = inputEditor.getValue();
    const rawB = outputEditor.getValue();
    const trimA = rawA.trim();
    const trimB = rawB.trim();

    inputWatermark.classList.toggle('hidden', trimA.length > 0);
    outputWatermark.classList.toggle('hidden', trimB.length > 0);
    inputEditor.getWrapperElement().classList.remove('error-output');
    outputEditor.getWrapperElement().classList.remove('error-output');
    clearErrorMarks();
    clearDiffMarks();
    setJsonToolsVisible(false);

    if (!trimA && !trimB) {
      hideLanguageChrome();
      detectedHint.textContent = '';
      setEditorSyntaxMode('text');
      return;
    }

    const langA = languageForPane(rawA, trimA);
    const langB = languageForPane(rawB, trimB);
    const targetFormat = resolveDiffLanguage(rawA, rawB, trimA, trimB);
    if (targetFormat === 'unknown') {
      setEditorSyntaxMode('text');
      hideLanguageChrome();
      detectedHint.textContent = 'Paste JSON or SQL';
      return;
    }

    const entry = applyLanguageChrome(targetFormat, false);
    detectedHint.textContent =
      currentMode === 'auto' ? `Diff ${entry.label}` : 'Diff';

    if (trimA && (currentMode !== 'auto' || langA !== 'unknown')) {
      prettyPrintIfValid(inputEditor, rawA, langA !== 'unknown' ? langA : targetFormat);
    }
    if (trimB && (currentMode !== 'auto' || langB !== 'unknown')) {
      prettyPrintIfValid(outputEditor, rawB, langB !== 'unknown' ? langB : targetFormat);
    }

    if (!trimA || !trimB) return;

    const opts = { dialect: currentDialect, jsonMinify: false };
    const resultA = entry.format(inputEditor.getValue(), opts);
    const resultB = entry.format(outputEditor.getValue(), opts);

    if (resultA.isError) {
      inputEditor.getWrapperElement().classList.add('error-output');
      if (resultA.errorPosition) showErrorMark(inputEditor, resultA.errorPosition);
    }
    if (resultB.isError) {
      outputEditor.getWrapperElement().classList.add('error-output');
      if (!resultA.isError && resultB.errorPosition) {
        showErrorMark(outputEditor, resultB.errorPosition);
      }
    }
    if (resultA.isError || resultB.isError) return;

    applyDiffMarks(diffFormatted(resultA.formatted, resultB.formatted));
  }

  function runWorkspace() {
    if (shell === 'decode' || shell === 'encode') {
      scheduleDecode();
    } else if (workspace === 'diff') {
      runDiff();
    } else {
      runFormatting();
    }
  }

  function applyShellChrome() {
    formatterControls.hidden = shell !== 'formatter' && shell !== 'diff';
    decodeControls.hidden = shell !== 'decode';
    encodeControls.hidden = shell !== 'encode';
    shellPickerLabel.textContent = SHELL_LABELS[shell];
    shellPickerMenu.querySelectorAll<HTMLButtonElement>('.shell-picker-option').forEach((btn) => {
      btn.setAttribute('aria-selected', btn.dataset.shell === shell ? 'true' : 'false');
    });
    decodeKindButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.decode === decodeKind);
    });
    if (shell === 'diff') {
      outputEditor.setOption('readOnly', false);
    } else {
      outputEditor.setOption('readOnly', true);
      outputWatermark.classList.add('hidden');
      clearDiffMarks();
    }
    updateWatermarkCopy();
  }

  let decodeRunTimer: number | null = null;

  function runDecode() {
    const rawInput = inputEditor.getValue();
    const trimmed = rawInput.trim();

    outputWatermark.classList.add('hidden');
    inputWatermark.classList.toggle('hidden', trimmed.length > 0);
    hideLanguageChrome();
    clearErrorMarks();
    outputEditor.getWrapperElement().classList.remove('error-output');

    if (!trimmed) {
      outputEditor.setValue('\u00a0');
      detectedHint.textContent = '';
      return;
    }

    if (shell === 'encode') {
      jsonBadge.style.display = 'none';
      dialectWrapper.style.display = 'none';
      setJsonToolsVisible(false);
      decodeBadge.hidden = false;
      decodeBadge.textContent = 'Base64 Encode';
      detectedHint.textContent = '';
      const result = encodeBase64(rawInput);
      if (result.isError) {
        outputEditor.getWrapperElement().classList.add('error-output');
        outputEditor.setValue(
          buildErrorBanner({
            commentPrefix: '//',
            title: 'Unable to encode as Base64',
            hint: 'Check that the input is valid UTF-8 text.',
            parserMessage: result.errorMessage || 'Encode failed',
          }) + rawInput
        );
        setEditorSyntaxMode('text');
        return;
      }
      setEditorSyntaxMode('text');
      outputEditor.setValue(result.text);
      return;
    }

    const kind = decodeKind === 'auto' ? detectDecode(rawInput) : decodeKind;
    if (kind === 'unknown') {
      setEditorSyntaxMode('text');
      detectedHint.textContent = 'Paste Base64, URL, Unicode, or JWT';
      outputEditor.setValue('// Paste encoded text to decode…');
      return;
    }

    const entry = getDecoder(kind);
    jsonBadge.style.display = 'none';
    dialectWrapper.style.display = 'none';
    setJsonToolsVisible(false);
    decodeBadge.hidden = false;
    decodeBadge.textContent = entry.label;
    detectedHint.textContent = decodeKind === 'auto' ? entry.label : '';

    const result = entry.decode(rawInput);

    if (result.isError) {
      outputEditor.getWrapperElement().classList.add('error-output');
      const errorBanner = buildErrorBanner({
        commentPrefix: '//',
        title: `Unable to decode as ${entry.label}`,
        hint: 'Check the encoding, or pick a different decoder.',
        parserMessage: result.errorMessage || 'Decode failed',
      });
      outputEditor.setValue(errorBanner + rawInput);
      setEditorSyntaxMode('text');
      return;
    }

    const startsJson =
      result.text.trimStart().startsWith('{') || result.text.trimStart().startsWith('[');
    setEditorSyntaxMode(result.kind !== 'jwt' && startsJson ? 'json' : 'text');
    outputEditor.setValue(result.text);
  }

  function scheduleDecode() {
    if (decodeRunTimer !== null) clearTimeout(decodeRunTimer);
    decodeRunTimer = window.setTimeout(() => {
      decodeRunTimer = null;
      runDecode();
    }, 250);
  }

  function setShell(next: 'formatter' | 'decode' | 'encode' | 'diff') {
    if (next === shell) {
      runWorkspace();
      return;
    }
    if (shell === 'diff') {
      persistDiffBNow();
    }
    shell = next;
    workspace = shell === 'diff' ? 'diff' : 'format';
    localStorage.setItem(SHELL_KEY, shell);
    localStorage.setItem(WORKSPACE_KEY, workspace);
    applyShellChrome();
    clearErrorMarks();
    if (shell === 'decode' || shell === 'encode') {
      ignoreEditorChange = true;
      outputEditor.setValue('');
      ignoreEditorChange = false;
      scheduleDecode();
    } else if (shell === 'diff') {
      const savedB = loadDiffBState();
      ignoreEditorChange = true;
      outputEditor.setValue(savedB?.value ?? '');
      ignoreEditorChange = false;
      runDiff();
    } else {
      outputWatermark.classList.add('hidden');
      runFormatting();
    }
  }

  updateWatermarkCopy();
  applyShellChrome();

  // ─── Core Formatting Pipeline ────────────────────────────────────────────
  function runFormatting() {
    const rawInput = inputEditor.getValue();
    const trimmed = rawInput.trim();

    outputWatermark.classList.add('hidden');
    if (trimmed.length > 0) {
      inputWatermark.classList.add('hidden');
    } else {
      inputWatermark.classList.remove('hidden');
    }

    if (!trimmed) {
      outputEditor.setValue('\u00a0');
      outputEditor.getWrapperElement().classList.remove('error-output');
      hideLanguageChrome();
      detectedHint.textContent = '';
      clearErrorMarks();
      return;
    }

    const targetFormat: DetectedLanguage =
      currentMode === 'auto' ? detectLanguage(rawInput) : currentMode;

    if (targetFormat === 'unknown') {
      setEditorSyntaxMode('text');
      hideLanguageChrome();
      detectedHint.textContent = 'Paste JSON or SQL';
      clearErrorMarks();
      outputEditor.setValue('// Paste valid JSON or SQL to format…');
      outputEditor.getWrapperElement().classList.remove('error-output');
      return;
    }

    const entry = applyLanguageChrome(targetFormat, true);
    detectedHint.textContent = currentMode === 'auto' ? entry.label : '';

    const result = entry.format(rawInput, {
      dialect: currentDialect,
      jsonMinify,
    });
    if (result.isError) {
      outputEditor.getWrapperElement().classList.add('error-output');
      const detectedLang = detectLanguage(rawInput);
      const errorBanner = buildErrorBanner({
        commentPrefix: entry.commentPrefix,
        title: entry.errorTitle({ dialect: currentDialect }),
        hint: mismatchHint(entry, detectedLang),
        parserMessage: result.errorMessage || entry.parserFallback,
      });
      outputEditor.setValue(errorBanner + rawInput);
      if (result.errorPosition) {
        showErrorMark(inputEditor, result.errorPosition);
      } else {
        clearErrorMarks();
      }
    } else {
      outputEditor.setValue(result.formatted);
      outputEditor.getWrapperElement().classList.remove('error-output');
      clearErrorMarks();
    }
  }

  inputEditor.on('focus', () => {
    focusedPane = 'input';
  });
  outputEditor.on('focus', () => {
    focusedPane = 'output';
  });

  inputEditor.on('change', () => {
    if (ignoreEditorChange) return;
    persistInputStateSoon();
    runWorkspace();
  });

  outputEditor.on('change', () => {
    if (ignoreEditorChange || shell !== 'diff') return;
    persistDiffBSoon();
    runDiff();
  });

  // ─── Context-menu pending input (chrome.storage.local) ───────────────────
  function isPendingInput(value: unknown): value is PendingInput {
    return (
      !!value &&
      typeof value === 'object' &&
      typeof (value as PendingInput).value === 'string'
    );
  }

  async function applyPendingInput(payload: PendingInput) {
    const target =
      shell === 'diff' && focusedPane === 'output'
        ? outputEditor
        : inputEditor;
    target.setValue(payload.value);
    if (target === inputEditor) {
      persistInputStateNow();
    } else {
      persistDiffBNow();
    }
    await chrome.storage.local.remove(PENDING_INPUT_KEY);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const pending = changes[PENDING_INPUT_KEY]?.newValue;
    if (isPendingInput(pending)) {
      void applyPendingInput(pending);
    }
  });

  chrome.storage.local.get(PENDING_INPUT_KEY).then((result) => {
    const pending = result[PENDING_INPUT_KEY];
    if (isPendingInput(pending)) {
      void applyPendingInput(pending);
    }
  });

  // ─── Mode Selector (Auto / JSON / SQL) ───────────────────────────────────
  function updateModeButtons() {
    modeButtons.forEach((btn) => {
      if (btn.dataset.mode === currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentMode = (btn.dataset.mode as 'auto' | 'json' | 'sql') || 'auto';
      localStorage.setItem(MODE_KEY, currentMode);
      updateModeButtons();
      runWorkspace();
    });
  });
  updateModeButtons();

  shellPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setShellMenuOpen(shellPickerMenu.hidden);
  });

  shellPickerMenu.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.shell-picker-option');
    if (!btn?.dataset.shell) return;
    setShellMenuOpen(false);
    setShell((btn.dataset.shell as 'formatter' | 'decode' | 'encode' | 'diff') || 'formatter');
  });

  decodeKindButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (btn.dataset.decode as 'auto' | DecodeKind) || 'auto';
      decodeKind = next;
      localStorage.setItem(DECODE_KIND_KEY, decodeKind);
      decodeKindButtons.forEach((b) => {
        b.classList.toggle('active', b.dataset.decode === decodeKind);
      });
      scheduleDecode();
    });
  });

  // ─── Dialect Selector Change ─────────────────────────────────────────────
  dialectSelect.addEventListener('change', () => {
    currentDialect = dialectSelect.value;
    localStorage.setItem(DIALECT_KEY, currentDialect);
    runWorkspace();
  });

  minifyBtn.addEventListener('click', () => {
    jsonMinify = !jsonMinify;
    localStorage.setItem(MINIFY_KEY, jsonMinify ? '1' : '0');
    minifyBtn.classList.toggle('active', jsonMinify);
    if (shell === 'formatter' && workspace === 'format') runFormatting();
  });

  const ESCAPE_TITLE = 'Escape as JSON string';
  const UNESCAPE_TITLE = 'Unescape JSON string';

  function flashToolError(btn: HTMLButtonElement, fallbackTitle: string, message: string) {
    btn.title = message;
    btn.classList.add('tool-error');
    window.setTimeout(() => {
      btn.title = fallbackTitle;
      btn.classList.remove('tool-error');
    }, 1800);
  }

  escapeBtn.addEventListener('click', () => {
    const result = escapeJsonString(inputEditor.getValue());
    if (result.isError) {
      flashToolError(escapeBtn, ESCAPE_TITLE, result.errorMessage || 'Could not escape');
      return;
    }
    inputEditor.setValue(result.value);
  });

  unescapeBtn.addEventListener('click', () => {
    const result = unescapeJsonString(inputEditor.getValue());
    if (result.isError) {
      flashToolError(unescapeBtn, UNESCAPE_TITLE, result.errorMessage || 'Could not unescape');
      return;
    }
    inputEditor.setValue(result.value);
  });

  // ─── Copy to Clipboard with Spring Animation ─────────────────────────────
  let copyTimeout: number | null = null;

  copyBtn.addEventListener('click', async () => {
    const source =
      workspace === 'diff'
        ? focusedPane === 'output'
          ? outputEditor
          : inputEditor
        : outputEditor;
    const textToCopy = source.getValue();
    if (!textToCopy || textToCopy === '\u00a0') return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      copyLabel.textContent = 'Copied';
      copyIconSlot.innerHTML = ICONS.check;
      copyBtn.classList.add('copied');

      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = window.setTimeout(() => {
        copyLabel.textContent = 'Copy';
        copyIconSlot.innerHTML = ICONS.copy;
        copyBtn.classList.remove('copied');
      }, 1600);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });

  // ─── Cursor Position Indicator ───────────────────────────────────────────
  function updateCursorPosition() {
    const editor = focusedPane === 'output' ? outputEditor : inputEditor;
    const cursor = editor.getCursor();
    cursorPosEl.textContent = `${cursor.line + 1}:${cursor.ch + 1}`;
  }

  inputEditor.on('cursorActivity', () => {
    if (focusedPane === 'input') updateCursorPosition();
    persistInputStateSoon();
  });
  outputEditor.on('cursorActivity', () => {
    if (focusedPane === 'output') updateCursorPosition();
    if (workspace === 'diff') persistDiffBSoon();
  });
  updateCursorPosition();

  // ─── Splitter Resizing (Hairline + Pill Grip) ─────────────────────────────
  let minHeight = 70;
  let lastInputHeight: number | null = null;
  let lastOutputHeight: number | null = null;

  function setInitialEditorHeights() {
    const containerHeight = appContainer.clientHeight;
    const splitterHeight = splitter.offsetHeight || 10;
    minHeight = 70;
    let inputHeight =
      lastInputHeight !== null
        ? lastInputHeight
        : Math.max(minHeight, Math.floor((containerHeight - splitterHeight) * 0.45));
    let outputHeight =
      lastOutputHeight !== null
        ? lastOutputHeight
        : Math.max(minHeight, containerHeight - splitterHeight - inputHeight);

    if (inputHeight < minHeight) inputHeight = minHeight;
    if (outputHeight < minHeight) outputHeight = minHeight;

    inputArea.style.flexBasis = inputHeight + 'px';
    outputArea.style.flexBasis = outputHeight + 'px';
  }

  setInitialEditorHeights();

  window.addEventListener('resize', () => {
    setInitialEditorHeights();
    inputEditor.refresh();
    outputEditor.refresh();
  });

  let isDragging = false;
  let startY = 0;
  let startInputHeight = 0;
  let startOutputHeight = 0;

  splitter.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    splitter.classList.add('active');
    startY = e.clientY;
    startInputHeight =
      parseInt(window.getComputedStyle(inputArea).flexBasis) || inputArea.offsetHeight;
    startOutputHeight =
      parseInt(window.getComputedStyle(outputArea).flexBasis) || outputArea.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    const containerRect = appContainer.getBoundingClientRect();
    const dy = e.clientY - startY;
    let newInputHeight = Math.max(minHeight, startInputHeight + dy);
    let newOutputHeight = Math.max(minHeight, startOutputHeight - dy);
    const totalHeight = containerRect.height - splitter.offsetHeight;

    if (newInputHeight + newOutputHeight > totalHeight) {
      if (dy > 0) {
        newInputHeight = totalHeight - minHeight;
        newOutputHeight = minHeight;
      } else {
        newInputHeight = minHeight;
        newOutputHeight = totalHeight - minHeight;
      }
    }
    inputArea.style.flexBasis = newInputHeight + 'px';
    outputArea.style.flexBasis = newOutputHeight + 'px';
    lastInputHeight = newInputHeight;
    lastOutputHeight = newOutputHeight;
    inputEditor.refresh();
    outputEditor.refresh();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      splitter.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      inputEditor.refresh();
      outputEditor.refresh();
    }
  });

  // Run initial formatting / diff / decode pass
  if (shell === 'decode' || shell === 'encode') {
    scheduleDecode();
  } else if (workspace === 'diff') {
    runDiff();
  } else {
    runFormatting();
  }
});
