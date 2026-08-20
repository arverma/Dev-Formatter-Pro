import { getCodeMirror } from './codemirror-global';
import { FIND_DOC_MAX_CHARS, FIND_QUERY_MAX_CHARS } from '../persistence';

interface SearchReplaceApi {
  searchExtraKeys: Record<string, string | ((cm: any) => void)>;
  closeAllSearchUi: () => void;
  closeEditorSearchUi: (cm: any) => void;
  runFind: (cm: any) => void;
  runReplace: (cm: any) => void;
  /** Register editors after CodeMirror instances exist (enables dismiss + Cmd-R). */
  attachToEditors: (inputEditor: any, outputEditor: any) => void;
}

/**
 * Create find/replace controller. Call before constructing editors so
 * `searchExtraKeys` can be passed into CodeMirror options; then
 * `attachToEditors` after both editors exist.
 */
export function createSearchReplaceController(): SearchReplaceApi {
  const CodeMirror = getCodeMirror();
  function isEditorWritable(cm: { getOption: (key: string) => unknown }) {
    const ro = cm.getOption('readOnly');
    return ro !== true && ro !== 'nocursor';
  }
  
  function parseFindQuery(raw: string): string | RegExp | null {
    const trimmed = raw;
    if (!trimmed) return null;
    if (trimmed.length > FIND_QUERY_MAX_CHARS) {
      // Oversized queries: plain string search on a truncated prefix (no regex)
      return trimmed.slice(0, FIND_QUERY_MAX_CHARS);
    }
    const isRE = trimmed.match(/^\/(.*)\/([a-z]*)$/);
    if (isRE) {
      try {
        return new RegExp(isRE[1], isRE[2].includes('i') ? 'i' : '');
      } catch {
        /* fall through to string search */
      }
    }
    const parsed = trimmed.replace(/\\([nrt\\])/g, (_m, ch: string) => {
      if (ch === 'n') return '\n';
      if (ch === 'r') return '\r';
      if (ch === 't') return '\t';
      if (ch === '\\') return '\\';
      return `\\${ch}`;
    });
    if (!parsed) return null;
    return parsed;
  }
  
  function countFindMatches(cm: any, queryText: string): {
    total: number;
    current: number;
  } {
    if (cm.getValue().length > FIND_DOC_MAX_CHARS) {
      return { total: 0, current: 0 };
    }
    const query = parseFindQuery(queryText);
    if (query == null) return { total: 0, current: 0 };
    if (typeof query !== 'string' && query.test('')) return { total: 0, current: 0 };
  
    const caseFold = typeof query === 'string' && query === query.toLowerCase();
    const cursor = cm.getSearchCursor(query, CodeMirror.Pos(cm.firstLine(), 0), {
      caseFold,
      multiline: true,
    });
    const from = cm.getCursor('from');
    const to = cm.getCursor('to');
    let total = 0;
    let current = 0;
    while (cursor.findNext()) {
      total += 1;
      const cFrom = cursor.from();
      const cTo = cursor.to();
      if (
        cFrom.line === from.line &&
        cFrom.ch === from.ch &&
        cTo.line === to.line &&
        cTo.ch === to.ch
      ) {
        current = total;
      }
      if (total >= 9999) break;
    }
    return { total, current };
  }
  
  function formatMatchCount(total: number, current: number): string {
    if (total <= 0) return '0';
    if (current > 0) return `${current}/${total}`;
    return String(total);
  }
  
  const findHintTimers = new WeakMap<object, number>();
  
  function updateFindMatchHint(cm: any, hint: HTMLElement, queryText: string) {
    if (!queryText) {
      hint.textContent = '';
      return;
    }
    if (cm.getValue().length > FIND_DOC_MAX_CHARS) {
      hint.textContent = '—';
      return;
    }
    const { total, current } = countFindMatches(cm, queryText);
    hint.textContent = formatMatchCount(total, current);
  }
  
  function scheduleFindMatchHint(cm: any, hint: HTMLElement, queryText: string) {
    const prev = findHintTimers.get(cm);
    if (prev != null) clearTimeout(prev);
    const id = window.setTimeout(() => {
      findHintTimers.delete(cm);
      updateFindMatchHint(cm, hint, queryText);
    }, 120);
    findHintTimers.set(cm, id);
  }
  
  function svgIcon(paths: string[], className: string): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add(className);
    for (const d of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('clip-rule', 'evenodd');
      svg.appendChild(path);
    }
    return svg;
  }
  
  function iconButton(
    label: string,
    paths: string[],
    className: string
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cm-search-icon-btn ${className}`;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.appendChild(svgIcon(paths, 'cm-search-icon'));
    return btn;
  }
  
  // Codicon paths (VS Code find widget)
  const ICON_SEARCH = [
    'M10.0195 10.7266C9.06578 11.5217 7.83875 12 6.5 12C3.46243 12 1 9.53757 1 6.5C1 3.46243 3.46243 1 6.5 1C9.53757 1 12 3.46243 12 6.5C12 7.83875 11.5217 9.06578 10.7266 10.0195L13.8535 13.1464C14.0488 13.3417 14.0488 13.6583 13.8535 13.8536C13.6583 14.0488 13.3417 14.0488 13.1464 13.8536L10.0195 10.7266ZM11 6.5C11 4.01472 8.98528 2 6.5 2C4.01472 2 2 4.01472 2 6.5C2 8.98528 4.01472 11 6.5 11C8.98528 11 11 8.98528 11 6.5Z',
  ];
  const ICON_REPLACE = [
    'M10 2.813C10.295 2.619 10.634 2.5 11 2.5C12.103 2.5 13 3.509 13 4.75C13 5.991 12.103 7 11 7C10.62 7 10.269 6.873 9.966 6.666C9.897 6.86 9.717 7 9.5 7C9.224 7 9 6.776 9 6.5V1.5C9 1.224 9.224 1 9.5 1C9.776 1 10 1.224 10 1.5V2.813ZM10 4.75C10 5.439 10.448 6 11 6C11.552 6 12 5.439 12 4.75C12 4.061 11.552 3.5 11 3.5C10.448 3.5 10 4.061 10 4.75Z',
    'M2 9H7C7.552 9 8 9.448 8 10V15C8 15.552 7.552 16 7 16H2C1.448 16 1 15.552 1 15V10C1 9.448 1.448 9 2 9ZM5.039 13.645C4.81 13.849 4.199 13.968 3.83 13.506C3.617 13.24 3.5 12.88 3.5 12.492C3.5 12.104 3.618 11.744 3.83 11.478C4.201 11.014 4.811 11.133 5.04 11.339C5.244 11.525 5.56 11.507 5.746 11.303C5.931 11.098 5.915 10.782 5.709 10.597C4.922 9.887 3.733 10.001 3.049 10.853C2.695 11.297 2.5 11.878 2.5 12.492C2.5 13.106 2.695 13.688 3.049 14.131C3.43 14.605 3.945 14.867 4.5 14.867C4.941 14.867 5.359 14.701 5.708 14.387C5.913 14.202 5.93 13.886 5.745 13.681C5.559 13.476 5.243 13.458 5.039 13.645Z',
    'M3.99998 4.5C3.99998 3.673 4.67298 3 5.49998 3H7.50198C7.77798 3 8.00198 3.224 8.00198 3.5C8.00198 3.776 7.77798 4 7.50198 4H5.50198C5.22598 4 5.00198 4.225 5.00198 4.5V6.293L6.14798 5.147C6.34298 4.952 6.65998 4.952 6.85498 5.147C7.04998 5.342 7.04998 5.659 6.85498 5.854L4.85498 7.854C4.75698 7.951 4.62898 8 4.50098 8C4.37298 8 4.24498 7.952 4.14698 7.854L2.14698 5.854C1.95198 5.659 1.95198 5.342 2.14698 5.147C2.34198 4.952 2.65898 4.952 2.85398 5.147L3.99998 6.293V4.5Z',
  ];
  const ICON_REPLACE_ALL = [
    'M14 13V10C14 8.35 12.65 7 11 7H5.12L4.12 8H11C12.1 8 13 8.9 13 10V14C13.55 14 14 13.55 14 13Z',
    'M10.999 5.5V2.75C10.999 1.765 10.12 1.25 9.25 1.25C8.362 1.25 7.989 1.553 7.896 1.646C7.701 1.841 7.687 2.17 7.882 2.365C8.076 2.561 8.379 2.573 8.575 2.378C8.57462 2.37825 8.57506 2.37797 8.575 2.378C8.58734 2.36997 8.77165 2.25 9.249 2.25C9.279 2.25 9.999 2.256 9.999 2.75V3.056C9.795 3.023 9.551 3 9.249 3C7.936 3 7.249 3.754 7.249 4.5C7.249 5.246 7.936 6 9.249 6C9.621 6 9.91 5.937 10.144 5.851C10.235 5.943 10.36 6 10.499 6C10.775 6 10.999 5.776 10.999 5.5ZM9.25 4C9.622 4 9.856 4.038 10 4.074V4.811C9.907 4.885 9.697 5 9.25 5C8.601 5 8.25 4.742 8.25 4.5C8.25 4.258 8.601 4 9.25 4Z',
    'M5.001 13.074C4.857 13.038 4.623 13 4.251 13C3.602 13 3.251 13.258 3.251 13.5C3.251 13.742 3.602 14 4.251 14C4.698 14 4.908 13.885 5.001 13.811V13.074Z',
    'M12 15V10C12 9.448 11.552 9 11 9H2C1.448 9 1 9.448 1 10V15C1 15.552 1.448 16 2 16H11C11.552 16 12 15.552 12 15ZM4.251 10.25C5.121 10.25 6 10.765 6 11.75V14.5C6 14.776 5.776 15 5.5 15C5.361 15 5.236 14.943 5.145 14.851C4.911 14.937 4.622 15 4.25 15C2.937 15 2.25 14.246 2.25 13.5C2.25 12.754 2.937 12 4.25 12C4.552 12 4.796 12.023 5 12.056V11.75C5 11.256 4.28 11.25 4.25 11.25C3.78749 11.25 3.6007 11.3631 3.57831 11.3767C3.57688 11.3775 3.57612 11.378 3.576 11.378C3.38 11.573 3.077 11.561 2.883 11.365C2.688 11.17 2.702 10.841 2.897 10.646C2.99 10.553 3.363 10.25 4.251 10.25ZM8.33 11.611C8.117 11.877 8 12.237 8 12.625C8 13.013 8.117 13.373 8.33 13.639C8.699 14.101 9.31 13.982 9.539 13.778C9.743 13.591 10.059 13.609 10.245 13.814C10.43 14.019 10.414 14.335 10.208 14.52C9.86 14.834 9.442 15 9 15C8.445 15 7.929 14.739 7.549 14.264C7.195 13.82 7 13.239 7 12.625C7 12.011 7.195 11.429 7.549 10.986C8.233 10.134 9.422 10.02 10.209 10.73C10.414 10.915 10.431 11.231 10.246 11.436C10.06 11.64 9.744 11.658 9.54 11.472C9.311 11.266 8.701 11.147 8.33 11.611Z',
    'M14 6C15.103 6 16 4.991 16 3.75C16 2.509 15.103 1.5 14 1.5C13.634 1.5 13.295 1.619 13 1.813V0.5C13 0.224 12.776 0 12.5 0C12.224 0 12 0.224 12 0.5V5.5C12 5.776 12.224 6 12.5 6C12.717 6 12.897 5.86 12.966 5.666C13.269 5.873 13.62 6 14 6ZM14 2.5C14.552 2.5 15 3.061 15 3.75C15 4.439 14.552 5 14 5C13.448 5 13 4.439 13 3.75C13 3.061 13.448 2.5 14 2.5Z',
    'M1.99998 4.5C1.99998 3.673 2.67298 3 3.49998 3H5.50198C5.77798 3 6.00198 3.224 6.00198 3.5C6.00198 3.776 5.77798 4 5.50198 4H3.50198C3.22598 4 3.00198 4.225 3.00198 4.5V6.293L4.14798 5.147C4.34298 4.952 4.65998 4.952 4.85498 5.147C5.04998 5.342 5.04998 5.659 4.85498 5.854L2.85498 7.854C2.75698 7.951 2.62898 8 2.50098 8C2.37298 8 2.24498 7.952 2.14698 7.854L0.146982 5.854C-0.0480176 5.659 -0.0480176 5.342 0.146982 5.147C0.341982 4.952 0.658982 4.952 0.853982 5.147L1.99998 6.293V4.5Z',
  ];
  const ICON_CHEVRON_DOWN = [
    'M7.99999 10.9999C7.87199 10.9999 7.74499 10.9509 7.64699 10.8539L3.64699 6.85386C3.45199 6.65886 3.45199 6.34186 3.64699 6.14686C3.84199 5.95186 4.15899 5.95186 4.35399 6.14686L7.99999 9.79286L11.647 6.14686C11.842 5.95186 12.159 5.95186 12.354 6.14686C12.549 6.34186 12.549 6.65886 12.354 6.85386L8.35399 10.8539C8.25599 10.9509 8.12799 10.9999 7.99999 10.9999Z',
  ];
  const ICON_CHEVRON_UP = [
    'M7.99999 5.00014C8.12799 5.00014 8.25499 5.04914 8.35299 5.14614L12.353 9.14614C12.548 9.34114 12.548 9.65814 12.353 9.85314C12.158 10.0481 11.841 10.0481 11.646 9.85314L7.99999 6.20714L4.35299 9.85314C4.15799 10.0481 3.84099 10.0481 3.64599 9.85314C3.45099 9.65814 3.45099 9.34114 3.64599 9.14614L7.64599 5.14614C7.74399 5.04914 7.87199 5.00014 7.99999 5.00014Z',
  ];
  
  function attachFindMatchCounter(cm: any) {
    const wrap = cm.getWrapperElement() as HTMLElement;
    const dialog = wrap.querySelector('.CodeMirror-dialog');
    if (!(dialog instanceof HTMLElement)) return;
  
    const hint = dialog.querySelector('.CodeMirror-search-hint');
    const field = dialog.querySelector('.CodeMirror-search-field');
    if (!(hint instanceof HTMLElement) || !(field instanceof HTMLInputElement)) return;
  
    // VS Code-style: icon + placeholder. The find input lives INSIDE the label —
    // never clear label.textContent or the field is destroyed.
    const label = dialog.querySelector('.CodeMirror-search-label');
    if (label instanceof HTMLElement) {
      Array.from(label.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
      });
      label.classList.add('cm-find-label');
      if (!label.querySelector(':scope > svg.cm-search-icon')) {
        label.insertBefore(svgIcon(ICON_SEARCH, 'cm-search-icon'), label.firstChild);
      }
    }
    if (!field.placeholder) field.placeholder = 'Find';
  
    if (hint.dataset.matchCounter === '1') {
      scheduleFindMatchHint(cm, hint, field.value);
      return;
    }
  
    hint.dataset.matchCounter = '1';
    hint.removeAttribute('style');
    hint.classList.add('CodeMirror-search-count');
    hint.textContent = '';
  
    const refreshSoon = () => scheduleFindMatchHint(cm, hint, field.value);
    const refreshNow = () => updateFindMatchHint(cm, hint, field.value);
    field.addEventListener('input', refreshSoon);
    field.addEventListener('keyup', refreshSoon);
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // Find navigation updates selection after the default handler.
        requestAnimationFrame(refreshNow);
      }
    });
    cm.on('cursorActivity', refreshSoon);
  
    const observer = new MutationObserver(() => {
      if (!wrap.contains(dialog)) {
        observer.disconnect();
        cm.off('cursorActivity', refreshSoon);
      }
    });
    observer.observe(wrap, { childList: true });
  
    refreshNow();
  }
  
  const searchDialogClosers = new WeakMap<object, () => void>();
  const searchEditors: any[] = [];
  
  function closeEditorSearchUi(cm: any) {
    const tracked = searchDialogClosers.get(cm);
    if (tracked) {
      searchDialogClosers.delete(cm);
      try {
        tracked();
      } catch {
        /* ignore */
      }
    }
    const wrap = cm.getWrapperElement() as HTMLElement | undefined;
    if (!wrap) return;
    wrap.querySelectorAll('.CodeMirror-dialog').forEach((el) => el.remove());
    CodeMirror.rmClass(wrap, 'dialog-opened');
    clearDevSearchOverlay(cm);
    try {
      CodeMirror.commands.clearSearch(cm);
    } catch {
      /* ignore */
    }
  }
  
  function closeAllSearchUi() {
    for (const ed of searchEditors) closeEditorSearchUi(ed);
  }
  
  function registerSearchDialogCloser(cm: any, close: () => void) {
    searchDialogClosers.set(cm, () => {
      searchDialogClosers.delete(cm);
      close();
    });
  }
  
  function runFind(cm: any) {
    // Only one search UI at a time — close find/replace first to avoid stacking.
    closeAllSearchUi();
    CodeMirror.commands.findPersistent(cm);
    requestAnimationFrame(() => {
      attachFindMatchCounter(cm);
      registerSearchDialogCloser(cm, () => {
        const wrap = cm.getWrapperElement() as HTMLElement;
        wrap.querySelectorAll('.CodeMirror-dialog').forEach((el) => el.remove());
        CodeMirror.rmClass(wrap, 'dialog-opened');
        try {
          CodeMirror.commands.clearSearch(cm);
        } catch {
          /* ignore */
        }
        clearDevSearchOverlay(cm);
        cm.focus();
      });
    });
  }
  
  function clearDevSearchOverlay(cm: any) {
    if (cm.state?.devSearchOverlay) {
      cm.removeOverlay(cm.state.devSearchOverlay);
      cm.state.devSearchOverlay = null;
    }
  }
  
  function setDevSearchOverlay(cm: any, queryText: string) {
    clearDevSearchOverlay(cm);
    if (cm.getValue().length > FIND_DOC_MAX_CHARS) return;
    const query = parseFindQuery(queryText);
    if (query == null) return;
    if (typeof query !== 'string' && query.test('')) return;
  
    const caseInsensitive =
      typeof query === 'string' && query === query.toLowerCase();
    let re: RegExp;
    if (typeof query === 'string') {
      re = new RegExp(
        query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'),
        caseInsensitive ? 'gi' : 'g'
      );
    } else {
      re = new RegExp(query.source, query.ignoreCase ? 'gi' : 'g');
    }
  
    const overlay = {
      token(stream: {
        pos: number;
        string: string;
        skipToEnd: () => void;
      }) {
        re.lastIndex = stream.pos;
        const match = re.exec(stream.string);
        if (match && match.index === stream.pos) {
          stream.pos += match[0].length || 1;
          return 'searching';
        }
        if (match) {
          stream.pos = match.index;
        } else {
          stream.skipToEnd();
        }
        return undefined;
      },
    };
    cm.state.devSearchOverlay = overlay;
    cm.addOverlay(overlay);
  }
  
  function parseReplaceText(raw: string): string {
    return raw.replace(/\\([nrt\\])/g, (_m, ch: string) => {
      if (ch === 'n') return '\n';
      if (ch === 'r') return '\r';
      if (ch === 't') return '\t';
      if (ch === '\\') return '\\';
      return `\\${ch}`;
    });
  }
  
  function findNextMatch(cm: any, queryText: string, reverse = false): boolean {
    const query = parseFindQuery(queryText);
    if (query == null) return false;
    if (typeof query !== 'string' && query.test('')) return false;
  
    const caseFold = typeof query === 'string' && query === query.toLowerCase();
    const start = reverse ? cm.getCursor('from') : cm.getCursor('to');
    let cursor = cm.getSearchCursor(query, start, { caseFold, multiline: true });
    if (!cursor.find(reverse)) {
      cursor = cm.getSearchCursor(
        query,
        reverse
          ? CodeMirror.Pos(cm.lastLine())
          : CodeMirror.Pos(cm.firstLine(), 0),
        { caseFold, multiline: true }
      );
      if (!cursor.find(reverse)) return false;
    }
    cm.setSelection(cursor.from(), cursor.to());
    cm.scrollIntoView({ from: cursor.from(), to: cursor.to() }, 20);
    return true;
  }
  
  function replaceCurrentMatch(cm: any, queryText: string, replaceRaw: string): boolean {
    const query = parseFindQuery(queryText);
    if (query == null) return false;
    if (typeof query !== 'string' && query.test('')) return false;
  
    const caseFold = typeof query === 'string' && query === query.toLowerCase();
    const replaceText = parseReplaceText(replaceRaw);
    const from = cm.getCursor('from');
    const cursor = cm.getSearchCursor(query, from, { caseFold, multiline: true });
    if (!cursor.findNext()) return false;
    if (
      cursor.from().line !== from.line ||
      cursor.from().ch !== from.ch
    ) {
      // Selection is not on a match — jump to next instead of replacing.
      cm.setSelection(cursor.from(), cursor.to());
      cm.scrollIntoView({ from: cursor.from(), to: cursor.to() }, 20);
      return false;
    }
  
    if (typeof query !== 'string') {
      const match = cm.getRange(cursor.from(), cursor.to()).match(query);
      cursor.replace(
        replaceText.replace(/\$(\d)/g, (_m: string, i: string) =>
          match ? match[Number(i)] ?? '' : ''
        )
      );
    } else {
      cursor.replace(replaceText);
    }
    return true;
  }
  
  function replaceAllMatches(cm: any, queryText: string, replaceRaw: string): number {
    const query = parseFindQuery(queryText);
    if (query == null) return 0;
    if (typeof query !== 'string' && query.test('')) return 0;
  
    const caseFold = typeof query === 'string' && query === query.toLowerCase();
    const replaceText = parseReplaceText(replaceRaw);
    let count = 0;
    cm.operation(() => {
      const cursor = cm.getSearchCursor(query, CodeMirror.Pos(cm.firstLine(), 0), {
        caseFold,
        multiline: true,
      });
      while (cursor.findNext()) {
        if (typeof query !== 'string') {
          const match = cm.getRange(cursor.from(), cursor.to()).match(query);
          cursor.replace(
            replaceText.replace(/\$(\d)/g, (_m: string, i: string) =>
              match ? match[Number(i)] ?? '' : ''
            )
          );
        } else {
          cursor.replace(replaceText);
        }
        count += 1;
      }
    });
    return count;
  }
  
  function openReplacePanel(cm: any) {
    if (!isEditorWritable(cm)) return;
  
    // Only one search UI at a time — close find/replace first to avoid stacking.
    closeAllSearchUi();
  
    const root = document.createElement('div');
    root.className = 'cm-replace-panel';
  
    const findRow = document.createElement('div');
    findRow.className = 'cm-replace-row';
    const findIcon = document.createElement('span');
    findIcon.className = 'cm-replace-leading-icon';
    findIcon.appendChild(svgIcon(ICON_SEARCH, 'cm-search-icon'));
    const findInput = document.createElement('input');
    findInput.type = 'text';
    findInput.className = 'CodeMirror-search-field';
    findInput.placeholder = 'Find';
    findInput.setAttribute('aria-label', 'Find');
    const countEl = document.createElement('span');
    countEl.className = 'CodeMirror-search-count';
    const findPrevBtn = iconButton('Previous match', ICON_CHEVRON_UP, 'cm-find-prev');
    const findNextBtn = iconButton('Next match', ICON_CHEVRON_DOWN, 'cm-find-next');
    findRow.append(findIcon, findInput, countEl, findPrevBtn, findNextBtn);
  
    const replaceRow = document.createElement('div');
    replaceRow.className = 'cm-replace-row';
    const replaceIcon = document.createElement('span');
    replaceIcon.className = 'cm-replace-leading-icon';
    replaceIcon.appendChild(svgIcon(ICON_REPLACE, 'cm-search-icon'));
    const replaceInput = document.createElement('input');
    replaceInput.type = 'text';
    replaceInput.className = 'CodeMirror-search-field';
    replaceInput.placeholder = 'Replace';
    replaceInput.setAttribute('aria-label', 'Replace');
    const actions = document.createElement('div');
    actions.className = 'cm-replace-actions';
    const replaceBtn = iconButton('Replace', ICON_REPLACE, 'cm-replace-one');
    const replaceAllBtn = iconButton('Replace all', ICON_REPLACE_ALL, 'cm-replace-all');
    actions.append(replaceBtn, replaceAllBtn);
    replaceRow.append(replaceIcon, replaceInput, actions);
  
    root.append(findRow, replaceRow);
  
    const seed = cm.getSelection() || '';
    if (seed && !seed.includes('\n')) findInput.value = seed;
  
    const refreshCount = () => {
      updateFindMatchHint(cm, countEl, findInput.value);
    };
  
    const syncHighlight = () => {
      setDevSearchOverlay(cm, findInput.value);
      refreshCount();
    };
  
    const doFindNext = (reverse = false) => {
      if (!findInput.value) return;
      setDevSearchOverlay(cm, findInput.value);
      findNextMatch(cm, findInput.value, reverse);
      refreshCount();
    };
  
    const doReplace = () => {
      if (!findInput.value) return;
      if (replaceCurrentMatch(cm, findInput.value, replaceInput.value)) {
        setDevSearchOverlay(cm, findInput.value);
        findNextMatch(cm, findInput.value, false);
      }
      refreshCount();
    };
  
    const doReplaceAll = () => {
      if (!findInput.value) return;
      replaceAllMatches(cm, findInput.value, replaceInput.value);
      setDevSearchOverlay(cm, findInput.value);
      refreshCount();
    };
  
    findInput.addEventListener('input', syncHighlight);
    findPrevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doFindNext(true);
    });
    findNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doFindNext(false);
    });
    replaceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doReplace();
    });
    replaceAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doReplaceAll();
    });
  
    let closeDialog: (() => void) | null = null;
  
    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey) doReplaceAll();
        else doReplace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeEditorSearchUi(cm);
      }
    });
  
    closeDialog = cm.openDialog(root, () => {}, {
      closeOnEnter: false,
      closeOnBlur: false,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.keyCode === 27) {
          closeEditorSearchUi(cm);
          return true;
        }
        if (e.keyCode === 13) {
          CodeMirror.e_stop(e);
          doFindNext(e.shiftKey);
          return true;
        }
        return false;
      },
      onClose: () => {
        searchDialogClosers.delete(cm);
        clearDevSearchOverlay(cm);
        cm.off('cursorActivity', refreshCount);
      },
    });
  
    registerSearchDialogCloser(cm, () => {
      closeDialog?.();
    });
  
    findInput.focus();
    findInput.select();
    cm.on('cursorActivity', refreshCount);
    syncHighlight();
    if (findInput.value) doFindNext(false);
  }
  
  function runReplace(cm: any) {
    if (!isEditorWritable(cm)) return;
    openReplacePanel(cm);
  }
  
  const searchExtraKeys = {
    'Ctrl-F': runFind,
    'Cmd-F': runFind,
    'Ctrl-G': 'findPersistentNext',
    'Cmd-G': 'findPersistentNext',
    'Shift-Ctrl-G': 'findPersistentPrev',
    'Shift-Cmd-G': 'findPersistentPrev',
    'Ctrl-R': runReplace,
    'Cmd-R': runReplace,
  };

  function attachToEditors(inputEditor: any, outputEditor: any) {
    searchEditors.push(inputEditor, outputEditor);

    document.addEventListener(
      'mousedown',
      (e) => {
        const t = e.target as Node;
        for (const ed of searchEditors) {
          const wrap = ed.getWrapperElement() as HTMLElement;
          const dialog = wrap.querySelector('.CodeMirror-dialog');
          if (!(dialog instanceof HTMLElement)) continue;
          if (dialog.contains(t)) continue;
          closeEditorSearchUi(ed);
        }
      },
      true
    );
    
    // Cmd/Ctrl+R reloads the side panel in Chrome; intercept only while an editor
    // (or its search dialog) owns focus, matching ConTextEditor.
    window.addEventListener(
      'keydown',
      (e) => {
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'r' || e.altKey || e.shiftKey) {
          return;
        }
        const active = document.activeElement;
        const inputWrap = inputEditor.getWrapperElement();
        const outputWrap = outputEditor.getWrapperElement();
        const inInput =
          inputEditor.hasFocus() ||
          (active instanceof Node && inputWrap.contains(active));
        const inOutput =
          outputEditor.hasFocus() ||
          (active instanceof Node && outputWrap.contains(active));
        if (!inInput && !inOutput) return;
    
        e.preventDefault();
        e.stopPropagation();
        const target =
          active instanceof Node && outputWrap.contains(active)
            ? outputEditor
            : active instanceof Node && inputWrap.contains(active)
              ? inputEditor
              : outputEditor.hasFocus()
                ? outputEditor
                : inputEditor;
        runReplace(target);
      },
      true
    );
  }

  return {
    searchExtraKeys,
    closeAllSearchUi,
    closeEditorSearchUi,
    runFind,
    runReplace,
    attachToEditors,
  };
}
