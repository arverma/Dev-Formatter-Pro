import { detectLanguage, type DetectedLanguage } from '../../../core/detectLanguage';
import { getFormatter } from '../../../features/registry';
import { diffFormatted } from '../../../features/diff/diffFormatted';
import { isOverWorkBudget } from '../persistence';
import type { PanelContext } from '../context';

export function bindDiffWorkspace(ctx: PanelContext) {
  function setValuePreserveCursor(editor: any, value: string) {
    if (editor.getValue() === value) return;
    const cursor = editor.getCursor();
    const scroll = editor.getScrollInfo();
    ctx.ignoreEditorChange = true;
    editor.setValue(value);
    ctx.ignoreEditorChange = false;
    try {
      editor.setCursor(cursor);
    } catch {
      // shorter document
    }
    editor.scrollTo(scroll.left, scroll.top);
  }

  function languageForPane(raw: string, trim: string): DetectedLanguage {
    if (ctx.currentMode !== 'auto') return ctx.currentMode;
    if (!trim) return 'unknown';
    return detectLanguage(raw);
  }

  function resolveDiffLanguage(
    rawA: string,
    rawB: string,
    trimA: string,
    trimB: string
  ): DetectedLanguage {
    if (ctx.currentMode !== 'auto') return ctx.currentMode;
    const a = languageForPane(rawA, trimA);
    if (a !== 'unknown') return a;
    return languageForPane(rawB, trimB);
  }

  function prettyPrintIfValid(
    editor: any,
    raw: string,
    target: Exclude<DetectedLanguage, 'unknown'>
  ) {
    const entry = getFormatter(target);
    const result = entry.format(raw, {
      dialect: ctx.currentDialect,
      jsonMinify: false,
    });
    if (!result.isError) {
      setValuePreserveCursor(editor, result.formatted);
    } else {
      editor.getWrapperElement().classList.add('error-output');
      if (result.errorPosition) {
        ctx.showErrorMark(editor, result.errorPosition);
      }
    }
  }

  function runDiff(options?: { prettyPrint?: boolean }) {
    const prettyPrint = options?.prettyPrint === true;
    const rawA = ctx.inputEditor.getValue();
    const rawB = ctx.outputEditor.getValue();
    const trimA = rawA.trim();
    const trimB = rawB.trim();

    ctx.inputWatermark.classList.toggle('hidden', trimA.length > 0);
    ctx.outputWatermark.classList.toggle('hidden', trimB.length > 0);
    ctx.inputEditor.getWrapperElement().classList.remove('error-output');
    ctx.outputEditor.getWrapperElement().classList.remove('error-output');
    ctx.clearErrorMarks();
    ctx.clearDiffMarks();
    ctx.setJsonToolsVisible(false);

    if (!trimA && !trimB) {
      ctx.hideLanguageChrome();
      ctx.detectedHint.textContent = '';
      ctx.setEditorSyntaxMode('text');
      return;
    }

    if (isOverWorkBudget(rawA) || isOverWorkBudget(rawB)) {
      ctx.hideLanguageChrome();
      ctx.detectedHint.textContent = 'Input too large';
      ctx.setEditorSyntaxMode('text');
      return;
    }

    const langA = languageForPane(rawA, trimA);
    const langB = languageForPane(rawB, trimB);
    const targetFormat = resolveDiffLanguage(rawA, rawB, trimA, trimB);
    if (targetFormat === 'unknown') {
      ctx.setEditorSyntaxMode('text');
      ctx.hideLanguageChrome();
      ctx.detectedHint.textContent = 'Paste JSON or SQL';
      return;
    }

    const entry = ctx.applyLanguageChrome(targetFormat, false);
    ctx.detectedHint.textContent =
      ctx.currentMode === 'auto' ? `Diff ${entry.label}` : 'Diff';

    if (prettyPrint) {
      if (trimA && (ctx.currentMode !== 'auto' || langA !== 'unknown')) {
        prettyPrintIfValid(
          ctx.inputEditor,
          rawA,
          langA !== 'unknown' ? langA : targetFormat
        );
      }
      if (trimB && (ctx.currentMode !== 'auto' || langB !== 'unknown')) {
        prettyPrintIfValid(
          ctx.outputEditor,
          rawB,
          langB !== 'unknown' ? langB : targetFormat
        );
      }
    }

    const textA = ctx.inputEditor.getValue();
    const textB = ctx.outputEditor.getValue();
    if (!textA.trim() || !textB.trim()) return;

    const opts = { dialect: ctx.currentDialect, jsonMinify: false };
    const resultA = entry.format(textA, opts);
    const resultB = entry.format(textB, opts);

    if (resultA.isError) {
      ctx.inputEditor.getWrapperElement().classList.add('error-output');
      if (resultA.errorPosition) {
        ctx.showErrorMark(ctx.inputEditor, resultA.errorPosition);
      }
    }
    if (resultB.isError) {
      ctx.outputEditor.getWrapperElement().classList.add('error-output');
      if (!resultA.isError && resultB.errorPosition) {
        ctx.showErrorMark(ctx.outputEditor, resultB.errorPosition);
      }
    }
    if (resultA.isError || resultB.isError) return;

    // Marks only when editor text already matches formatted output (aligned line numbers)
    if (textA === resultA.formatted && textB === resultB.formatted) {
      ctx.applyDiffMarks(diffFormatted(resultA.formatted, resultB.formatted));
      if (ctx.currentMode === 'auto') {
        ctx.detectedHint.textContent = `Diff ${entry.label}`;
      } else {
        ctx.detectedHint.textContent = 'Diff';
      }
    } else {
      ctx.clearDiffMarks();
      ctx.detectedHint.textContent =
        ctx.currentMode === 'auto'
          ? `Diff ${entry.label} (unformatted)`
          : 'Diff (unformatted)';
    }
  }

  ctx.runDiff = runDiff;
}
