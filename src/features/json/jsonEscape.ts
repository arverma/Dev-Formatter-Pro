/**
 * One-layer JSON string encode/decode for log/embed paste workflows.
 */

export interface JsonEscapeResult {
  value: string;
  isError: boolean;
  errorMessage?: string;
}

/** Wrap the current input text as a JSON string (one encode layer). */
export function escapeJsonString(raw: string): JsonEscapeResult {
  return { value: JSON.stringify(raw), isError: false };
}

/**
 * Unwrap one JSON-string layer.
 * Accepts a quoted JSON string, or an unquoted escaped blob like {\"a\":1}.
 */
export function unescapeJsonString(raw: string): JsonEscapeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: raw, isError: true, errorMessage: 'Nothing to unescape' };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return { value: parsed, isError: false };
    }
    return {
      value: raw,
      isError: true,
      errorMessage: 'Input is not a JSON string',
    };
  } catch {
    const looksEscaped = /\\[\\/"bfnrtu]/.test(trimmed);
    if (looksEscaped) {
      try {
        const parsed: unknown = JSON.parse(`"${trimmed}"`);
        if (typeof parsed === 'string') {
          return { value: parsed, isError: false };
        }
      } catch {
        // fall through
      }
    }
    return {
      value: raw,
      isError: true,
      errorMessage: 'Could not unescape',
    };
  }
}
