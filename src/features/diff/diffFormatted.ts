import { diffLines } from 'diff';

export type DiffHunkType = 'equal' | 'remove' | 'add';

export interface DiffHunk {
  type: DiffHunkType;
  lines: string[];
}

function splitHunkLines(value: string): string[] {
  if (value === '') return [];
  const parts = value.split('\n');
  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

/** Line-level diff of two already-formatted strings. */
export function diffFormatted(original: string, modified: string): DiffHunk[] {
  const parts = diffLines(original, modified);
  const hunks: DiffHunk[] = [];
  for (const part of parts) {
    const type: DiffHunkType = part.added ? 'add' : part.removed ? 'remove' : 'equal';
    const lines = splitHunkLines(part.value);
    if (lines.length === 0) continue;
    hunks.push({ type, lines });
  }
  return hunks;
}
