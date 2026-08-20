import { getCodeMirror } from './codemirror-global';

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

interface CreateEditorsOpts {
  inputEditorEl: HTMLElement;
  outputEditorEl: HTMLElement;
  theme: string;
  inputValue: string;
  outputValue: string;
  outputReadOnly: boolean;
  searchExtraKeys: Record<string, string | ((cm: any) => void)>;
}

export function createPanelEditors(opts: CreateEditorsOpts) {
  const CodeMirror = getCodeMirror();
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
    extraKeys: opts.searchExtraKeys,
    phrases: {
      '(Use /re/ syntax for regexp search)': '',
      'Search:': '',
    },
  };

  const inputEditor = CodeMirror(opts.inputEditorEl, {
    ...baseOptions,
    mode: { name: 'javascript', json: true },
    autofocus: true,
    theme: opts.theme,
    value: opts.inputValue,
  });

  const outputEditor = CodeMirror(opts.outputEditorEl, {
    ...baseOptions,
    mode: { name: 'javascript', json: true },
    readOnly: opts.outputReadOnly,
    theme: opts.theme,
    value: opts.outputValue,
  });

  inputEditor.refresh();
  outputEditor.refresh();

  return { inputEditor, outputEditor, baseOptions };
}
