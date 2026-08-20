interface ErrorBannerOptions {
  commentPrefix: '//' | '--';
  title: string;
  hint: string;
  parserMessage: string;
}

/** Build the output-pane parse-error banner (trailing blank lines included). */
export function buildErrorBanner(opts: ErrorBannerOptions): string {
  const p = opts.commentPrefix;
  return [
    `${p} ⚠️ ${opts.title}`,
    `${p} 💡 Hint: ${opts.hint}`,
    `${p} ─────────────────────────────────────────────────────────────────`,
    `${p} Parser: ${opts.parserMessage}`,
    ``,
    ``,
  ].join('\n');
}
