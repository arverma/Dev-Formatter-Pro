/**
 * SQL formatting for Dev Formatter Pro.
 *
 * Wraps the `sql-formatter` npm package with:
 *   - Structured result with safe error handling (no unhandled exceptions)
 *   - No console.error logging (prevents Chrome extension error alerts)
 *   - Trino as the default dialect
 *   - All 19 officially supported dialects (sql-formatter v15)
 */

import { format } from 'sql-formatter';
import {
  lineColToOffset,
  offsetToPosition,
  parseLineColumn,
} from '../../core/errorPosition';
import type { FormatResult } from '../../core/format';
import { DEFAULT_SQL_DIALECT } from './dialects';

export type SqlFormatResult = FormatResult;

/**
 * Format a SQL string using the specified dialect.
 *
 * - Keywords are uppercased.
 * - Indent width is 2 spaces.
 * - Returns a structured `SqlFormatResult` with error information if formatting fails.
 * - Never logs `console.error` to avoid noisy Chrome extension error logs.
 *
 * @param sql     - Raw SQL query string.
 * @param dialect - sql-formatter language identifier. Defaults to 'trino'.
 * @returns `SqlFormatResult`
 */
export function formatSql(sql: string, dialect: string = DEFAULT_SQL_DIALECT): SqlFormatResult {
  if (!sql.trim()) {
    return { formatted: sql, isError: false };
  }

  try {
    const formatted = format(sql, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      language: dialect as any,
      keywordCase: 'upper',
      tabWidth: 2,
    });
    return { formatted, isError: false };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lineCol = parseLineColumn(errorMessage);
    const errorPosition = lineCol
      ? offsetToPosition(sql, lineColToOffset(sql, lineCol.line1, lineCol.col1))
      : undefined;
    return {
      formatted: sql,
      isError: true,
      errorMessage,
      errorPosition,
    };
  }
}
