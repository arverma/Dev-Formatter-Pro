import { buildErrorBanner } from '../../../core/errorBanner';
import { encodeBase64 } from '../../../features/decode/base64';
import { detectDecode } from '../../../features/decode/detectDecode';
import { getDecoder } from '../../../features/decode/registry';
import { isOverWorkBudget } from '../persistence';
import type { PanelContext } from '../context';

export function bindDecodeWorkspace(ctx: PanelContext) {
  function runDecode() {
    const rawInput = ctx.inputEditor.getValue();
    const trimmed = rawInput.trim();

    ctx.outputWatermark.classList.add('hidden');
    ctx.inputWatermark.classList.toggle('hidden', trimmed.length > 0);
    ctx.hideLanguageChrome();
    ctx.clearErrorMarks();
    ctx.outputEditor.getWrapperElement().classList.remove('error-output');

    if (!trimmed) {
      ctx.outputEditor.setValue('\u00a0');
      ctx.detectedHint.textContent = '';
      return;
    }

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

    if (ctx.shell === 'encode') {
      ctx.jsonBadge.style.display = 'none';
      ctx.dialectWrapper.style.display = 'none';
      ctx.setJsonToolsVisible(false);
      ctx.decodeBadge.hidden = false;
      ctx.decodeBadge.textContent = 'Base64 Encode';
      ctx.detectedHint.textContent = '';
      const result = encodeBase64(rawInput);
      if (result.isError) {
        ctx.outputEditor.getWrapperElement().classList.add('error-output');
        ctx.outputEditor.setValue(
          buildErrorBanner({
            commentPrefix: '//',
            title: 'Unable to encode as Base64',
            hint: 'Check that the input is valid UTF-8 text.',
            parserMessage: result.errorMessage || 'Encode failed',
          }) + rawInput
        );
        ctx.setEditorSyntaxMode('text');
        return;
      }
      ctx.setEditorSyntaxMode('text');
      ctx.outputEditor.setValue(result.text);
      return;
    }

    const kind = ctx.decodeKind === 'auto' ? detectDecode(rawInput) : ctx.decodeKind;
    if (kind === 'unknown') {
      ctx.setEditorSyntaxMode('text');
      ctx.detectedHint.textContent = 'Paste Base64, URL, Unicode, or JWT';
      ctx.outputEditor.setValue('// Paste encoded text to decode…');
      return;
    }

    const entry = getDecoder(kind);
    ctx.jsonBadge.style.display = 'none';
    ctx.dialectWrapper.style.display = 'none';
    ctx.setJsonToolsVisible(false);
    ctx.decodeBadge.hidden = false;
    ctx.decodeBadge.textContent = entry.label;
    ctx.detectedHint.textContent = ctx.decodeKind === 'auto' ? entry.label : '';

    const result = entry.decode(rawInput);

    if (result.isError) {
      ctx.outputEditor.getWrapperElement().classList.add('error-output');
      const errorBanner = buildErrorBanner({
        commentPrefix: '//',
        title: `Unable to decode as ${entry.label}`,
        hint: 'Check the encoding, or pick a different decoder.',
        parserMessage: result.errorMessage || 'Decode failed',
      });
      ctx.outputEditor.setValue(errorBanner + rawInput);
      ctx.setEditorSyntaxMode('text');
      return;
    }

    const startsJson =
      result.text.trimStart().startsWith('{') || result.text.trimStart().startsWith('[');
    ctx.setEditorSyntaxMode(result.kind !== 'jwt' && startsJson ? 'json' : 'text');
    ctx.outputEditor.setValue(result.text);
  }

  function scheduleDecode() {
    if (ctx.decodeRunTimer !== null) clearTimeout(ctx.decodeRunTimer);
    ctx.decodeRunTimer = window.setTimeout(() => {
      ctx.decodeRunTimer = null;
      runDecode();
    }, 250);
  }

  ctx.runDecode = runDecode;
  ctx.scheduleDecode = scheduleDecode;
}
