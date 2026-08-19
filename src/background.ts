// src/background.ts
// Service worker for Dev Formatter Pro Chrome extension.
// Handles side panel open/close logic, tab updates, context menu, and state.

import { PENDING_INPUT_KEY, PendingInput } from './utils/pendingInput';

const panelState: Record<number, boolean> = {};
const CONTEXT_MENU_ID = 'format-with-dev-formatter-pro';

function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Format with Dev Formatter Pro',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
});

async function capturePageSelection(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString() ?? '',
    });
    const injected = results?.[0]?.result;
    if (typeof injected === 'string' && injected.trim()) {
      return injected;
    }
  } catch {
    // Restricted pages (chrome://, Web Store, PDFs) cannot be scripted
  }
  return '';
}

function openSidePanelFromGesture(tab: chrome.tabs.Tab) {
  const tabId = tab.id;
  if (!tabId) return;

  // Must run in the same turn as the user gesture — do not await first.
  // Context-menu clicks work with windowId; the toolbar uses tabId.
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
  panelState[tabId] = true;
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;

  const tabId = tab.id;
  const fallback =
    typeof info.selectionText === 'string' ? info.selectionText : '';
  if (fallback.trim()) {
    const pending: PendingInput = { value: fallback, ts: Date.now() };
    void chrome.storage.local.set({ [PENDING_INPUT_KEY]: pending });
  }

  openSidePanelFromGesture(tab);

  void (async () => {
    const injected = await capturePageSelection(tabId);
    if (!injected.trim() || injected === fallback) return;
    const pending: PendingInput = { value: injected, ts: Date.now() };
    await chrome.storage.local.set({ [PENDING_INPUT_KEY]: pending });
  })();
});

// --- Extension Icon Click: Toggle Side Panel ---
chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  const tabId = tab.id;
  if (!tabId) return;

  if (panelState[tabId]) {
    // Panel is open -> close it
    chrome.sidePanel.setOptions({
      tabId: tabId,
      enabled: false,
    });
    panelState[tabId] = false;
  } else {
    chrome.sidePanel.setOptions({
      tabId: tabId,
      path: "sidepanel.html",
      enabled: true,
    });
    chrome.sidePanel.open({ tabId: tabId });
    panelState[tabId] = true;
  }
});

// --- Ensure Side Panel is Available on Relevant Tabs ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.id || !tab.url) {
    return;
  }
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'chrome:' || url.protocol === 'about:') {
      const currentOptions = await chrome.sidePanel.getOptions({ tabId });
      if (currentOptions && (currentOptions.enabled || currentOptions.path)) {
        await chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: false });
      }
      return;
    }
    const currentOptions = await chrome.sidePanel.getOptions({ tabId });
    if (!currentOptions || currentOptions.path !== 'sidepanel.html') {
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: currentOptions ? currentOptions.enabled : false,
      });
    }
  } catch (error: any) {
    if (
      error?.message?.includes('No tab with id') ||
      error?.message?.includes('No current window') ||
      error?.message?.includes('Invalid tab ID') ||
      error?.message?.includes('cannot be scripted')
    ) {
      // Safe to ignore
    } else {
      console.warn(
        `Error setting side panel options in onUpdated for tab ${tabId} (${tab.url}): ${error?.message}`
      );
    }
  }
});
