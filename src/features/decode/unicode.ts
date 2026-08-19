import type { DecodeResult } from './types';

export function decodeUnicode(raw: string): DecodeResult {
  if (!raw.trim()) {
    return { text: raw, isError: true, errorMessage: 'Nothing to decode', kind: 'unicode' };
  }

  try {
    const text = raw
      .replace(/\\u\{([0-9A-Fa-f]+)\}/g, (_, hex: string) =>
        String.fromCodePoint(parseInt(hex, 16))
      )
      .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/\\\//g, '/');
    return { text, isError: false, kind: 'unicode' };
  } catch {
    return {
      text: raw,
      isError: true,
      errorMessage: 'Invalid Unicode escape',
      kind: 'unicode',
    };
  }
}
