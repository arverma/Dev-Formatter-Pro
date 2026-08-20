import type {
  ConvertDirection,
  ConvertOptions,
  ConvertResult,
  EpochUnit,
} from './types';

const NUMERIC_LINE = /^[+-]?\d+(\.\d+)?$/;
const NAIVE_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/;

export function detectEpochUnit(absValue: number): EpochUnit {
  if (absValue < 1e11) return 'seconds';
  if (absValue < 1e14) return 'milliseconds';
  if (absValue < 1e17) return 'microseconds';
  return 'nanoseconds';
}

export function epochToMs(value: number, unit: EpochUnit): number {
  switch (unit) {
    case 'seconds':
      return value * 1000;
    case 'milliseconds':
      return value;
    case 'microseconds':
      return value / 1000;
    case 'nanoseconds':
      return value / 1e6;
  }
}

export function isNumericEpochInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((l) => NUMERIC_LINE.test(l));
}

function formatInZone(
  ms: number,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions
): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(
      new Date(ms)
    );
  }
}

const HUMAN_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'short',
};

export function formatHuman(ms: number, timeZone: string): string {
  return formatInZone(ms, timeZone, HUMAN_OPTS);
}

export function formatIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function formatRelative(ms: number, nowMs: number): string {
  const diffSec = Math.round((ms - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  const past = diffSec < 0;

  if (abs < 60) {
    const n = abs === 0 ? 0 : abs;
    if (n === 0) return 'now';
    return past ? `${n} second${n === 1 ? '' : 's'} ago` : `in ${n} second${n === 1 ? '' : 's'}`;
  }
  if (abs < 3600) {
    const n = Math.floor(abs / 60);
    return past ? `${n} minute${n === 1 ? '' : 's'} ago` : `in ${n} minute${n === 1 ? '' : 's'}`;
  }
  if (abs < 86400) {
    const n = Math.floor(abs / 3600);
    return past ? `${n} hour${n === 1 ? '' : 's'} ago` : `in ${n} hour${n === 1 ? '' : 's'}`;
  }
  if (abs < 86400 * 30) {
    const n = Math.floor(abs / 86400);
    return past ? `${n} day${n === 1 ? '' : 's'} ago` : `in ${n} day${n === 1 ? '' : 's'}`;
  }
  if (abs < 86400 * 365) {
    const n = Math.floor(abs / (86400 * 30));
    return past ? `${n} month${n === 1 ? '' : 's'} ago` : `in ${n} month${n === 1 ? '' : 's'}`;
  }
  const n = Math.floor(abs / (86400 * 365));
  return past ? `${n} year${n === 1 ? '' : 's'} ago` : `in ${n} year${n === 1 ? '' : 's'}`;
}

function unitLabel(unit: EpochUnit): string {
  switch (unit) {
    case 'seconds':
      return 'seconds';
    case 'milliseconds':
      return 'milliseconds';
    case 'microseconds':
      return 'microseconds';
    case 'nanoseconds':
      return 'nanoseconds';
  }
}

function buildEpochBlock(
  ms: number,
  unit: EpochUnit | null,
  timeZone: string,
  nowMs: number
): string {
  if (!Number.isFinite(ms)) {
    throw new Error('Timestamp out of range');
  }
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Timestamp out of range');
  }

  const unixSec = Math.trunc(ms / 1000);
  const unixMs = Math.trunc(ms);
  const lines: string[] = [];
  if (unit) {
    lines.push(`Assuming this is time in ${unitLabel(unit)}:`);
    lines.push('');
  }
  lines.push(`GMT:              ${formatHuman(ms, 'UTC')}`);
  if (timeZone !== 'UTC') {
    lines.push(`${timeZone}:`.padEnd(18) + formatHuman(ms, timeZone));
  }
  lines.push(`Relative:         ${formatRelative(ms, nowMs)}`);
  lines.push(`ISO 8601:         ${formatIso(ms)}`);
  lines.push(`Unix timestamp:   ${unixSec}`);
  lines.push(`Milliseconds:     ${unixMs}`);
  return lines.join('\n');
}

/**
 * Interpret a naive local datetime as occurring in `timeZone`.
 * Returns UTC epoch milliseconds.
 */
export function naiveDateToMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  msFrac: number,
  timeZone: string
): number {
  // Guess UTC instant, then correct by the zone offset at that instant.
  let guess = Date.UTC(year, month - 1, day, hour, minute, second, msFrac);
  for (let i = 0; i < 3; i++) {
    const parts = getZonedParts(guess, timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.ms
    );
    const offset = asUtc - guess;
    const next = Date.UTC(year, month - 1, day, hour, minute, second, msFrac) - offset;
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

function getZonedParts(ms: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  let hour = Number(get('hour'));
  // Some engines report 24 for midnight
  if (hour === 24) hour = 0;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
    ms: 0,
  };
}

export function parseDateInput(raw: string, timeZone: string): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty date');

  const naive = NAIVE_DATE.exec(trimmed);
  if (naive) {
    const year = Number(naive[1]);
    const month = Number(naive[2]);
    const day = Number(naive[3]);
    const hour = Number(naive[4] ?? '0');
    const minute = Number(naive[5] ?? '0');
    const second = Number(naive[6] ?? '0');
    const frac = naive[7] ?? '0';
    const msFrac = Number((frac + '000').slice(0, 3));
    const ms = naiveDateToMs(year, month, day, hour, minute, second, msFrac, timeZone);
    if (!Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime())) {
      throw new Error('Invalid date');
    }
    return ms;
  }

  // ISO / RFC 2822 / Date.parse — if timezone present in string, honor it
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return parsed;

  throw new Error(`Unable to parse date: ${trimmed.slice(0, 80)}`);
}

