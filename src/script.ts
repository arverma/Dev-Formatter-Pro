// src/script.ts
// Dev Formatter Pro — Apple Minimalist Controller (Integrated Themes, Zero Duplicate Headers)
// Seamless theme synchronization, auto-detection, dialect selection, and SVG interactions.

import { detectLanguage, DetectedLanguage } from './core/detectLanguage';
import { buildErrorBanner } from './core/errorBanner';
import { PENDING_INPUT_KEY, PendingInput } from './core/pendingInput';
import type { ErrorPosition } from './core/errorPosition';
import { getFormatter, mismatchHint } from './features/registry';
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
  { label: 'Dev Formatter Dark', value: 'dev-formatter-dark', isDark: true },
  { label: 'Dev Formatter Light', value: 'dev-formatter-light', isDark: false },
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

  // ─── DOM References ──────────────────────────────────────────────────────
  const inputEditorEl = document.getElementById('jsonInputEditor') as HTMLElement;
  const outputEditorEl = document.getElementById('jsonOutputEditor') as HTMLElement;
  const splitter = document.getElementById('splitter') as HTMLElement;
  const inputArea = document.getElementById('inputArea') as HTMLElement;
  const outputArea = document.getElementById('outputArea') as HTMLElement;
  const appContainer = document.querySelector('.app-container') as HTMLElement;
  const cursorPosEl = document.getElementById('cursorPos') as HTMLElement;
  const inputWatermark = document.getElementById('inputWatermark') as HTMLElement;
  const jsonBadge = document.getElementById('jsonBadge') as HTMLElement;
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
  const modeButtons = document.querySelectorAll<HTMLButtonElement>('.segment-btn');
  const editorThemeSelect = document.getElementById('editorThemeSelect') as HTMLSelectElement;
  const cmDynamicThemeLink = document.getElementById('cmDynamicTheme') as HTMLLinkElement;

  // ─── State ───────────────────────────────────────────────────────────────
  const savedInputState = loadInputState();
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

  // ─── Populate Theme Dropdown ─────────────────────────────────────────────
  EDITOR_THEMES.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    if (t.value === currentEditorTheme) {
      opt.selected = true;
    }
    editorThemeSelect.appendChild(opt);
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
    readOnly: true,
    theme: currentEditorTheme,
    value: '',
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

  // ─── Persist Input + Selection ───────────────────────────────────────────
  let persistTimer: number | null = null;

  function captureInputState(): SavedInputState {
    const cursor = inputEditor.getCursor();
    const primary = inputEditor.listSelections()?.[0];
    const hasSelection =
      !!primary &&
      (primary.anchor.line !== primary.head.line ||
        primary.anchor.ch !== primary.head.ch);

    return {
      value: inputEditor.getValue(),
      cursor: { line: cursor.line, ch: cursor.ch },
      selection: hasSelection
        ? {
            anchor: { line: primary.anchor.line, ch: primary.anchor.ch },
            head: { line: primary.head.line, ch: primary.head.ch },
          }
        : undefined,
    };
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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistInputStateNow();
  });
  window.addEventListener('pagehide', persistInputStateNow);

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
  }

  // Initial Theme Application
  applyTheme(currentEditorTheme);

  editorThemeSelect.addEventListener('change', () => {
    currentEditorTheme = editorThemeSelect.value;
    applyTheme(currentEditorTheme);
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

  // ─── Parse-error marks (input editor) ────────────────────────────────────
  let errorMark: { clear: () => void } | null = null;
  let errorLine: number | null = null;
  let lastErrorPos: ErrorPosition | null = null;

  function clearErrorMarks() {
    if (errorMark) {
      errorMark.clear();
      errorMark = null;
    }
    if (errorLine !== null) {
      inputEditor.removeLineClass(errorLine, 'background', 'cm-error-line');
      errorLine = null;
    }
    lastErrorPos = null;
    errorPill.hidden = true;
    errorPill.textContent = '';
  }

  function showErrorMark(pos: ErrorPosition) {
    clearErrorMarks();
    lastErrorPos = pos;
    const lineText = inputEditor.getLine(pos.line) ?? '';
    const from = { line: pos.line, ch: Math.min(pos.ch, lineText.length) };
    const toCh = Math.min(from.ch + 1, Math.max(lineText.length, from.ch + 1));
    errorMark = inputEditor.markText(from, { line: pos.line, ch: toCh }, {
      className: 'cm-error-mark',
    });
    inputEditor.addLineClass(pos.line, 'background', 'cm-error-line');
    errorLine = pos.line;
    errorPill.hidden = false;
    errorPill.textContent = `${pos.line + 1}:${pos.ch + 1}`;
    errorPill.title = `Jump to parse error at ${pos.line + 1}:${pos.ch + 1}`;
  }

  function setJsonToolsVisible(visible: boolean) {
    jsonTools.hidden = !visible;
  }

  errorPill.addEventListener('click', () => {
    if (!lastErrorPos) return;
    inputEditor.focus();
    inputEditor.setCursor(lastErrorPos);
    inputEditor.scrollIntoView(lastErrorPos, 40);
  });

  minifyBtn.classList.toggle('active', jsonMinify);

  // ─── Core Formatting Pipeline ────────────────────────────────────────────
  function runFormatting() {
    const rawInput = inputEditor.getValue();
    const trimmed = rawInput.trim();

    // Toggle watermark visibility
    if (trimmed.length > 0) {
      inputWatermark.classList.add('hidden');
    } else {
      inputWatermark.classList.remove('hidden');
    }

    if (!trimmed) {
      outputEditor.setValue('\u00a0');
      outputEditor.getWrapperElement().classList.remove('error-output');
      jsonBadge.style.display = 'none';
      dialectWrapper.style.display = 'none';
      detectedHint.textContent = '';
      setJsonToolsVisible(false);
      clearErrorMarks();
      return;
    }

    const targetFormat: DetectedLanguage =
      currentMode === 'auto' ? detectLanguage(rawInput) : currentMode;

    if (targetFormat === 'unknown') {
      setEditorSyntaxMode('text');
      jsonBadge.style.display = 'none';
      dialectWrapper.style.display = 'none';
      detectedHint.textContent = 'Paste JSON or SQL';
      setJsonToolsVisible(false);
      clearErrorMarks();
      outputEditor.setValue('// Paste valid JSON or SQL to format…');
      outputEditor.getWrapperElement().classList.remove('error-output');
      return;
    }

    const entry = getFormatter(targetFormat);
    setEditorSyntaxMode(entry.cmLang);
    jsonBadge.style.display = entry.id === 'json' ? 'inline-flex' : 'none';
    dialectWrapper.style.display = entry.id === 'sql' ? 'inline-flex' : 'none';
    detectedHint.textContent = currentMode === 'auto' ? entry.label : '';
    setJsonToolsVisible(entry.id === 'json');

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
        showErrorMark(result.errorPosition);
      } else {
        clearErrorMarks();
      }
    } else {
      outputEditor.setValue(result.formatted);
      outputEditor.getWrapperElement().classList.remove('error-output');
      clearErrorMarks();
    }
  }

  inputEditor.on('change', () => {
    persistInputStateSoon();
    runFormatting();
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
    inputEditor.setValue(payload.value);
    persistInputStateNow();
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
      runFormatting();
    });
  });
  updateModeButtons();

  // ─── Dialect Selector Change ─────────────────────────────────────────────
  dialectSelect.addEventListener('change', () => {
    currentDialect = dialectSelect.value;
    localStorage.setItem(DIALECT_KEY, currentDialect);
    runFormatting();
  });

  minifyBtn.addEventListener('click', () => {
    jsonMinify = !jsonMinify;
    localStorage.setItem(MINIFY_KEY, jsonMinify ? '1' : '0');
    minifyBtn.classList.toggle('active', jsonMinify);
    runFormatting();
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
    const textToCopy = outputEditor.getValue();
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
    const cursor = inputEditor.getCursor();
    cursorPosEl.textContent = `${cursor.line + 1}:${cursor.ch + 1}`;
  }

  inputEditor.on('cursorActivity', () => {
    updateCursorPosition();
    persistInputStateSoon();
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

  // Run initial formatting pass
  runFormatting();
});
