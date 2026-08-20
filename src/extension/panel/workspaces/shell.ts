import { SHELL_KEY, WORKSPACE_KEY, loadDiffBState } from '../persistence';
import type { PanelContext, Shell } from '../context';

const FORMAT_INPUT_WM = 'Paste or type JSON or SQL…';
const DECODE_INPUT_WM = 'Paste Base64, URL, Unicode, or JWT…';
const ENCODE_INPUT_WM = 'Paste text to encode as Base64…';
const DIFF_A_WM = 'Paste original JSON or SQL…';
const DIFF_B_WM = 'Paste modified JSON or SQL…';

const SHELL_LABELS: Record<Shell, string> = {
  formatter: 'Format',
  decode: 'Decode',
  encode: 'Encode',
  diff: 'Diff',
};

export function bindShellWorkspace(ctx: PanelContext) {
  function updateWatermarkCopy() {
    if (ctx.shell === 'decode') {
      ctx.inputWatermark.textContent = DECODE_INPUT_WM;
      ctx.outputWatermark.classList.add('hidden');
    } else if (ctx.shell === 'encode') {
      ctx.inputWatermark.textContent = ENCODE_INPUT_WM;
      ctx.outputWatermark.classList.add('hidden');
    } else if (ctx.workspace === 'diff') {
      ctx.inputWatermark.textContent = DIFF_A_WM;
      ctx.outputWatermark.textContent = DIFF_B_WM;
    } else {
      ctx.inputWatermark.textContent = FORMAT_INPUT_WM;
      ctx.outputWatermark.classList.add('hidden');
    }
  }

  function applyShellChrome() {
    ctx.formatterControls.hidden = ctx.shell !== 'formatter' && ctx.shell !== 'diff';
    ctx.decodeControls.hidden = ctx.shell !== 'decode';
    ctx.encodeControls.hidden = ctx.shell !== 'encode';
    ctx.shellPickerLabel.textContent = SHELL_LABELS[ctx.shell];
    ctx.shellPickerMenu
      .querySelectorAll<HTMLButtonElement>('.shell-picker-option')
      .forEach((btn) => {
        btn.setAttribute(
          'aria-selected',
          btn.dataset.shell === ctx.shell ? 'true' : 'false'
        );
      });
    ctx.decodeKindButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.decode === ctx.decodeKind);
    });
    if (ctx.shell === 'diff') {
      ctx.outputEditor.setOption('readOnly', false);
    } else {
      ctx.outputEditor.setOption('readOnly', true);
      ctx.outputWatermark.classList.add('hidden');
      ctx.clearDiffMarks();
      // Replace is only valid on writable panes — dismiss if leaving Diff.
      ctx.closeEditorSearchUi(ctx.outputEditor);
    }
    updateWatermarkCopy();
  }

  function setShell(next: Shell) {
    if (next === ctx.shell) {
      ctx.runWorkspaceNow();
      return;
    }
    if (ctx.shell === 'diff') {
      ctx.persistDiffBNow();
    }
    ctx.shell = next;
    ctx.workspace = ctx.shell === 'diff' ? 'diff' : 'format';
    localStorage.setItem(SHELL_KEY, ctx.shell);
    localStorage.setItem(WORKSPACE_KEY, ctx.workspace);
    applyShellChrome();
    ctx.clearErrorMarks();
    if (ctx.workspaceRunTimer !== null) {
      clearTimeout(ctx.workspaceRunTimer);
      ctx.workspaceRunTimer = null;
    }
    if (ctx.shell === 'decode' || ctx.shell === 'encode') {
      ctx.ignoreEditorChange = true;
      ctx.outputEditor.setValue('');
      ctx.ignoreEditorChange = false;
      ctx.scheduleDecode();
    } else if (ctx.shell === 'diff') {
      const savedB = loadDiffBState();
      ctx.ignoreEditorChange = true;
      ctx.outputEditor.setValue(savedB?.value ?? '');
      ctx.ignoreEditorChange = false;
      ctx.runDiff({ prettyPrint: true });
    } else {
      ctx.outputWatermark.classList.add('hidden');
      ctx.runFormatting();
    }
  }

  ctx.updateWatermarkCopy = updateWatermarkCopy;
  ctx.applyShellChrome = applyShellChrome;
  ctx.setShell = setShell;
  ctx.loadDiffBState = loadDiffBState;
}
