import { decodeBase64Utf8 } from './base64';
import { looksLikeJwt } from './jwt';
import type { DecodeKind } from './types';

export type DetectedDecode = DecodeKind | 'unknown';

const PCT = /%[0-9A-Fa-f]{2}/;
const UNICODE_ESC = /\\u\{[0-9A-Fa-f]+\}|\\u[0-9A-Fa-f]{4}/;

export function detectDecode(input: string): DetectedDecode {
  const trimmed = input.trim();
  if (!trimmed) return 'unknown';

  if (looksLikeJwt(trimmed)) return 'jwt';

  if (PCT.test(trimmed)) {
    try {
      decodeURIComponent(trimmed);
      return 'url';
    } catch {
      if (trimmed.includes('%')) return 'url';
    }
  }

  if (UNICODE_ESC.test(trimmed)) return 'unicode';

  const b64 = decodeBase64Utf8(trimmed);
  if (b64.ok && trimmed.length >= 8) return 'base64';

  return 'unknown';
}
