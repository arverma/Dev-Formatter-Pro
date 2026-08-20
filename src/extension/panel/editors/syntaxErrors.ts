import type { ErrorPosition } from '../../../core/errorPosition';

interface SyntaxErrorController {
  clearErrorMarks: () => void;
  showErrorMark: (editor: any, pos: ErrorPosition) => void;
  setEditorSyntaxMode: (lang: 'json' | 'sql' | 'text') => void;
  getLastErrorPos: () => ErrorPosition | null;
  getErrorEditor: () => any | null;
}

export function createSyntaxErrorController(deps: {
  inputEditor: any;
  outputEditor: any;
  errorPill: HTMLButtonElement;
}): SyntaxErrorController {
  let errorMark: { clear: () => void } | null = null;
  let errorLine: number | null = null;
  let errorEditor: any | null = null;
  let lastErrorPos: ErrorPosition | null = null;

  function setEditorSyntaxMode(lang: 'json' | 'sql' | 'text') {
    if (lang === 'sql') {
      deps.inputEditor.setOption('mode', 'text/x-sql');
      deps.outputEditor.setOption('mode', 'text/x-sql');
    } else if (lang === 'json') {
      deps.inputEditor.setOption('mode', { name: 'javascript', json: true });
      deps.outputEditor.setOption('mode', { name: 'javascript', json: true });
    } else {
      deps.inputEditor.setOption('mode', 'text/plain');
      deps.outputEditor.setOption('mode', 'text/plain');
    }
  }

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
    deps.errorPill.hidden = true;
    deps.errorPill.textContent = '';
  }

  function showErrorMark(editor: any, pos: ErrorPosition) {
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
    deps.errorPill.hidden = false;
    deps.errorPill.textContent = `${pos.line + 1}:${pos.ch + 1}`;
    deps.errorPill.title = `Jump to parse error at ${pos.line + 1}:${pos.ch + 1}`;
  }

  return {
    clearErrorMarks,
    showErrorMark,
    setEditorSyntaxMode,
    getLastErrorPos: () => lastErrorPos,
    getErrorEditor: () => errorEditor,
  };
}
