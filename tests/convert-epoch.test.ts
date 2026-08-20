import test from 'node:test';
import assert from 'node:assert/strict';

import {
  convertEpoch,
  detectEpochUnit,
  epochToMs,
  formatRelative,
  isNumericEpochInput,
  naiveDateToMs,
  parseDateInput,
} from '../src/features/convert/epoch.js';

test('detectEpochUnit uses magnitude thresholds', () => {
  assert.equal(detectEpochUnit(1_700_000_000), 'seconds');
  assert.equal(detectEpochUnit(1_700_000_000_000), 'milliseconds');
  assert.equal(detectEpochUnit(1_700_000_000_000_000), 'microseconds');
  assert.equal(detectEpochUnit(1_700_000_000_000_000_000), 'nanoseconds');
});

test('epochToMs converts units to milliseconds', () => {
  assert.equal(epochToMs(1, 'seconds'), 1000);
  assert.equal(epochToMs(1500, 'milliseconds'), 1500);
  assert.equal(epochToMs(1_500_000, 'microseconds'), 1500);
  assert.equal(epochToMs(1_500_000_000, 'nanoseconds'), 1500);
});

test('isNumericEpochInput detects numbers and batches', () => {
  assert.equal(isNumericEpochInput('1700000000'), true);
  assert.equal(isNumericEpochInput('1700000000\n1700000001'), true);
  assert.equal(isNumericEpochInput('2024-01-01'), false);
  assert.equal(isNumericEpochInput('1700000000\nhello'), false);
});

test('convertEpoch seconds → human breakdown', () => {
  const nowMs = 1_700_000_000_000;
  const result = convertEpoch('1700000000', {
    timeZone: 'UTC',
    direction: 'auto',
    nowMs,
  });
  assert.equal(result.isError, false);
  assert.equal(result.direction, 'epoch');
  assert.match(result.text, /Assuming this is time in seconds/);
  assert.match(result.text, /Unix timestamp:\s+1700000000/);
  assert.match(result.text, /Milliseconds:\s+1700000000000/);
  assert.match(result.text, /ISO 8601:\s+2023-11-14T22:13:20\.000Z/);
});

test('convertEpoch milliseconds → human breakdown', () => {
  const result = convertEpoch('1700000000123', {
    timeZone: 'UTC',
    direction: 'epoch',
    nowMs: 1_700_000_000_123,
  });
  assert.equal(result.isError, false);
  assert.match(result.text, /Assuming this is time in milliseconds/);
  assert.match(result.text, /Milliseconds:\s+1700000000123/);
});

test('naiveDateToMs interprets Asia/Kolkata correctly', () => {
  // 2024-01-01 00:00:00 IST = 2023-12-31 18:30:00 UTC
  const ms = naiveDateToMs(2024, 1, 1, 0, 0, 0, 0, 'Asia/Kolkata');
  assert.equal(ms, Date.parse('2023-12-31T18:30:00.000Z'));
});

test('naiveDateToMs interprets UTC correctly', () => {
  const ms = naiveDateToMs(2024, 6, 15, 12, 30, 45, 0, 'UTC');
  assert.equal(ms, Date.parse('2024-06-15T12:30:45.000Z'));
});

test('parseDateInput accepts ISO with Z', () => {
  const ms = parseDateInput('2026-08-20T15:46:40.000Z', 'Asia/Kolkata');
  assert.equal(ms, Date.parse('2026-08-20T15:46:40.000Z'));
});

test('parseDateInput naive date uses selected timezone', () => {
  const ms = parseDateInput('2024-01-01 00:00:00', 'Asia/Kolkata');
  assert.equal(ms, Date.parse('2023-12-31T18:30:00.000Z'));
});

test('convertEpoch date → unix in selected zone', () => {
  const result = convertEpoch('2024-01-01', {
    timeZone: 'Asia/Kolkata',
    direction: 'date',
  });
  assert.equal(result.isError, false);
  assert.equal(result.direction, 'date');
  assert.match(result.text, /Unix timestamp:\s+1704047400/);
  assert.match(result.text, /Milliseconds:\s+1704047400000/);
});

test('convertEpoch empty input shows current epoch', () => {
  const nowMs = 1_700_000_000_000;
  const result = convertEpoch('', {
    timeZone: 'UTC',
    direction: 'auto',
    nowMs,
  });
  assert.equal(result.isError, false);
  assert.equal(result.direction, 'now');
  assert.match(result.text, /Current Unix epoch time/);
  assert.match(result.text, /Unix timestamp:\s+1700000000/);
});

test('convertEpoch invalid date returns error', () => {
  const result = convertEpoch('not a date at all', {
    timeZone: 'UTC',
    direction: 'date',
  });
  assert.equal(result.isError, true);
  assert.ok(result.errorMessage);
});

test('formatRelative past and future', () => {
  const now = 1_000_000;
  assert.equal(formatRelative(now, now), 'now');
  assert.equal(formatRelative(now - 5_000, now), '5 seconds ago');
  assert.equal(formatRelative(now + 120_000, now), 'in 2 minutes');
  assert.equal(formatRelative(now - 3_600_000, now), '1 hour ago');
  assert.equal(formatRelative(now + 2 * 86_400_000, now), 'in 2 days');
});

test('convertEpoch batch numeric lines', () => {
  const result = convertEpoch('1700000000\n1700000001', {
    timeZone: 'UTC',
    direction: 'auto',
    nowMs: 1_700_000_000_000,
  });
  assert.equal(result.isError, false);
  assert.match(result.text, /1700000000/);
  assert.match(result.text, /1700000001/);
  assert.match(result.text, /──/);
});
