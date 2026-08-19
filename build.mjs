// build.mjs
// esbuild build script for Dev Formatter Pro Chrome extension.
// Bundles TypeScript source → dist/, then copies all static assets.

import * as esbuild from 'esbuild';
import {
  copyFileSync,
  mkdirSync,
  cpSync,
  existsSync,
  rmSync,
} from 'node:fs';

const isWatch = process.argv.includes('--watch');
const DIST = 'dist';

// ─── Clean dist ──────────────────────────────────────────────────────────────
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true, force: true });
}
mkdirSync(DIST, { recursive: true });

// ─── esbuild options ─────────────────────────────────────────────────────────
const buildOptions = {
  entryPoints: {
    background: 'src/background.ts',
    script: 'src/script.ts',
  },
  bundle: true,
  outdir: DIST,
  format: 'iife',
  target: ['chrome120'],
  // Mark CodeMirror as external global — it is loaded via <script> tag
  // so we must NOT bundle it, just reference it as window.CodeMirror
  // (esbuild handles 'declare const CodeMirror' in TypeScript without errors)
  platform: 'browser',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
};

// ─── Copy all static assets to dist/ ─────────────────────────────────────────
function copyAssets() {
  // manifest.json
  copyFileSync('manifest.json', `${DIST}/manifest.json`);

  // Side panel HTML
  copyFileSync('src/sidepanel.html', `${DIST}/sidepanel.html`);

  // Styles
  mkdirSync(`${DIST}/styles`, { recursive: true });
  copyFileSync('src/styles/style.css', `${DIST}/styles/style.css`);

  // Icons
  cpSync('icons', `${DIST}/icons`, { recursive: true });

  // Vendored CodeMirror core, JS mode, and fold addons
  mkdirSync(`${DIST}/codemirror/addon/fold`, { recursive: true });
  copyFileSync('codemirror/codemirror.min.js', `${DIST}/codemirror/codemirror.min.js`);
  copyFileSync('codemirror/codemirror.min.css', `${DIST}/codemirror/codemirror.min.css`);
  copyFileSync('codemirror/javascript.min.js', `${DIST}/codemirror/javascript.min.js`);
  for (const file of [
    'foldcode.min.js',
    'foldgutter.min.js',
    'foldgutter.min.css',
    'brace-fold.min.js',
  ]) {
    copyFileSync(
      `codemirror/addon/fold/${file}`,
      `${DIST}/codemirror/addon/fold/${file}`
    );
  }
  copyFileSync(
    'node_modules/codemirror/addon/fold/indent-fold.js',
    `${DIST}/codemirror/addon/fold/indent-fold.js`
  );

  // Copy only the curated CodeMirror themes used by the editor picker
  const cmThemesSrc = 'node_modules/codemirror/theme';
  const cmThemesDest = `${DIST}/codemirror/theme`;
  const keptThemes = [
    'dracula.css',
    'material-darker.css',
    'monokai.css',
    'midnight.css',
    'idea.css',
  ];
  if (existsSync(cmThemesSrc)) {
    mkdirSync(cmThemesDest, { recursive: true });
    for (const file of keptThemes) {
      copyFileSync(`${cmThemesSrc}/${file}`, `${cmThemesDest}/${file}`);
    }
  }

  // CodeMirror SQL mode — sourced from the codemirror npm package
  const cmSqlSrc = 'node_modules/codemirror/mode/sql/sql.js';
  const cmSqlDest = `${DIST}/codemirror/mode/sql`;
  mkdirSync(cmSqlDest, { recursive: true });
  copyFileSync(cmSqlSrc, `${cmSqlDest}/sql.js`);

  console.log('📦 Assets copied to dist/');
}

// ─── Build ───────────────────────────────────────────────────────────────────
if (isWatch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    plugins: [
      {
        name: 'asset-copy',
        setup(build) {
          build.onEnd(() => copyAssets());
        },
      },
    ],
  });
  copyAssets();
  await ctx.watch();
  console.log('👀 Watching for changes… (Ctrl+C to stop)');
} else {
  await esbuild.build(buildOptions);
  copyAssets();
  console.log('✅ Build complete! Load dist/ as an unpacked Chrome extension.');
}
