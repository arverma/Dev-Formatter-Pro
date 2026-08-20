// Side panel bootstrap — wires editors, workspaces, and chrome.

import type { DetectedLanguage } from '../../core/detectLanguage';
import { getFormatter } from '../../features/registry';
import {
  escapeJsonString,
  unescapeJsonString,
} from '../../features/json/jsonEscape';
import { SQL_DIALECTS, DEFAULT_SQL_DIALECT } from '../../features/sql/dialects';
import type { DecodeKind } from '../../features/decode/types';
import type { ConvertDirection } from '../../features/convert/types';

import type {
  DecodeKindState,
  ManualMode,
  PanelContext,
  Shell,
} from './context';
import { ICONS } from './icons';
import {
  EDITOR_THEMES,
  DEFAULT_EDITOR_THEME,
  applyTheme,
} from './themes';
import {
  THEME_KEY,
  DIALECT_KEY,
  MODE_KEY,
  MINIFY_KEY,
  WORKSPACE_KEY,
  SHELL_KEY,
  DECODE_KIND_KEY,
  CONVERT_DIR_KEY,
  CONVERT_TZ_KEY,
  loadInputState,
  loadDiffBState,
  saveInputState,
  saveDiffBState,
  captureEditorState,
  notifyPanelClosed,
} from './persistence';
import { createMenuControllers } from './menus';
import { updateModeButtons, flashToolError, flashCopySuccess } from './toolbar';
import { setupSplitterResize } from './layout';
import { createPendingInputController } from './chromePending';
import { createSearchReplaceController } from './editors/searchReplace';
import { createPanelEditors } from './editors/setup';
import { createSyntaxErrorController } from './editors/syntaxErrors';
import { createDiffMarksController } from './editors/diffMarks';
import { bindFormatWorkspace } from './workspaces/format';
import { bindDecodeWorkspace } from './workspaces/decode';
import { bindConvertWorkspace } from './workspaces/convert';
import { bindDiffWorkspace } from './workspaces/diff';
import { bindScheduleWorkspace } from './workspaces/schedule';
import { bindShellWorkspace } from './workspaces/shell';

