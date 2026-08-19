import { formatJson } from '../json/formatJson';
import { decodeBase64Utf8 } from './base64';
import type { DecodeResult } from './types';

const TIME_CLAIMS = ['iat', 'exp', 'nbf'] as const;

export function looksLikeJwt(raw: string): boolean {
  const parts = raw.trim().split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) return false;
  const header = decodeBase64Utf8(parts[0]);
  if (!header.ok) return false;
  try {
    const parsed = JSON.parse(header.text) as { alg?: unknown; typ?: unknown };
    return typeof parsed?.alg === 'string' || typeof parsed?.typ === 'string';
  } catch {
    return false;
  }
}

function formatUnixSeconds(seconds: number): string {
  const iso = new Date(seconds * 1000).toISOString();
  return iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function claimNotes(payload: unknown, nowMs: number): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const record = payload as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of TIME_CLAIMS) {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    let line = `// ${key}  ${formatUnixSeconds(value)}`;
    if (key === 'exp' && value * 1000 < nowMs) {
      line += '  (expired)';
    }
    lines.push(line);
  }
  return lines;
}

export function decodeJwt(raw: string, nowMs: number = Date.now()): DecodeResult {
  const trimmed = raw.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    return {
      text: raw,
      isError: true,
      errorMessage: 'Not a JWT (expected header.payload.signature)',
      kind: 'jwt',
    };
  }

  const headerDec = decodeBase64Utf8(parts[0]);
  const payloadDec = decodeBase64Utf8(parts[1]);
  if (!headerDec.ok || !payloadDec.ok) {
    return {
      text: raw,
      isError: true,
      errorMessage: 'JWT header or payload is not valid Base64URL',
      kind: 'jwt',
    };
  }

  const headerJson = formatJson(headerDec.text);
  const payloadJson = formatJson(payloadDec.text);
  if (headerJson.isError || payloadJson.isError) {
    return {
      text: raw,
      isError: true,
      errorMessage: 'JWT header or payload is not valid JSON',
      kind: 'jwt',
    };
  }

  let payloadObj: unknown;
  try {
    payloadObj = JSON.parse(payloadDec.text);
  } catch {
    payloadObj = null;
  }

  const notes = claimNotes(payloadObj, nowMs);
  const text = [
    '// --- HEADER ---',
    headerJson.formatted,
    '',
    '// --- PAYLOAD ---',
    payloadJson.formatted,
    '',
    '// signature present, not verified',
    ...notes,
  ].join('\n');

  return { text, isError: false, kind: 'jwt' };
}
