import type { PanelContext } from '../context';

export function bindScheduleWorkspace(ctx: PanelContext) {
  function runWorkspace(options?: { prettyPrintDiff?: boolean }) {
    if (ctx.shell === 'decode' || ctx.shell === 'encode') {
      ctx.scheduleDecode();
    } else if (ctx.workspace === 'diff') {
      ctx.runDiff({ prettyPrint: options?.prettyPrintDiff === true });
    } else {
      ctx.runFormatting();
    }
  }

  /** Debounce format/diff while typing (decode keeps its own timer). */
  function scheduleWorkspace(options?: { prettyPrintDiff?: boolean }) {
    if (ctx.workspaceRunTimer !== null) clearTimeout(ctx.workspaceRunTimer);
    const prettyPrintDiff = options?.prettyPrintDiff === true;
    ctx.workspaceRunTimer = window.setTimeout(() => {
      ctx.workspaceRunTimer = null;
      if (ctx.workspace === 'diff') {
        ctx.runDiff({ prettyPrint: prettyPrintDiff });
      } else {
        ctx.runFormatting();
      }
    }, 250);
  }

  /** Clear pending debounce and run immediately (mode / dialect / shell / pending). */
  function runWorkspaceNow() {
    if (ctx.workspaceRunTimer !== null) {
      clearTimeout(ctx.workspaceRunTimer);
      ctx.workspaceRunTimer = null;
    }
    runWorkspace({ prettyPrintDiff: true });
  }

  /** Flush pending format/diff/decode before hide so output is not stale. */
  function flushWorkspaceTimers() {
    if (ctx.workspaceRunTimer !== null) {
      clearTimeout(ctx.workspaceRunTimer);
      ctx.workspaceRunTimer = null;
      if (ctx.workspace === 'diff') {
        ctx.runDiff({ prettyPrint: false });
      } else if (ctx.shell !== 'decode' && ctx.shell !== 'encode') {
        ctx.runFormatting();
      }
    }
    if (ctx.decodeRunTimer !== null) {
      clearTimeout(ctx.decodeRunTimer);
      ctx.decodeRunTimer = null;
      if (ctx.shell === 'decode' || ctx.shell === 'encode') {
        ctx.runDecode();
      }
    }
  }

  ctx.runWorkspace = runWorkspace;
  ctx.scheduleWorkspace = scheduleWorkspace;
  ctx.runWorkspaceNow = runWorkspaceNow;
  ctx.flushWorkspaceTimers = flushWorkspaceTimers;
}
