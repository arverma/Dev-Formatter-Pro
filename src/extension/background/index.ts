// Service worker wiring for Dev ToolBox Pro.
import { hydratePanelState } from './panelState';
import {
  registerContextMenu,
  registerContextMenuClickHandler,
} from './contextMenu';
import { registerPanelClosedListener } from './messages';
import { registerActionToggle, registerTabRemovedCleanup } from './action';

hydratePanelState();

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
});

registerContextMenuClickHandler();
registerPanelClosedListener();
registerActionToggle();
registerTabRemovedCleanup();
