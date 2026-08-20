import { panelState, setPanelOpen, clearTabPanelState } from './panelState';

export function registerActionToggle() {
  chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
    const tabId = tab.id;
    if (!tabId) return;

    if (panelState[tabId]) {
      chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false,
      });
      setPanelOpen(tabId, false);
    } else {
      chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true,
      });
      chrome.sidePanel.open({ tabId: tabId });
      setPanelOpen(tabId, true);
    }
  });
}

export function registerTabRemovedCleanup() {
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabPanelState(tabId);
  });
}
