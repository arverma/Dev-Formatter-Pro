import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeBase64, encodeBase64 } from '../src/features/decode/base64.js';
import { detectDecode } from '../src/features/decode/detectDecode.js';
import { decodeJwt } from '../src/features/decode/jwt.js';
import { decodeUnicode } from '../src/features/decode/unicode.js';
import { decodeUrl } from '../src/features/decode/url.js';

test('Base64 decode pretty-prints JSON payloads', () => {
  const raw = 'eyAiYWxpYXMiOiAiQW1hbiIsICJyb2xlIjogIkRhdGEgRW5naW5lZXIiIH0=';
  const result = decodeBase64(raw);
  assert.equal(result.isError, false);
  assert.equal(result.kind, 'base64');
  assert.match(result.text, /"alias": "Aman"/);
  assert.match(result.text, /"role": "Data Engineer"/);
  assert.ok(result.text.includes('\n'));
});

test('Base64 encode is UTF-8 and round-trips with decode', () => {
  const encoded = encodeBase64('hello ✓');
  assert.equal(encoded.isError, false);
  const decoded = decodeBase64(encoded.text);
  assert.equal(decoded.isError, false);
  assert.equal(decoded.text, 'hello ✓');
});

test('Base64 encode handles payloads larger than one fromCharCode chunk', () => {
  // 0x8000 bytes per chunk in encodeBase64 — use more than one chunk
  const raw = 'あ'.repeat(20_000);
  const encoded = encodeBase64(raw);
  assert.equal(encoded.isError, false);
  const decoded = decodeBase64(encoded.text);
  assert.equal(decoded.isError, false);
  assert.equal(decoded.text, raw);
});

test('URL decode expands percent-encoded URLs', () => {
  const raw =
    'https%3A%2F%2Fapi.internal.com%2Fv1%2Fusers%3Fname%3DAman%20Verma%26role%3DData%2BEngineer';
  const result = decodeUrl(raw);
  assert.equal(result.isError, false);
  assert.equal(
    result.text,
    'https://api.internal.com/v1/users?name=Aman Verma&role=Data+Engineer'
  );
});

test('Unicode decode expands escapes in log text', () => {
  const raw =
    'Status check: \\u2705 \\u003Cb\\u003ESuccess\\u003C\\/b\\u003E. Initiating pipeline...';
  const result = decodeUnicode(raw);
  assert.equal(result.isError, false);
  assert.equal(result.text, 'Status check: ✅ <b>Success</b>. Initiating pipeline...');
});

test('JWT decode pretty-prints header and payload and annotates exp', () => {
  const raw =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFtYW4iLCJyb2xlIjoiRGF0YSBFbmdpbmVlciIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjQyNjIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const result = decodeJwt(raw, Date.UTC(2020, 0, 1));
  assert.equal(result.isError, false);
  assert.match(result.text, /\/\/ --- HEADER ---/);
  assert.match(result.text, /"alg": "HS256"/);
  assert.match(result.text, /\/\/ --- PAYLOAD ---/);
  assert.match(result.text, /"name": "Aman"/);
  assert.match(result.text, /\/\/ iat {2}2018-01-18 01:30:22 UTC/);
  assert.match(result.text, /\/\/ exp {2}2018-01-18 02:30:22 UTC {2}\(expired\)/);
  assert.match(result.text, /signature present, not verified/);
});

test('detectDecode prefers JWT over generic Base64', () => {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc';
  assert.equal(detectDecode(jwt), 'jwt');
  assert.equal(detectDecode('https%3A%2F%2Fexample.com'), 'url');
  assert.equal(detectDecode('\\u2705 ok'), 'unicode');
  assert.equal(
    detectDecode('eyAiYWxpYXMiOiAiQW1hbiIsICJyb2xlIjogIkRhdGEgRW5naW5lZXIiIH0='),
    'base64'
  );
  assert.equal(detectDecode('hello world'), 'unknown');
});
