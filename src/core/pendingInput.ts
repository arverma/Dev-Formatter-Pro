/**
 * Shared chrome.storage.local payload for context-menu → side panel handoff.
 */

export const PENDING_INPUT_KEY = 'pendingInput';

/** Max chars accepted for pending handoff and work budget alignment. */
export const PENDING_INPUT_MAX_CHARS = 1_500_000;

export interface PendingInput {
  value: string;
  ts: number;
}
