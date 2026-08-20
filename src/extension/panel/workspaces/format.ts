import { detectLanguage, type DetectedLanguage } from '../../../core/detectLanguage';
import { buildErrorBanner } from '../../../core/errorBanner';
import { mismatchHint } from '../../../features/registry';
import { isOverWorkBudget } from '../persistence';
import type { PanelContext } from '../context';

export function bindFormatWorkspace(ctx: PanelContext) {
  function runFormatting() {
    const rawInput = ctx.inputEditor.getValue();
    const trimmed = rawInput.trim();

    ctx.outputWatermark.classList.add('hidden');
    if (trimmed.length > 0) {
      ctx.inputWatermark.classList.add('hidden');
    } else {
      ctx.inputWatermark.classList.remove('hidden');
    }

    if (!trimmed) {
      ctx.outputEditor.setValue('\u00a0');
      ctx.outputEditor.getWrapperElement().classList.remove('error-output');
      ctx.hideLanguageChrome();
      ctx.detectedHint.textContent = '';
      ctx.clearErrorMarks();
      return;
    }

    if (isOverWorkBudget(rawInput)) {
      ctx.hideLanguageChrome();
      ctx.clearErrorMarks();
      ctx.detectedHint.textContent = '';
      ctx.outputEditor.getWrapperElement().classList.add('error-output');
      ctx.outputEditor.setValue(
        buildErrorBanner({
          commentPrefix: '//',
          title: 'Input too large',
          hint: 'Trim the input below ~1.5M characters, then try again.',
          parserMessage: `Input is ${rawInput.length.toLocaleString()} characters`,
        })
      );
      ctx.setEditorSyntaxMode('text');
      return;
    }

    const targetFormat: DetectedLanguage =
      ctx.currentMode === 'auto' ? detectLanguage(rawInput) : ctx.currentMode;

    if (targetFormat === 'unknown') {
      ctx.setEditorSyntaxMode('text');
      ctx.hideLanguageChrome();
      ctx.detectedHint.textContent = 'Paste JSON or SQL';
      ctx.clearErrorMarks();
      ctx.outputEditor.setValue('// Paste valid JSON or SQL to format…');
      ctx.outputEditor.getWrapperElement().classList.remove('error-output');
      return;
    }

    const entry = ctx.applyLanguageChrome(targetFormat, true);
    ctx.detectedHint.textContent = ctx.currentMode === 'auto' ? entry.label : '';

    const result = entry.format(rawInput, {
      dialect: ctx.currentDialect,
      jsonMinify: ctx.jsonMinify,
    });
    if (result.isError) {
      ctx.outputEditor.getWrapperElement().classList.add('error-output');
      const detectedLang = detectLanguage(rawInput);
      const errorBanner = buildErrorBanner({
        commentPrefix: entry.commentPrefix,
        title: entry.errorTitle({ dialect: ctx.currentDialect }),
        hint: mismatchHint(entry, detectedLang),
        parserMessage: result.errorMessage || entry.parserFallback,
      });
      ctx.outputEditor.setValue(errorBanner + rawInput);
      if (result.errorPosition) {
        ctx.showErrorMark(ctx.inputEditor, result.errorPosition);
      } else {
        ctx.clearErrorMarks();
      }
    } else {
      ctx.outputEditor.setValue(result.formatted);
      ctx.outputEditor.getWrapperElement().classList.remove('error-output');
      ctx.clearErrorMarks();
    }
  }

  ctx.runFormatting = runFormatting;
}
