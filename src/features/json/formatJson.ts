/**
 * JSON formatting for Dev ToolBox Pro.
 *
 * Features:
 *   - Pretty-printing (2-space indent) or compact minify (indent 0)
 *   - Auto-fix for multiple adjacent JSON objects: }{ → [{},{}]
 *   - Structured results with error handling and parse positions
 */

import {
  mapParsedOffsetToRaw,
  parseLineColumn,
  parsePositionIndex,
  lineColToOffset,
} from '../../core/errorPosition';
import type { FormatResult } from '../../core/format';

export type JsonFormatResult = FormatResult;

function parseJsonErrorPosition(
  raw: string,
  parsedText: string,
  errorMessage: string
) {
  const positionIndex = parsePositionIndex(errorMessage);
  if (positionIndex !== undefined) {
    return mapParsedOffsetToRaw(raw, parsedText, positionIndex);
  }
  const lineCol = parseLineColumn(errorMessage);
  if (lineCol) {
    const offset = lineColToOffset(parsedText, lineCol.line1, lineCol.col1);
    return mapParsedOffsetToRaw(raw, parsedText, offset);
  }
  return undefined;
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Attempt NDJSON-style repairs only when the original text is not valid JSON.
 * Never rewrite valid JSON that happens to contain `}{` or `},{` inside strings.
 */
function tryAutoFixAdjacentObjects(trimmed: string): string | undefined {
  if (trimmed.startsWith('[')) return undefined;

  if (trimmed.includes('}{')) {
    const fixed = `[${trimmed.replace(/}\s*\{/g, '},{')}]`;
    if (tryParse(fixed).ok) return fixed;
  }

  if (
    !trimmed.endsWith(']') &&
    trimmed.includes('},{')
  ) {
    const fixed = `[${trimmed}]`;
    if (tryParse(fixed).ok) return fixed;
  }

  return undefined;
}

/**
 * Format a raw JSON string.
 *
 * @param raw - Raw input text from the editor.
 * @param indent - JSON.stringify indent. `2` (pretty) or `0` (minify).
 */
export function formatJson(raw: string, indent: number = 2): JsonFormatResult {
  if (!raw.trim()) {
    return { formatted: '\u00a0', isError: false };
  }

  const trimmed = raw.trim();

  // 1. Valid JSON wins immediately — never auto-wrap
  const direct = tryParse(trimmed);
  if (direct.ok) {
    return { formatted: JSON.stringify(direct.value, null, indent), isError: false };
  }

  // 2. NDJSON-style repairs, only if the repair itself parses
  const repaired = tryAutoFixAdjacentObjects(trimmed);
  if (repaired !== undefined) {
    const fixed = tryParse(repaired);
    if (fixed.ok) {
      return { formatted: JSON.stringify(fixed.value, null, indent), isError: false };
    }
  }

  // 3. Original parse error against unrepaired text
  try {
    JSON.parse(trimmed);
    // unreachable if tryParse failed, but keeps TS happy
    return { formatted: raw, isError: true, errorMessage: 'Invalid JSON' };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      formatted: raw,
      isError: true,
      errorMessage,
      errorPosition: parseJsonErrorPosition(raw, trimmed, errorMessage),
    };
  }
}
