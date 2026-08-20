/** Session-backed open/closed flags for the side panel toggle. */

const PANEL_STATE_KEY = 'devFormatterPanelState';
const LAST_OPENED_TAB_KEY = 'devFormatterLastOpenedTabId';

/** In-memory open/closed flags keyed by tabId. Hydrated from session storage. */
export const panelState: Record<number, boolean> = {};

/** Last tab we opened the panel for (side panels often omit sender.tab). */
let lastOpenedTabId: number | null = null;

function persistPanelState() {
  const serializable: Record<string, boolean> = {};
  for (const [tabId, open] of Object.entries(panelState)) {
    serializable[tabId] = open;
  }
  const payload: Record<string, unknown> = { [PANEL_STATE_KEY]: serializable };
  if (lastOpenedTabId != null) {
    payload[LAST_OPENED_TAB_KEY] = lastOpenedTabId;
  }
  void chrome.storage.session.set(payload);
}

export function setPanelOpen(tabId: number, open: boolean) {
  panelState[tabId] = open;
  if (open) {
    lastOpenedTabId = tabId;
  }
  persistPanelState();
}

export function markPanelClosed(tabId: number | null | undefined) {
  const id = tabId ?? lastOpenedTabId;
  if (id == null) return;
  setPanelOpen(id, false);
}

export function clearTabPanelState(tabId: number) {
  if (tabId in panelState) {
    delete panelState[tabId];
    if (lastOpenedTabId === tabId) lastOpenedTabId = null;
    persistPanelState();
  }
}

/** Hydrate on SW start (fire-and-forget; never block click handlers). */
export function hydratePanelState() {
  void chrome.storage.session.get([PANEL_STATE_KEY, LAST_OPENED_TAB_KEY]).then((result) => {
    const stored = result[PANEL_STATE_KEY];
    if (stored && typeof stored === 'object') {
      for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
        const tabId = Number(key);
        if (Number.isFinite(tabId) && typeof value === 'boolean') {
          panelState[tabId] = value;
        }
      }
    }
    const last = result[LAST_OPENED_TAB_KEY];
    if (typeof last === 'number' && Number.isFinite(last)) {
      lastOpenedTabId = last;
    }
  });
}
