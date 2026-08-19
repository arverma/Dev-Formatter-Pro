import test from 'node:test';
import assert from 'node:assert/strict';

import { detectLanguage, stripLeadingComments } from '../src/core/detectLanguage.js';
import { buildErrorBanner } from '../src/core/errorBanner.js';
import { formatSql } from '../src/features/sql/formatSql.js';
import { SQL_DIALECTS, DEFAULT_SQL_DIALECT } from '../src/features/sql/dialects.js';
import { formatJson } from '../src/features/json/formatJson.js';
import { escapeJsonString, unescapeJsonString } from '../src/features/json/jsonEscape.js';
import { getFormatter, mismatchHint } from '../src/features/registry.js';

test('stripLeadingComments should strip line, block, and hash comments', () => {
  assert.equal(
    stripLeadingComments('-- comment\nSELECT 1'),
    'SELECT 1'
  );
  assert.equal(
    stripLeadingComments('/* block\ncomment */\nSELECT 2'),
    'SELECT 2'
  );
  assert.equal(
    stripLeadingComments('# hash comment\nSELECT 3'),
    'SELECT 3'
  );
  assert.equal(
    stripLeadingComments('-- c1\n-- c2\n/* c3 */\nWITH cte AS (SELECT 1) SELECT * FROM cte'),
    'WITH cte AS (SELECT 1) SELECT * FROM cte'
  );
});

test('detectLanguage should accurately detect JSON, SQL, and unknown', () => {
  // JSON cases
  assert.equal(detectLanguage('{"key": "value"}'), 'json');
  assert.equal(detectLanguage('[1, 2, 3]'), 'json');
  assert.equal(detectLanguage('{"incomplete": '), 'json'); // Structural heuristic
  assert.equal(detectLanguage('[{"a": 1}'), 'json');

  // SQL cases
  assert.equal(detectLanguage('SELECT user_id, count(*) FROM users GROUP BY 1'), 'sql');
  assert.equal(detectLanguage('with cte as (select 1) select * from cte'), 'sql');
  assert.equal(detectLanguage('-- comment line\nSELECT * FROM orders'), 'sql');
  assert.equal(detectLanguage('/* header */\nINSERT INTO logs VALUES (1)'), 'sql');
  assert.equal(detectLanguage('UPDATE users SET name="test" WHERE id=1'), 'sql');
  assert.equal(detectLanguage('DELETE FROM users WHERE id=1'), 'sql');
  assert.equal(detectLanguage('CREATE TABLE t (id INT)'), 'sql');

  // Unknown / plain text
  assert.equal(detectLanguage('hello world'), 'unknown');
  assert.equal(detectLanguage(''), 'unknown');
  assert.equal(detectLanguage('just some text with no keywords'), 'unknown');
});

test('formatSql formats standard SQL and Trino queries correctly', () => {
  // 1. Basic SELECT formatting
  const basic = formatSql('select id,name from users where active=true', 'trino');
  assert.equal(basic.isError, false);
  assert.match(basic.formatted, /SELECT/);
  assert.match(basic.formatted, /FROM/);
  assert.match(basic.formatted, /WHERE/);

  // 2. Trino query with INTERVAL and UNNEST
  const trinoInput = "SELECT user_id, count(*) AS events FROM analytics.events CROSS JOIN UNNEST(event_tags) AS t(tag) WHERE event_date >= current_date - INTERVAL '7' DAY AND event_type IN ('click','view') GROUP BY user_id ORDER BY events DESC";
  const trinoFormatted = formatSql(trinoInput, 'trino');
  assert.equal(trinoFormatted.isError, false);
  assert.match(trinoFormatted.formatted, /SELECT/);
  assert.match(trinoFormatted.formatted, /CROSS JOIN/);
  assert.match(trinoFormatted.formatted, /UNNEST/);
  assert.match(trinoFormatted.formatted, /INTERVAL/);
  assert.match(trinoFormatted.formatted, /GROUP BY/);
  assert.match(trinoFormatted.formatted, /ORDER BY/);

  // 3. CTE query
  const cteInput = "WITH active_users AS (SELECT id FROM users WHERE status = 'active') SELECT count(*) FROM active_users";
  const cteFormatted = formatSql(cteInput, 'trino');
  assert.equal(cteFormatted.isError, false);
  assert.match(cteFormatted.formatted, /WITH/);
  assert.match(cteFormatted.formatted, /active_users AS/);

  // 4. Nested subquery & Window functions
  const subq = "SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at DESC) as rn FROM (SELECT * FROM raw_data)";
  const subqFormatted = formatSql(subq, 'trino');
  assert.equal(subqFormatted.isError, false);
  assert.match(subqFormatted.formatted, /row_number\(\)/i);
  assert.match(subqFormatted.formatted, /OVER/);
  assert.match(subqFormatted.formatted, /PARTITION BY/);

  // 5. Blank input
  assert.equal(formatSql('   ', 'trino').formatted, '   ');

  // 6. Malformed SQL returns structured error safely without throwing or console.error
  const malformed = 'SELECT * FROM (((( incomplete';
  const malformedResult = formatSql(malformed, 'trino');
  assert.equal(malformedResult.isError, true);
  assert.ok(typeof malformedResult.errorMessage === 'string');
  assert.equal(malformedResult.formatted, malformed);

  // 7. Switching dialects
  const bqFormatted = formatSql('select * from `project.dataset.table`', 'bigquery');
  assert.equal(bqFormatted.isError, false);
  assert.match(bqFormatted.formatted, /SELECT/);
});

