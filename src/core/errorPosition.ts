/**
 * Parse-error coordinates for the input editor (CodeMirror 0-based line/ch).
 */

export interface ErrorPosition {
  line: number;
  ch: number;
}

export function offsetToPosition(text: string, offset: number): ErrorPosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lastBreak = -1;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lastBreak = i;
    }
  }
  return { line, ch: clamped - (lastBreak + 1) };
}

export function lineColToOffset(text: string, line1: number, col1: number): number {
  const lines = text.split('\n');
  const lineIdx = Math.max(0, line1 - 1);
  let offset = 0;
  for (let i = 0; i < lineIdx && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  offset += Math.max(0, col1 - 1);
  return Math.min(offset, text.length);
}

function leadingWhitespaceLength(raw: string): number {
  return raw.length - raw.trimStart().length;
}

export function parseLineColumn(message: string): { line1: number; col1: number } | undefined {
  const lineCol =
    message.match(/line\s+(\d+)\s+column\s+(\d+)/i) ??
    message.match(/at line\s+(\d+):(\d+)/i) ??
    message.match(/\(line\s+(\d+)\s+column\s+(\d+)\)/i);
  if (lineCol) {
    return { line1: Number(lineCol[1]), col1: Number(lineCol[2]) };
  }
  const lineOnly = message.match(/\bon line\s+(\d+)/i);
  if (lineOnly) {
    return { line1: Number(lineOnly[1]), col1: 1 };
  }
  return undefined;
}

export function parsePositionIndex(message: string): number | undefined {
  const m = message.match(/at position\s+(\d+)/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * Map a parser offset (in `parsedText`) onto coordinates in the original `raw` editor text.
 */
export function mapParsedOffsetToRaw(
  raw: string,
  parsedText: string,
  offset: number
): ErrorPosition {
  const trimmed = raw.trim();
  const lead = leadingWhitespaceLength(raw);
  if (parsedText === trimmed) {
    return offsetToPosition(raw, lead + offset);
  }
  if (parsedText === `[${trimmed}]`) {
    return offsetToPosition(raw, lead + Math.max(0, offset - 1));
  }
  return offsetToPosition(raw, lead + offset);
}
