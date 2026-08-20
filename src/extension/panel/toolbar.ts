/** Helpers for mode buttons, copy flash, and escape-tool error flash. */

export function updateModeButtons(
  modeButtons: NodeListOf<HTMLButtonElement>,
  currentMode: string
) {
  modeButtons.forEach((btn) => {
    if (btn.dataset.mode === currentMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

export function flashToolError(
  btn: HTMLButtonElement,
  fallbackTitle: string,
  message: string
) {
  btn.title = message;
  btn.classList.add('tool-error');
  window.setTimeout(() => {
    btn.title = fallbackTitle;
    btn.classList.remove('tool-error');
  }, 1800);
}

export function flashCopySuccess(deps: {
  copyBtn: HTMLButtonElement;
  copyLabel: HTMLElement;
  copyIconSlot: HTMLElement;
  checkHtml: string;
  copyHtml: string;
  getTimeout: () => number | null;
  setTimeoutId: (id: number | null) => void;
}) {
  deps.copyLabel.textContent = 'Copied';
  deps.copyIconSlot.innerHTML = deps.checkHtml;
  deps.copyBtn.classList.add('copied');

  const prev = deps.getTimeout();
  if (prev) clearTimeout(prev);
  deps.setTimeoutId(
    window.setTimeout(() => {
      deps.copyLabel.textContent = 'Copy';
      deps.copyIconSlot.innerHTML = deps.copyHtml;
      deps.copyBtn.classList.remove('copied');
    }, 1600)
  );
}