function parseEpochLine(line: string): { ms: number; unit: EpochUnit } {
  const value = Number(line);
  if (!Number.isFinite(value)) throw new Error(`Invalid number: ${line}`);
  const unit = detectEpochUnit(Math.abs(value));
  const ms = epochToMs(value, unit);
  if (!Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime())) {
    throw new Error('Timestamp out of range');
  }
  return { ms, unit };
}

function buildDateToEpochBlock(ms: number, timeZone: string): string {
  const unixSec = Math.trunc(ms / 1000);
  const unixMs = Math.trunc(ms);
  const lines = [
    `Unix timestamp:   ${unixSec}`,
    `Milliseconds:     ${unixMs}`,
    '',
    `GMT:              ${formatHuman(ms, 'UTC')}`,
  ];
  if (timeZone !== 'UTC') {
    lines.push(`${timeZone}:`.padEnd(18) + formatHuman(ms, timeZone));
  }
  lines.push(`ISO 8601:         ${formatIso(ms)}`);
  return lines.join('\n');
}

function resolveDirection(
  raw: string,
  direction: ConvertDirection
): 'epoch' | 'date' {
  if (direction === 'epoch') return 'epoch';
  if (direction === 'date') return 'date';
  return isNumericEpochInput(raw) ? 'epoch' : 'date';
}

export function convertEpoch(raw: string, opts: ConvertOptions): ConvertResult {
  const nowMs = opts.nowMs ?? Date.now();
  const timeZone = opts.timeZone || 'UTC';
  const trimmed = raw.trim();

  if (!trimmed) {
    try {
      const text = [
        'Current Unix epoch time',
        '',
        `Unix timestamp:   ${Math.trunc(nowMs / 1000)}`,
        `Milliseconds:     ${Math.trunc(nowMs)}`,
        '',
        buildEpochBlock(nowMs, null, timeZone, nowMs),
      ].join('\n');
      return { text, isError: false, direction: 'now' };
    } catch (e) {
      return {
        text: '',
        isError: true,
        errorMessage: e instanceof Error ? e.message : 'Convert failed',
        direction: 'now',
      };
    }
  }

  const dir = resolveDirection(trimmed, opts.direction);

  try {
    if (dir === 'epoch') {
      const lines = trimmed
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0 || !lines.every((l) => NUMERIC_LINE.test(l))) {
        throw new Error('Expected a Unix timestamp (number)');
      }
      const blocks = lines.map((line) => {
        const { ms, unit } = parseEpochLine(line);
        return buildEpochBlock(ms, unit, timeZone, nowMs);
      });
      return {
        text: blocks.join('\n\n─────────────────────────────────\n\n'),
        isError: false,
        direction: 'epoch',
      };
    }

    const ms = parseDateInput(trimmed, timeZone);
    return {
      text: buildDateToEpochBlock(ms, timeZone),
      isError: false,
      direction: 'date',
    };
  } catch (e) {
    return {
      text: '',
      isError: true,
      errorMessage: e instanceof Error ? e.message : 'Convert failed',
      direction: dir,
    };
  }
}
