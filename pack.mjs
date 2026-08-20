// Zip production dist/ for Chrome Web Store upload (no source, tests, or tooling).

import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const version = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
if (!existsSync('dist/manifest.json')) {
  console.error('dist/ is missing. Run npm run build first.');
  process.exit(1);
}

mkdirSync('store', { recursive: true });
const out = `store/dev-toolbox-pro-${version}.zip`;
const result = spawnSync(
  'zip',
  ['-r', '-X', '-q', `../${out}`, '.'],
  { cwd: 'dist', stdio: 'inherit' }
);
if (result.error || result.status !== 0) {
  console.error(result.error ?? `zip exited ${result.status}`);
  process.exit(1);
}
console.log(`Packed ${out}`);
