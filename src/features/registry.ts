import type { DetectedLanguage } from '../core/detectLanguage';
import type { FormatResult } from '../core/format';
import { formatJson } from './json/formatJson';
import { formatSql } from './sql/formatSql';

export type FormatterId = 'json' | 'sql';

export interface FormatOptions {
  dialect: string;
  jsonMinify: boolean;
}

export interface FormatterEntry {
  id: FormatterId;
  label: string;
  commentPrefix: '//' | '--';
  cmLang: 'json' | 'sql';
  parserFallback: string;
  format(raw: string, opts: FormatOptions): FormatResult;
  errorTitle(opts: { dialect: string }): string;
  hintOnError: string;
  hintOnMismatch: string;
}

const jsonFormatter: FormatterEntry = {
  id: 'json',
  label: 'JSON',
  commentPrefix: '//',
  cmLang: 'json',
  parserFallback: 'Invalid JSON',
  format(raw, opts) {
    return formatJson(raw, opts.jsonMinify ? 0 : 2);
  },
  errorTitle() {
    return 'Unable to format as JSON';
  },
  hintOnError:
    'Check for missing quotes around keys, trailing commas, or unmatched braces.',
  hintOnMismatch:
    'The input appears to be SQL. Click "SQL" or "Auto" in the top bar to format as SQL.',
};

const sqlFormatter: FormatterEntry = {
  id: 'sql',
  label: 'SQL',
  commentPrefix: '--',
  cmLang: 'sql',
  parserFallback: 'Syntax error',
  format(raw, opts) {
    return formatSql(raw, opts.dialect);
  },
  errorTitle({ dialect }) {
    return `Unable to format as SQL (${dialect})`;
  },
  hintOnError: 'Check for incomplete SQL syntax or dialect mismatches.',
  hintOnMismatch:
    'The input appears to be JSON. Click "JSON" or "Auto" in the top bar to format as JSON.',
};

const FORMATTERS: Record<FormatterId, FormatterEntry> = {
  json: jsonFormatter,
  sql: sqlFormatter,
};

export function getFormatter(id: FormatterId): FormatterEntry {
  return FORMATTERS[id];
}

export function mismatchHint(entry: FormatterEntry, detected: DetectedLanguage): string {
  if (detected !== 'unknown' && detected !== entry.id) {
    return entry.hintOnMismatch;
  }
  return entry.hintOnError;
}
