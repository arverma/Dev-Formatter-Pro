import { formatJson } from '../json/formatJson';
import type { DecodeResult } from './types';

const BASE64_ALPHABET = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** Normalize standard or URL-safe Base64 and pad to a multiple of 4. */
export function normalizeBase64(raw: string): string | undefined {
  const compact = raw.trim().replace(/\s+/g, '');
  if (!compact || !BASE64_ALPHABET.test(compact)) return undefined;
  let s = compact.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 1) return undefined;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  return s;
}

export function decodeBase64Utf8(raw: string): { ok: true; text: string } | { ok: false; error: string } {
  const normalized = normalizeBase64(raw);
  if (!normalized) {
    return { ok: false, error: 'Invalid Base64' };
  }
  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, text };
  } catch {
    return { ok: false, error: 'Invalid Base64' };
  }
}

export function decodeBase64(raw: string): DecodeResult {
  const decoded = decodeBase64Utf8(raw);
  if (!decoded.ok) {
    return {
      text: raw,
      isError: true,
      errorMessage: decoded.error,
      kind: 'base64',
    };
  }
  const asJson = formatJson(decoded.text);
  if (!asJson.isError) {
    return { text: asJson.formatted, isError: false, kind: 'base64' };
  }
  return { text: decoded.text, isError: false, kind: 'base64' };
}

export function encodeBase64(raw: string): DecodeResult {
  try {
    const bytes = new TextEncoder().encode(raw);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return { text: btoa(binary), isError: false, kind: 'base64' };
  } catch {
    return {
      text: raw,
      isError: true,
      errorMessage: 'Could not encode as Base64',
      kind: 'base64',
    };
  }
}
