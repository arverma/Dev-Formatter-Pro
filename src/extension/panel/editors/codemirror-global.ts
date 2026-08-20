// CodeMirror is loaded via <script> tags in sidepanel.html — not bundled.
// Access the global at call time (after those scripts have run).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const CodeMirror: any;

/** Runtime handle to the page-global CodeMirror constructor/API. */
export function getCodeMirror(): any {
  return typeof CodeMirror !== 'undefined'
    ? CodeMirror
    : (globalThis as unknown as { CodeMirror: any }).CodeMirror;
}