function createPanelApp() {
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
  const dialectPickerBtn = document.getElementById('dialectPickerBtn') as HTMLButtonElement;
  const dialectPickerMenu = document.getElementById('dialectPickerMenu') as HTMLElement;
  const dialectPickerLabel = document.getElementById('dialectPickerLabel') as HTMLElement;
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
  const convertControls = document.getElementById('convertControls') as HTMLElement;
  const decodeKindButtons = document.querySelectorAll<HTMLButtonElement>('.segment-btn[data-decode]');
  const convertDirectionButtons = document.querySelectorAll<HTMLButtonElement>(
    '.segment-btn[data-convert]'
  );
  const tzPicker = document.getElementById('tzPicker') as HTMLElement;
  const tzPickerBtn = document.getElementById('tzPickerBtn') as HTMLButtonElement;
  const tzPickerMenu = document.getElementById('tzPickerMenu') as HTMLElement;
  const tzPickerLabel = document.getElementById('tzPickerLabel') as HTMLElement;
  const themePicker = document.getElementById('themePicker') as HTMLElement;
  const themePickerBtn = document.getElementById('themePickerBtn') as HTMLButtonElement;
  const themePickerMenu = document.getElementById('themePickerMenu') as HTMLElement;
  const cmDynamicThemeLink = document.getElementById('cmDynamicTheme') as HTMLLinkElement;
  document.body.appendChild(shellPickerMenu);
  document.body.appendChild(themePickerMenu);
  document.body.appendChild(dialectPickerMenu);
  document.body.appendChild(tzPickerMenu);

  // ─── State ───────────────────────────────────────────────────────────────
  const savedInputState = loadInputState();
  const savedDiffBState = loadDiffBState();
  const savedShell = localStorage.getItem(SHELL_KEY);
  let shell: Shell =
    savedShell === 'decode' ||
    savedShell === 'diff' ||
    savedShell === 'encode' ||
    savedShell === 'convert' ||
    savedShell === 'formatter'
      ? savedShell
      : localStorage.getItem('devFormatterBase64Direction') === 'encode'
        ? 'encode'
        : localStorage.getItem(WORKSPACE_KEY) === 'diff'
          ? 'diff'
          : 'formatter';
  let workspace: 'format' | 'diff' = shell === 'diff' ? 'diff' : 'format';
  let decodeKind: DecodeKindState =
    (localStorage.getItem(DECODE_KIND_KEY) as DecodeKindState) || 'auto';
  if (
    decodeKind !== 'auto' &&
    decodeKind !== 'base64' &&
    decodeKind !== 'url' &&
    decodeKind !== 'unicode' &&
    decodeKind !== 'jwt'
  ) {
    decodeKind = 'auto';
  }
  let convertDirection: ConvertDirection =
    (localStorage.getItem(CONVERT_DIR_KEY) as ConvertDirection) || 'auto';
  if (
    convertDirection !== 'auto' &&
    convertDirection !== 'epoch' &&
    convertDirection !== 'date'
  ) {
    convertDirection = 'auto';
  }
  let localTimeZone = 'UTC';
  try {
    localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    localTimeZone = 'UTC';
  }
  let convertTimeZone = localStorage.getItem(CONVERT_TZ_KEY) || 'local';
  let currentMode: ManualMode =
    (localStorage.getItem(MODE_KEY) as ManualMode) || 'auto';
  let currentDialect: string =
    localStorage.getItem(DIALECT_KEY) || DEFAULT_SQL_DIALECT;
  if (!SQL_DIALECTS.some((d) => d.value === currentDialect)) {
    currentDialect = DEFAULT_SQL_DIALECT;
  }
  let currentEditorTheme: string =
    localStorage.getItem(THEME_KEY) || DEFAULT_EDITOR_THEME;
  if (!EDITOR_THEMES.some((t) => t.value === currentEditorTheme)) {
    currentEditorTheme = DEFAULT_EDITOR_THEME;
  }
  let jsonMinify = localStorage.getItem(MINIFY_KEY) === '1';

  // ─── Populate Dialect Menu ───────────────────────────────────────────────
  SQL_DIALECTS.forEach((d) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'dialect-picker-option';
    opt.role = 'option';
    opt.dataset.value = d.value;
    opt.textContent = d.label;
    dialectPickerMenu.appendChild(opt);
  });

  function syncDialectPicker() {
    const matched =
      SQL_DIALECTS.find((d) => d.value === currentDialect) || SQL_DIALECTS[0];
    dialectPickerLabel.textContent = matched.label;
    dialectPickerBtn.title = matched.label;
    dialectPickerMenu
      .querySelectorAll<HTMLButtonElement>('.dialect-picker-option')
      .forEach((btn) => {
        btn.setAttribute(
          'aria-selected',
          btn.dataset.value === matched.value ? 'true' : 'false'
        );
      });
  }
  syncDialectPicker();

  // ─── Populate Timezone Menu ──────────────────────────────────────────────
  function listTimeZones(): string[] {
    try {
      const intlAny = Intl as typeof Intl & {
        supportedValuesOf?: (key: string) => string[];
      };
      if (typeof intlAny.supportedValuesOf === 'function') {
        return intlAny.supportedValuesOf('timeZone');
      }
    } catch {
      // ignore
    }
    return ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo'];
  }

  const tzOptions: { value: string; label: string }[] = [
    { value: 'local', label: `Local (${localTimeZone})` },
    { value: 'UTC', label: 'UTC' },
  ];
  for (const z of listTimeZones()) {
    if (z === 'UTC') continue;
    tzOptions.push({ value: z, label: z });
  }
  if (
    convertTimeZone !== 'local' &&
    convertTimeZone !== 'UTC' &&
    !tzOptions.some((o) => o.value === convertTimeZone)
  ) {
    convertTimeZone = 'local';
  }

  tzOptions.forEach((z) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'dialect-picker-option';
    opt.role = 'option';
    opt.dataset.value = z.value;
    opt.textContent = z.label;
    tzPickerMenu.appendChild(opt);
  });

  function resolveConvertTimeZone(): string {
    return convertTimeZone === 'local' ? localTimeZone : convertTimeZone;
  }

  function syncTzPicker() {
    const matched =
      tzOptions.find((z) => z.value === convertTimeZone) || tzOptions[0];
    tzPickerLabel.textContent =
      convertTimeZone === 'local' ? 'Local' : matched.label;
    tzPickerBtn.title = matched.label;
    tzPickerMenu
      .querySelectorAll<HTMLButtonElement>('.dialect-picker-option')
      .forEach((btn) => {
        btn.setAttribute(
          'aria-selected',
          btn.dataset.value === matched.value ? 'true' : 'false'
        );
      });
  }
  syncTzPicker();

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

  // ─── Search / editors ────────────────────────────────────────────────────
  const search = createSearchReplaceController();
  const { inputEditor, outputEditor } = createPanelEditors({
    inputEditorEl,
    outputEditorEl,
    theme: currentEditorTheme,
    inputValue: savedInputState?.value ?? '',
    outputValue:
      shell === 'decode' || shell === 'encode' || shell === 'convert'
        ? ''
        : workspace === 'diff'
          ? (savedDiffBState?.value ?? '')
          : '',
    outputReadOnly: shell !== 'diff',
    searchExtraKeys: search.searchExtraKeys,
  });
  search.attachToEditors(inputEditor, outputEditor);

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

  function captureInputState() {
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

  // ─── Theme + menus ───────────────────────────────────────────────────────
  const menus = createMenuControllers({
    themePickerMenu,
    themePickerBtn,
    shellPickerMenu,
    shellPickerBtn,
    dialectPickerMenu,
    dialectPickerBtn,
    tzPickerMenu,
    tzPickerBtn,
  });

  function applyCurrentTheme(themeValue: string) {
    applyTheme({
      themeValue,
      cmDynamicThemeLink,
      inputEditor,
      outputEditor,
      themeKey: THEME_KEY,
      themePickerBtn,
      themePickerMenu,
    });
  }

  applyCurrentTheme(currentEditorTheme);

  themePickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menus.setThemeMenuOpen(themePickerMenu.hidden);
  });

  themePickerMenu.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      '.theme-picker-option'
    );
    if (!btn?.dataset.value) return;
    currentEditorTheme = btn.dataset.value;
    applyCurrentTheme(currentEditorTheme);
    menus.setThemeMenuOpen(false);
  });

  document.addEventListener('click', (e) => {
    const t = e.target as Node;
    if (
      !themePickerMenu.hidden &&
      !themePicker.contains(t) &&
      !themePickerMenu.contains(t)
    ) {
      menus.setThemeMenuOpen(false);
    }
    if (
      !shellPickerMenu.hidden &&
      !shellPicker.contains(t) &&
      !shellPickerMenu.contains(t)
    ) {
      menus.setShellMenuOpen(false);
    }
    if (
      !dialectPickerMenu.hidden &&
      !dialectWrapper.contains(t) &&
      !dialectPickerMenu.contains(t)
    ) {
      menus.setDialectMenuOpen(false);
    }
    if (
      !tzPickerMenu.hidden &&
      !tzPicker.contains(t) &&
      !tzPickerMenu.contains(t)
    ) {
      menus.setTzMenuOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!themePickerMenu.hidden) {
      menus.setThemeMenuOpen(false);
      themePickerBtn.focus();
    }
    if (!shellPickerMenu.hidden) {
      menus.setShellMenuOpen(false);
      shellPickerBtn.focus();
    }
    if (!dialectPickerMenu.hidden) {
      menus.setDialectMenuOpen(false);
      dialectPickerBtn.focus();
    }
    if (!tzPickerMenu.hidden) {
      menus.setTzMenuOpen(false);
      tzPickerBtn.focus();
    }
    search.closeAllSearchUi();
  });

  // ─── Syntax errors + diff marks ──────────────────────────────────────────
  const syntax = createSyntaxErrorController({
    inputEditor,
    outputEditor,
    errorPill,
  });
  const diffMarks = createDiffMarksController({ inputEditor, outputEditor });

  function setJsonToolsVisible(visible: boolean) {
    jsonTools.hidden = !visible;
  }

  errorPill.addEventListener('click', () => {
    const lastErrorPos = syntax.getLastErrorPos();
    const errorEditor = syntax.getErrorEditor();
    if (!lastErrorPos || !errorEditor) return;
    errorEditor.focus();
    errorEditor.setCursor(lastErrorPos);
    errorEditor.scrollIntoView(lastErrorPos, 40);
  });

  minifyBtn.classList.toggle('active', jsonMinify);

  function applyLanguageChrome(
    targetFormat: Exclude<DetectedLanguage, 'unknown'>,
    showJsonTools: boolean
  ) {
    const entry = getFormatter(targetFormat);
    syntax.setEditorSyntaxMode(entry.cmLang);
    decodeBadge.hidden = true;
    jsonBadge.style.display = entry.id === 'json' ? 'inline-flex' : 'none';
    dialectWrapper.style.display = entry.id === 'sql' ? 'inline-flex' : 'none';
    setJsonToolsVisible(showJsonTools && entry.id === 'json');
    return entry;
  }

  function hideLanguageChrome() {
    jsonBadge.style.display = 'none';
    decodeBadge.hidden = true;
    dialectWrapper.style.display = 'none';
    setJsonToolsVisible(false);
  }

  // ─── Panel context + workspace bindings ──────────────────────────────────
  const ctx = {
    inputEditor,
    outputEditor,
    inputWatermark,
    outputWatermark,
    jsonBadge,
    decodeBadge,
    dialectWrapper,
    detectedHint,
    jsonTools,
    errorPill,
    formatterControls,
    decodeControls,
    encodeControls,
    convertControls,
    shellPickerLabel,
    shellPickerMenu,
    decodeKindButtons,
    convertDirectionButtons,
    tzPickerLabel,
    tzPickerMenu,
    tzPickerBtn,
    get shell() {
      return shell;
    },
    set shell(v: Shell) {
      shell = v;
    },
    get workspace() {
      return workspace;
    },
    set workspace(v: 'format' | 'diff') {
      workspace = v;
    },
    get decodeKind() {
      return decodeKind;
    },
    set decodeKind(v: DecodeKindState) {
      decodeKind = v;
    },
    get convertDirection() {
      return convertDirection;
    },
    set convertDirection(v: ConvertDirection) {
      convertDirection = v;
    },
    get convertTimeZone() {
      return convertTimeZone;
    },
    set convertTimeZone(v: string) {
      convertTimeZone = v;
    },
    get currentMode() {
      return currentMode;
    },
    set currentMode(v: ManualMode) {
      currentMode = v;
    },
    get currentDialect() {
      return currentDialect;
    },
    set currentDialect(v: string) {
      currentDialect = v;
    },
    get jsonMinify() {
      return jsonMinify;
    },
    set jsonMinify(v: boolean) {
      jsonMinify = v;
    },
    ignoreEditorChange: false,
    focusedPane: 'input' as const,
    workspaceRunTimer: null as number | null,
    decodeRunTimer: null as number | null,
    convertRunTimer: null as number | null,
    clearDiffMarks: diffMarks.clearDiffMarks,
    applyDiffMarks: diffMarks.applyDiffMarks,
    clearErrorMarks: syntax.clearErrorMarks,
    showErrorMark: syntax.showErrorMark,
    setEditorSyntaxMode: syntax.setEditorSyntaxMode,
    closeEditorSearchUi: search.closeEditorSearchUi,
    setJsonToolsVisible,
    applyLanguageChrome,
    hideLanguageChrome,
    persistDiffBNow,
    loadDiffBState,
    resolveConvertTimeZone,
    syncTzPicker,
    // Filled by bind* below
    runFormatting: () => {},
    runDecode: () => {},
    scheduleDecode: () => {},
    runConvert: () => {},
    scheduleConvert: () => {},
    runDiff: (_options?: { prettyPrint?: boolean }) => {},
    scheduleWorkspace: (_options?: { prettyPrintDiff?: boolean }) => {},
    runWorkspace: (_options?: { prettyPrintDiff?: boolean }) => {},
    runWorkspaceNow: () => {},
    flushWorkspaceTimers: () => {},
    applyShellChrome: () => {},
    setShell: (_next: Shell) => {},
    updateWatermarkCopy: () => {},
  } as PanelContext;

  bindFormatWorkspace(ctx);
  bindDecodeWorkspace(ctx);
  bindConvertWorkspace(ctx);
  bindDiffWorkspace(ctx);
  bindScheduleWorkspace(ctx);
  bindShellWorkspace(ctx);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistInputStateNow();
      if (ctx.workspace === 'diff') persistDiffBNow();
      ctx.flushWorkspaceTimers();
      notifyPanelClosed();
    }
  });
  window.addEventListener('pagehide', () => {
    persistInputStateNow();
    if (ctx.workspace === 'diff') persistDiffBNow();
    ctx.flushWorkspaceTimers();
    notifyPanelClosed();
  });

  ctx.updateWatermarkCopy();
  ctx.applyShellChrome();

  inputEditor.on('focus', () => {
    ctx.focusedPane = 'input';
  });
  outputEditor.on('focus', () => {
    ctx.focusedPane = 'output';
  });

  function isPasteOrigin(origin: unknown): boolean {
    return origin === 'paste' || origin === 'drop';
  }

  inputEditor.on('change', (_cm: unknown, changeObj?: { origin?: string }) => {
    if (ctx.ignoreEditorChange) return;
    persistInputStateSoon();
    if (ctx.shell === 'decode' || ctx.shell === 'encode') {
      ctx.scheduleDecode();
    } else if (ctx.shell === 'convert') {
      ctx.scheduleConvert();
    } else if (ctx.shell === 'diff' && isPasteOrigin(changeObj?.origin)) {
      ctx.scheduleWorkspace({ prettyPrintDiff: true });
    } else {
      ctx.scheduleWorkspace();
    }
  });

  outputEditor.on('change', (_cm: unknown, changeObj?: { origin?: string }) => {
    if (ctx.ignoreEditorChange || ctx.shell !== 'diff') return;
    persistDiffBSoon();
    if (isPasteOrigin(changeObj?.origin)) {
      ctx.scheduleWorkspace({ prettyPrintDiff: true });
    } else {
      ctx.scheduleWorkspace();
    }
  });

  // ─── Context-menu pending input ──────────────────────────────────────────
  const pending = createPendingInputController({
    getShell: () => ctx.shell,
    getFocusedPane: () => ctx.focusedPane,
    inputEditor,
    outputEditor,
    persistInputStateNow,
    persistDiffBNow,
    runWorkspaceNow: () => ctx.runWorkspaceNow(),
  });
  pending.registerPendingInputListeners();

  // ─── Mode / shell / dialect / tools ──────────────────────────────────────
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      ctx.currentMode = (btn.dataset.mode as ManualMode) || 'auto';
      localStorage.setItem(MODE_KEY, ctx.currentMode);
      updateModeButtons(modeButtons, ctx.currentMode);
      ctx.runWorkspaceNow();
    });
  });
  updateModeButtons(modeButtons, ctx.currentMode);

  shellPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menus.setShellMenuOpen(shellPickerMenu.hidden);
  });

  shellPickerMenu.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      '.shell-picker-option'
    );
    if (!btn?.dataset.shell) return;
    menus.setShellMenuOpen(false);
    ctx.setShell((btn.dataset.shell as Shell) || 'formatter');
  });

  decodeKindButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (btn.dataset.decode as 'auto' | DecodeKind) || 'auto';
      ctx.decodeKind = next;
      localStorage.setItem(DECODE_KIND_KEY, ctx.decodeKind);
      decodeKindButtons.forEach((b) => {
        b.classList.toggle('active', b.dataset.decode === ctx.decodeKind);
      });
      ctx.scheduleDecode();
    });
  });

  convertDirectionButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (btn.dataset.convert as ConvertDirection) || 'auto';
      ctx.convertDirection = next;
      localStorage.setItem(CONVERT_DIR_KEY, ctx.convertDirection);
      convertDirectionButtons.forEach((b) => {
        b.classList.toggle('active', b.dataset.convert === ctx.convertDirection);
      });
      ctx.scheduleConvert();
    });
  });

  tzPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menus.setTzMenuOpen(tzPickerMenu.hidden);
  });

  tzPickerMenu.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      '.dialect-picker-option'
    );
    if (!btn?.dataset.value) return;
    ctx.convertTimeZone = btn.dataset.value;
    localStorage.setItem(CONVERT_TZ_KEY, ctx.convertTimeZone);
    syncTzPicker();
    menus.setTzMenuOpen(false);
    if (ctx.shell === 'convert') {
      ctx.scheduleConvert();
    }
  });

  dialectPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menus.setDialectMenuOpen(dialectPickerMenu.hidden);
  });

  dialectPickerMenu.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      '.dialect-picker-option'
    );
    if (!btn?.dataset.value) return;
    ctx.currentDialect = btn.dataset.value;
    localStorage.setItem(DIALECT_KEY, ctx.currentDialect);
    syncDialectPicker();
    menus.setDialectMenuOpen(false);
    ctx.runWorkspaceNow();
  });

  minifyBtn.addEventListener('click', () => {
    ctx.jsonMinify = !ctx.jsonMinify;
    localStorage.setItem(MINIFY_KEY, ctx.jsonMinify ? '1' : '0');
    minifyBtn.classList.toggle('active', ctx.jsonMinify);
    if (ctx.shell === 'formatter' && ctx.workspace === 'format') {
      if (ctx.workspaceRunTimer !== null) {
        clearTimeout(ctx.workspaceRunTimer);
        ctx.workspaceRunTimer = null;
      }
      ctx.runFormatting();
    }
  });

  const ESCAPE_TITLE = 'Escape as JSON string';
  const UNESCAPE_TITLE = 'Unescape JSON string';

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
      flashToolError(
        unescapeBtn,
        UNESCAPE_TITLE,
        result.errorMessage || 'Could not unescape'
      );
      return;
    }
    inputEditor.setValue(result.value);
  });

  // ─── Copy to Clipboard ───────────────────────────────────────────────────
  let copyTimeout: number | null = null;

  copyBtn.addEventListener('click', async () => {
    const source =
      ctx.workspace === 'diff'
        ? ctx.focusedPane === 'output'
          ? outputEditor
          : inputEditor
        : outputEditor;
    const textToCopy = source.getValue();
    if (!textToCopy || textToCopy === '\u00a0') return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      flashCopySuccess({
        copyBtn,
        copyLabel,
        copyIconSlot,
        checkHtml: ICONS.check,
        copyHtml: ICONS.copy,
        getTimeout: () => copyTimeout,
        setTimeoutId: (id) => {
          copyTimeout = id;
        },
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });

  // ─── Cursor Position Indicator ───────────────────────────────────────────
  function updateCursorPosition() {
    const editor = ctx.focusedPane === 'output' ? outputEditor : inputEditor;
    const cursor = editor.getCursor();
    cursorPosEl.textContent = `${cursor.line + 1}:${cursor.ch + 1}`;
  }

  inputEditor.on('cursorActivity', () => {
    if (ctx.focusedPane === 'input') updateCursorPosition();
    persistInputStateSoon();
  });
  outputEditor.on('cursorActivity', () => {
    if (ctx.focusedPane === 'output') updateCursorPosition();
    if (ctx.workspace === 'diff') persistDiffBSoon();
  });
  updateCursorPosition();

  setupSplitterResize({
    splitter,
    inputArea,
    outputArea,
    appContainer,
    inputEditor,
    outputEditor,
  });

  // Run initial formatting / diff / decode / convert pass
  if (ctx.shell === 'decode' || ctx.shell === 'encode') {
    ctx.scheduleDecode();
  } else if (ctx.shell === 'convert') {
    ctx.scheduleConvert();
  } else if (ctx.workspace === 'diff') {
    ctx.runDiff({ prettyPrint: true });
  } else {
    ctx.runFormatting();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  createPanelApp();
});
