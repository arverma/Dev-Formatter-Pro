import { markPanelClosed } from './panelState';

export function registerPanelClosedListener() {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || typeof message !== 'object') return;
    if ((message as { type?: string }).type !== 'panelClosed') return;
    markPanelClosed(sender.tab?.id);
  });
}
