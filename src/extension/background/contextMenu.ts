import {
  PENDING_INPUT_KEY,
  PENDING_INPUT_MAX_CHARS,
  PendingInput,
} from '../../core/pendingInput';
import { setPanelOpen } from './panelState';
import { capturePageSelection } from './selection';

const CONTEXT_MENU_ID = 'format-with-dev-toolbox-pro';

export function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Format with Dev ToolBox Pro',
      contexts: ['selection'],
    });
  });
}

function writePendingInput(value: string): boolean {
  if (!value.trim() || value.length > PENDING_INPUT_MAX_CHARS) return false;
  const pending: PendingInput = { value, ts: Date.now() };
  void chrome.storage.local.set({ [PENDING_INPUT_KEY]: pending });
  return true;
}

function openSidePanelFromGesture(tab: chrome.tabs.Tab) {
  const tabId = tab.id;
  if (!tabId) return;

  // Must run in the same turn as the user gesture — do not await first.
  chrome.sidePanel.setOptions({
    tabId,
    path: 'sidepanel.html',
    enabled: true,
  });
  const openArg =
    tab.windowId != null ? { windowId: tab.windowId } : { tabId };
  void chrome.sidePanel.open(openArg).catch(() => {
    // Restricted tabs / missing window — ignore
  });
  setPanelOpen(tabId, true);
}

export function registerContextMenuClickHandler() {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;

    const tabId = tab.id;
    const fallback =
      typeof info.selectionText === 'string' ? info.selectionText : '';
    let wroteFallback = false;
    if (fallback.trim()) {
      wroteFallback = writePendingInput(fallback);
    }

    openSidePanelFromGesture(tab);

    void (async () => {
      const injected = await capturePageSelection(tabId);
      if (!injected.trim()) return;
      if (injected === fallback) return;
      if (wroteFallback && injected.length <= fallback.length) return;
      writePendingInput(injected);
    })();
  });
}
