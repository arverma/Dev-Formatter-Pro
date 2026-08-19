/**
 * Shared chrome.storage.local payload for context-menu → side panel handoff.
 */

export const PENDING_INPUT_KEY = 'pendingInput';

export interface PendingInput {
  value: string;
  ts: number;
}
