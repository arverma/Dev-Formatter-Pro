/**
 * src/utils/jsonFormatter.ts
 *
 * JSON formatting utility for Dev Formatter Pro.
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
  type ErrorPosition,
} from './errorPosition';

export interface JsonFormatResult {
  /** Formatted JSON string, or original raw input on error. */
  formatted: string;
  /** True when the input could not be parsed as valid JSON. */
  isError: boolean;
  /** The raw error message from JSON.parse, if applicable. */
  errorMessage?: string;
  /** 0-based editor coordinates when the parse error location is known. */
  errorPosition?: ErrorPosition;
}

function parseJsonErrorPosition(
  raw: string,
  parsedText: string,
  errorMessage: string
): ErrorPosition | undefined {
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

  let jsonToParse = raw.trim();

  // ── Auto-fix: multiple top-level objects: {}{} → [{}, {}] ────────────────
  if (!jsonToParse.startsWith('[') && jsonToParse.includes('}{')) {
    try {
      const fixed = `[${jsonToParse.replace(/}\s*\{/g, '},{')}]`;
      JSON.parse(fixed); // validate the fix
      jsonToParse = fixed;
    } catch {
      jsonToParse = raw.trim(); // revert if fix doesn't help
    }
  } else if (
    !jsonToParse.startsWith('[') &&
    !jsonToParse.endsWith(']') &&
    jsonToParse.includes('},{')
  ) {
    jsonToParse = `[${jsonToParse}]`;
  }

  try {
    const parsed: unknown = JSON.parse(jsonToParse);
    const formatted = JSON.stringify(parsed, null, indent);
    return { formatted, isError: false };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      formatted: raw,
      isError: true,
      errorMessage,
      errorPosition: parseJsonErrorPosition(raw, jsonToParse, errorMessage),
    };
  }
}
