import type { DetectedLanguage } from '../../core/detectLanguage';
import type { ErrorPosition } from '../../core/errorPosition';
import type { DecodeKind } from '../../features/decode/types';
import type { SavedInputState } from './persistence';

export type Shell = 'formatter' | 'decode' | 'encode' | 'diff';
export type Workspace = 'format' | 'diff';
export type ManualMode = 'auto' | 'json' | 'sql';
export type DecodeKindState = 'auto' | DecodeKind;
export type FocusedPane = 'input' | 'output';

/** Mutable panel app bag — workspace modules read/write through this. */
export interface PanelContext {
  // Editors (CodeMirror instances)
  inputEditor: any;
  outputEditor: any;

  // DOM
  inputWatermark: HTMLElement;
  outputWatermark: HTMLElement;
  jsonBadge: HTMLElement;
  decodeBadge: HTMLElement;
  dialectWrapper: HTMLElement;
  detectedHint: HTMLElement;
  jsonTools: HTMLElement;
  errorPill: HTMLButtonElement;
  formatterControls: HTMLElement;
  decodeControls: HTMLElement;
  encodeControls: HTMLElement;
  shellPickerLabel: HTMLElement;
  shellPickerMenu: HTMLElement;
  decodeKindButtons: NodeListOf<HTMLButtonElement>;

  // State
  shell: Shell;
  workspace: Workspace;
  decodeKind: DecodeKindState;
  currentMode: ManualMode;
  currentDialect: string;
  jsonMinify: boolean;
  ignoreEditorChange: boolean;
  focusedPane: FocusedPane;

  // Timers
  workspaceRunTimer: number | null;
  decodeRunTimer: number | null;

  // Diff marks bag (owned by diffMarks module, referenced here for shell clear)
  clearDiffMarks: () => void;
  applyDiffMarks: (hunks: ReturnType<typeof import('../../features/diff/diffFormatted').diffFormatted>) => void;

  // Syntax errors
  clearErrorMarks: () => void;
  showErrorMark: (editor: any, pos: ErrorPosition) => void;
  setEditorSyntaxMode: (lang: 'json' | 'sql' | 'text') => void;

  // Search UI (replace dismiss on leaving diff)
  closeEditorSearchUi: (cm: any) => void;

  // Chrome helpers shared across workspaces
  setJsonToolsVisible: (visible: boolean) => void;
  applyLanguageChrome: (
    targetFormat: Exclude<DetectedLanguage, 'unknown'>,
    jsonTools: boolean
  ) => ReturnType<typeof import('../../features/registry').getFormatter>;
  hideLanguageChrome: () => void;

  // Workspace operations (filled by factories)
  runFormatting: () => void;
  runDecode: () => void;
  scheduleDecode: () => void;
  runDiff: (options?: { prettyPrint?: boolean }) => void;
  scheduleWorkspace: (options?: { prettyPrintDiff?: boolean }) => void;
  runWorkspace: (options?: { prettyPrintDiff?: boolean }) => void;
  runWorkspaceNow: () => void;
  flushWorkspaceTimers: () => void;
  applyShellChrome: () => void;
  setShell: (next: Shell) => void;
  updateWatermarkCopy: () => void;

  // Persistence helpers used by shell / pending
  persistDiffBNow: () => void;
  loadDiffBState: () => SavedInputState | null;
}
