import { decodeBase64 } from './base64';
import { decodeJwt } from './jwt';
import { decodeUnicode } from './unicode';
import { decodeUrl } from './url';
import type { DecodeKind, DecodeResult } from './types';

export interface DecodeEntry {
  id: DecodeKind;
  label: string;
  decode(raw: string): DecodeResult;
}

const base64Entry: DecodeEntry = {
  id: 'base64',
  label: 'Base64',
  decode: decodeBase64,
};

const urlEntry: DecodeEntry = {
  id: 'url',
  label: 'URL',
  decode: decodeUrl,
};

const unicodeEntry: DecodeEntry = {
  id: 'unicode',
  label: 'Unicode',
  decode: decodeUnicode,
};

const jwtEntry: DecodeEntry = {
  id: 'jwt',
  label: 'JWT',
  decode: decodeJwt,
};

const DECODERS: Record<DecodeKind, DecodeEntry> = {
  base64: base64Entry,
  url: urlEntry,
  unicode: unicodeEntry,
  jwt: jwtEntry,
};

export function getDecoder(id: DecodeKind): DecodeEntry {
  return DECODERS[id];
}
