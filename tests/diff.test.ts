import test from 'node:test';
import assert from 'node:assert/strict';

import { diffFormatted } from '../src/features/diff/diffFormatted.js';
import { formatJson } from '../src/features/json/formatJson.js';
import { formatSql } from '../src/features/sql/formatSql.js';

test('identical pretty JSON produces no add/remove hunks', () => {
  const json = '{\n  "a": 1\n}';
  const hunks = diffFormatted(json, json);
  assert.equal(hunks.every((h) => h.type === 'equal'), true);
});

test('minified vs pretty same object is empty after formatJson', () => {
  const pretty = formatJson('{"database":"postgresql","host":"localhost"}');
  const mini = formatJson('{"database":"postgresql","host":"localhost"}', 0);
  assert.equal(pretty.isError, false);
  assert.equal(mini.isError, false);
  const formattedMini = formatJson(mini.formatted);
  assert.equal(formattedMini.isError, false);
  const hunks = diffFormatted(pretty.formatted, formattedMini.formatted);
  assert.equal(
    hunks.some((h) => h.type === 'add' || h.type === 'remove'),
    false
  );
});

test('host and feature-flag changes produce remove and add lines', () => {
  const staging = formatJson(`{
  "database": "postgresql",
  "host": "localhost",
  "port": 5432,
  "feature_flags": {
    "enable_cache": true,
    "new_auth_flow": false
  }
}`);
  const production = formatJson(`{
  "database": "postgresql",
  "host": "prod-db.arverma.internal",
  "port": 5432,
  "feature_flags": {
    "enable_cache": true,
    "new_auth_flow": true
  },
  "timeout_ms": 5000
}`);
  assert.equal(staging.isError, false);
  assert.equal(production.isError, false);
  const hunks = diffFormatted(staging.formatted, production.formatted);
  const removed = hunks.filter((h) => h.type === 'remove').flatMap((h) => h.lines);
  const added = hunks.filter((h) => h.type === 'add').flatMap((h) => h.lines);
  assert.ok(removed.some((l) => l.includes('"host": "localhost"')));
  assert.ok(added.some((l) => l.includes('prod-db.arverma.internal')));
  assert.ok(removed.some((l) => l.includes('"new_auth_flow": false')));
  assert.ok(added.some((l) => l.includes('"new_auth_flow": true')));
  assert.ok(added.some((l) => l.includes('"timeout_ms": 5000')));
});

test('SQL extra JOIN is add-only after formatSql', () => {
  const oldQ = formatSql(
    "SELECT id, name, created_at FROM users WHERE status = 'active';"
  );
  const newQ = formatSql(
    "SELECT id, name, created_at FROM users LEFT JOIN user_metrics ON users.id = user_metrics.user_id WHERE status = 'active' AND user_metrics.login_count > 5;"
  );
  assert.equal(oldQ.isError, false);
  assert.equal(newQ.isError, false);
  const hunks = diffFormatted(oldQ.formatted, newQ.formatted);
  const removed = hunks.filter((h) => h.type === 'remove').flatMap((h) => h.lines);
  const added = hunks.filter((h) => h.type === 'add').flatMap((h) => h.lines);
  assert.ok(added.some((l) => /LEFT JOIN/i.test(l)));
  assert.ok(added.length > 0);
  assert.equal(
    removed.some((l) => /LEFT JOIN/i.test(l)),
    false
  );
});
