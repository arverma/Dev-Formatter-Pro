import {
  PENDING_INPUT_KEY,
  PENDING_INPUT_MAX_CHARS,
  type PendingInput,
} from '../../core/pendingInput';
import { INPUT_WORK_MAX_CHARS } from './persistence';
import type { FocusedPane, Shell } from './context';

function isPendingInput(value: unknown): value is PendingInput {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as PendingInput).value === 'string' &&
    typeof (value as PendingInput).ts === 'number'
  );
}

interface PendingInputDeps {
  getShell: () => Shell;
  getFocusedPane: () => FocusedPane;
  inputEditor: { setValue: (v: string) => void };
  outputEditor: { setValue: (v: string) => void };
  persistInputStateNow: () => void;
  persistDiffBNow: () => void;
  runWorkspaceNow: () => void;
}

/** Apply a single pending-input payload from chrome.storage.local. */
export function createPendingInputController(deps: PendingInputDeps) {
  let lastAppliedPendingTs = 0;

  async function applyPendingInput(payload: PendingInput) {
    if (payload.ts <= lastAppliedPendingTs) {
      await chrome.storage.local.remove(PENDING_INPUT_KEY);
      return;
    }
    if (
      payload.value.length > INPUT_WORK_MAX_CHARS ||
      payload.value.length > PENDING_INPUT_MAX_CHARS
    ) {
      await chrome.storage.local.remove(PENDING_INPUT_KEY);
      return;
    }
    lastAppliedPendingTs = payload.ts;
    const target =
      deps.getShell() === 'diff' && deps.getFocusedPane() === 'output'
        ? deps.outputEditor
        : deps.inputEditor;
    target.setValue(payload.value);
    if (target === deps.inputEditor) {
      deps.persistInputStateNow();
    } else {
      deps.persistDiffBNow();
    }
    deps.runWorkspaceNow();
    await chrome.storage.local.remove(PENDING_INPUT_KEY);
  }

  function registerPendingInputListeners() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const pending = changes[PENDING_INPUT_KEY]?.newValue;
      if (isPendingInput(pending)) {
        void applyPendingInput(pending);
      }
    });

    chrome.storage.local.get(PENDING_INPUT_KEY).then((result) => {
      const pending = result[PENDING_INPUT_KEY];
      if (isPendingInput(pending)) {
        void applyPendingInput(pending);
      }
    });
  }

  return { applyPendingInput, registerPendingInputListeners };
}