test('SQL dialects list exposes trino as default and covers key dialects', () => {
  assert.equal(DEFAULT_SQL_DIALECT, 'trino');
  const values = SQL_DIALECTS.map(d => d.value);
  assert.ok(values.includes('trino'));
  assert.ok(values.includes('postgresql'));
  assert.ok(values.includes('bigquery'));
  assert.ok(values.includes('snowflake'));
  assert.ok(values.includes('mysql'));
});

test('formatJson formats JSON and handles auto-fix / errors gracefully', () => {
  // Valid JSON
  const valid = formatJson('{"b":2,"a":1}');
  assert.equal(valid.isError, false);
  assert.ok(valid.formatted.includes('"b": 2'));

  // Multi-object auto-fix
  const multiObj = formatJson('{"id":1}{"id":2}');
  assert.equal(multiObj.isError, false);
  assert.ok(multiObj.formatted.startsWith('[\n'));

  // Invalid JSON
  const invalid = formatJson('{key: value}');
  assert.equal(invalid.isError, true);
  assert.ok(invalid.errorMessage !== undefined);

  // Empty string
  const empty = formatJson('');
  assert.equal(empty.isError, false);
});

test('formatJson minifies when indent is 0', () => {
  const pretty = formatJson('{"b":2,"a":1}');
  assert.equal(pretty.isError, false);
  assert.ok(pretty.formatted.includes('\n'));

  const mini = formatJson('{"b":2,"a":1}', 0);
  assert.equal(mini.isError, false);
  assert.equal(mini.formatted, '{"b":2,"a":1}');

  const multiMini = formatJson('{"id":1}{"id":2}', 0);
  assert.equal(multiMini.isError, false);
  assert.equal(multiMini.formatted, '[{"id":1},{"id":2}]');
});

test('formatJson reports errorPosition mapped onto original input', () => {
  const raw = '  {bad}';
  const result = formatJson(raw);
  assert.equal(result.isError, true);
  assert.equal(result.errorPosition?.line, 0);
  assert.equal(result.errorPosition?.ch, 3);

  const multiline = '\n{bad}';
  const multi = formatJson(multiline);
  assert.equal(multi.isError, true);
  assert.equal(multi.errorPosition?.line, 1);
  assert.equal(multi.errorPosition?.ch, 1);
});

test('escapeJsonString / unescapeJsonString are one-layer and no-op on failure', () => {
  const inner = '{"a":1}';
  const escaped = escapeJsonString(inner);
  assert.equal(escaped.isError, false);
  assert.equal(escaped.value, JSON.stringify(inner));

  const unescaped = unescapeJsonString(escaped.value);
  assert.equal(unescaped.isError, false);
  assert.equal(unescaped.value, inner);

  const blobInput = String.fromCharCode(123, 92, 34, 97, 92, 34, 58, 49, 125); // {\"a\":1}
  const blob = unescapeJsonString(blobInput);
  assert.equal(blob.isError, false);
  assert.equal(blob.value, '{"a":1}');

  const invalid = unescapeJsonString('{key: value}');
  assert.equal(invalid.isError, true);
  assert.equal(invalid.value, '{key: value}');

  const objectJson = unescapeJsonString('{"a":1}');
  assert.equal(objectJson.isError, true);
  assert.equal(objectJson.value, '{"a":1}');
});

test('error banners match the side-panel copy for all hint variants', () => {
  const sql = getFormatter('sql');
  const json = getFormatter('json');
  const dialect = 'trino';

  assert.equal(
    buildErrorBanner({
      commentPrefix: sql.commentPrefix,
      title: sql.errorTitle({ dialect }),
      hint: mismatchHint(sql, 'json'),
      parserMessage: 'boom',
    }),
    [
      '-- ⚠️ Unable to format as SQL (trino)',
      '-- 💡 Hint: The input appears to be JSON. Click "JSON" or "Auto" in the top bar to format as JSON.',
      '-- ─────────────────────────────────────────────────────────────────',
      '-- Parser: boom',
      '',
      '',
    ].join('\n')
  );

  assert.equal(
    buildErrorBanner({
      commentPrefix: sql.commentPrefix,
      title: sql.errorTitle({ dialect }),
      hint: mismatchHint(sql, 'sql'),
      parserMessage: sql.parserFallback,
    }),
    [
      '-- ⚠️ Unable to format as SQL (trino)',
      '-- 💡 Hint: Check for incomplete SQL syntax or dialect mismatches.',
      '-- ─────────────────────────────────────────────────────────────────',
      '-- Parser: Syntax error',
      '',
      '',
    ].join('\n')
  );

  assert.equal(
    buildErrorBanner({
      commentPrefix: json.commentPrefix,
      title: json.errorTitle({ dialect }),
      hint: mismatchHint(json, 'sql'),
      parserMessage: 'Unexpected token',
    }),
    [
      '// ⚠️ Unable to format as JSON',
      '// 💡 Hint: The input appears to be SQL. Click "SQL" or "Auto" in the top bar to format as SQL.',
      '// ─────────────────────────────────────────────────────────────────',
      '// Parser: Unexpected token',
      '',
      '',
    ].join('\n')
  );

  assert.equal(
    buildErrorBanner({
      commentPrefix: json.commentPrefix,
      title: json.errorTitle({ dialect }),
      hint: mismatchHint(json, 'unknown'),
      parserMessage: json.parserFallback,
    }),
    [
      '// ⚠️ Unable to format as JSON',
      '// 💡 Hint: Check for missing quotes around keys, trailing commas, or unmatched braces.',
      '// ─────────────────────────────────────────────────────────────────',
      '// Parser: Invalid JSON',
      '',
      '',
    ].join('\n')
  );
});
