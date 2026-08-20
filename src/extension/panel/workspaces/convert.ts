import { buildErrorBanner } from '../../../core/errorBanner';
import { convertEpoch } from '../../../features/convert/epoch';
import { isOverWorkBudget } from '../persistence';
import type { PanelContext } from '../context';

export function bindConvertWorkspace(ctx: PanelContext) {
  function runConvert() {
    const rawInput = ctx.inputEditor.getValue();
    const trimmed = rawInput.trim();

    ctx.outputWatermark.classList.add('hidden');
    ctx.inputWatermark.classList.toggle('hidden', trimmed.length > 0);
    ctx.hideLanguageChrome();
    ctx.clearErrorMarks();
    ctx.outputEditor.getWrapperElement().classList.remove('error-output');

    ctx.jsonBadge.style.display = 'none';
    ctx.dialectWrapper.style.display = 'none';
    ctx.setJsonToolsVisible(false);
    ctx.decodeBadge.hidden = false;
    ctx.decodeBadge.textContent = 'Epoch';
    ctx.detectedHint.textContent = '';

    if (isOverWorkBudget(rawInput)) {
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

    const result = convertEpoch(rawInput, {
      timeZone: ctx.resolveConvertTimeZone(),
      direction: ctx.convertDirection,
    });

    if (result.isError) {
      ctx.outputEditor.getWrapperElement().classList.add('error-output');
      ctx.outputEditor.setValue(
        buildErrorBanner({
          commentPrefix: '//',
          title: 'Unable to convert timestamp',
          hint: 'Paste a Unix epoch number or a date (ISO / YYYY-MM-DD [HH:mm:ss]).',
          parserMessage: result.errorMessage || 'Convert failed',
        }) + (trimmed ? rawInput : '')
      );
      ctx.setEditorSyntaxMode('text');
      return;
    }

    ctx.setEditorSyntaxMode('text');
    ctx.outputEditor.setValue(result.text);
    if (result.direction === 'now') {
      ctx.detectedHint.textContent = 'Current time';
    } else if (result.direction === 'epoch') {
      ctx.detectedHint.textContent = ctx.convertDirection === 'auto' ? 'Epoch → Date' : '';
    } else if (ctx.convertDirection === 'auto') {
      ctx.detectedHint.textContent = 'Date → Epoch';
    }
  }

  function scheduleConvert() {
    if (ctx.convertRunTimer !== null) clearTimeout(ctx.convertRunTimer);
    ctx.convertRunTimer = window.setTimeout(() => {
      ctx.convertRunTimer = null;
      runConvert();
    }, 250);
  }

  ctx.runConvert = runConvert;
  ctx.scheduleConvert = scheduleConvert;
}
