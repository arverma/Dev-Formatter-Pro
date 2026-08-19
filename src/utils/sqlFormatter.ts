/**
 * src/utils/sqlFormatter.ts
 *
 * SQL formatting utility for Dev Formatter Pro.
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
  type ErrorPosition,
} from './errorPosition';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SqlDialect {
  /** Human-readable label for the UI dropdown */
  label: string;
  /** sql-formatter language identifier */
  value: string;
}

export interface SqlFormatResult {
  /** Formatted SQL string, or the error-annotated fallback. */
  formatted: string;
  /** True when parsing/formatting encountered a syntax error. */
  isError: boolean;
  /** The raw error message from the parser if formatting failed. */
  errorMessage?: string;
  /** 0-based editor coordinates when the parse error location is known. */
  errorPosition?: ErrorPosition;
}

// ─── Supported Dialects ────────────────────────────────────────────────────
// Source: sql-formatter v15 official docs + CLI --language flag list

export const SQL_DIALECTS: SqlDialect[] = [
  { label: 'Trino / Presto', value: 'trino' },         // ⭐ default
  { label: 'Standard SQL', value: 'sql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'MariaDB', value: 'mariadb' },
  { label: 'BigQuery', value: 'bigquery' },
  { label: 'Snowflake', value: 'snowflake' },
  { label: 'Spark SQL', value: 'spark' },
  { label: 'Apache Hive', value: 'hive' },
  { label: 'SQL Server / T-SQL', value: 'transactsql' },
  { label: 'Oracle PL/SQL', value: 'plsql' },
  { label: 'Amazon Redshift', value: 'redshift' },
  { label: 'IBM DB2', value: 'db2' },
  { label: 'IBM DB2i', value: 'db2i' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'ClickHouse', value: 'clickhouse' },
  { label: 'TiDB', value: 'tidb' },
  { label: 'SingleStoreDB', value: 'singlestoredb' },
  { label: 'Couchbase N1QL', value: 'n1ql' },
];

export const DEFAULT_SQL_DIALECT = 'trino';

// ─── Formatter ─────────────────────────────────────────────────────────────

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
