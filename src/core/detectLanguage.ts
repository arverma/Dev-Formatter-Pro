/**
 * Heuristic-based detection of whether a given string is JSON or SQL.
 *
 * Detection order:
 *   1. JSON.parse() — definitive; valid JSON wins immediately.
 *   2. Starts with '{' or '[' — likely JSON even if malformed.
 *   3. First real token (after stripping leading SQL comments) is a SQL keyword.
 *   4. Otherwise: 'unknown'.
 */

export type DetectedLanguage = 'json' | 'sql' | 'unknown';

/**
 * SQL DML/DDL keywords that commonly start a query or statement.
 */
const SQL_START_KEYWORDS = new Set([
  'SELECT',
  'WITH',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'ALTER',
  'DROP',
  'MERGE',
  'TRUNCATE',
  'EXPLAIN',
  'ANALYZE',
  'CALL',
  'EXEC',
  'EXECUTE',
  'SET',
  'SHOW',
  'USE',
  'DESCRIBE',
  'DESC',
  'GRANT',
  'REVOKE',
  'COMMIT',
  'ROLLBACK',
  'BEGIN',
  'START',
  'PRAGMA',
  'REPLACE',
  'UPSERT',
  'COPY',
]);

/**
 * Strip ALL leading whitespace and SQL comments (-- line and /* block *\/)
 * iteratively until the first real token is exposed.
 *
 * Examples:
 *   "  -- get weekly users\nSELECT id FROM..."  → "SELECT id FROM..."
 *   "/* header *\/\nWITH cte AS..."            → "WITH cte AS..."
 *   "  SELECT * FROM t"                         → "SELECT * FROM t"
 */
export function stripLeadingComments(text: string): string {
  let s = text.trimStart();
  let changed = true;

  while (changed) {
    changed = false;

    // Strip a leading -- single-line comment
    if (s.startsWith('--')) {
      const nl = s.indexOf('\n');
      s = nl === -1 ? '' : s.slice(nl + 1).trimStart();
      changed = true;
      continue;
    }

    // Strip a leading /* block comment */
    if (s.startsWith('/*')) {
      const end = s.indexOf('*/');
      s = end === -1 ? '' : s.slice(end + 2).trimStart();
      changed = true;
      continue;
    }

    // Strip a leading # line comment (MySQL / bash-style)
    if (s.startsWith('#')) {
      const nl = s.indexOf('\n');
      s = nl === -1 ? '' : s.slice(nl + 1).trimStart();
      changed = true;
      continue;
    }
  }

  return s;
}

/**
 * Detect whether `input` is JSON, SQL, or unknown.
 *
 * @param input - Raw text from the editor.
 * @returns 'json' | 'sql' | 'unknown'
 */
export function detectLanguage(input: string): DetectedLanguage {
  const trimmed = input.trim();
  if (!trimmed) return 'unknown';

  // ── 1. Valid JSON (definitive) ────────────────────────────────────────────
  try {
    JSON.parse(trimmed);
    return 'json';
  } catch {
    // Continue to structural checks
  }

  // ── 2. Looks like JSON structure (even if currently malformed) ────────────
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  // ── 3. Strip comments and check first SQL keyword ─────────────────────────
  const withoutComments = stripLeadingComments(trimmed);
  if (!withoutComments) return 'unknown';

  // Extract the first token (word before space, (, or newline)
  const firstToken = withoutComments.split(/[\s(]+/)[0].toUpperCase();

  if (SQL_START_KEYWORDS.has(firstToken)) {
    return 'sql';
  }

  return 'unknown';
}
