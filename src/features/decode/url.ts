import type { DecodeResult } from './types';

function tryDecode(part: string): string | undefined {
  try {
    return decodeURIComponent(part);
  } catch {
    return undefined;
  }
}

export function decodeUrl(raw: string): DecodeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: raw, isError: true, errorMessage: 'Nothing to decode', kind: 'url' };
  }

  const whole = tryDecode(trimmed);
  if (whole !== undefined) {
    return { text: whole, isError: false, kind: 'url' };
  }

  const rebuilt = trimmed
    .split('&')
    .map((pair) =>
      pair
        .split('=')
        .map((piece) => tryDecode(piece) ?? piece)
        .join('=')
    )
    .join('&');

  if (rebuilt === trimmed) {
    return {
      text: raw,
      isError: true,
      errorMessage: 'Invalid URL encoding',
      kind: 'url',
    };
  }
  return { text: rebuilt, isError: false, kind: 'url' };
}
