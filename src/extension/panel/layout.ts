interface SplitterLayoutDeps {
  splitter: HTMLElement;
  inputArea: HTMLElement;
  outputArea: HTMLElement;
  appContainer: HTMLElement;
  inputEditor: { refresh: () => void };
  outputEditor: { refresh: () => void };
}

/** Wire vertical splitter resize between input and output panes. */
export function setupSplitterResize(deps: SplitterLayoutDeps) {
  let minHeight = 70;
  let lastInputHeight: number | null = null;
  let lastOutputHeight: number | null = null;

  function setInitialEditorHeights() {
    const containerHeight = deps.appContainer.clientHeight;
    const splitterHeight = deps.splitter.offsetHeight || 10;
    minHeight = 70;
    let inputHeight =
      lastInputHeight !== null
        ? lastInputHeight
        : Math.max(minHeight, Math.floor((containerHeight - splitterHeight) * 0.45));
    let outputHeight =
      lastOutputHeight !== null
        ? lastOutputHeight
        : Math.max(minHeight, containerHeight - splitterHeight - inputHeight);

    if (inputHeight < minHeight) inputHeight = minHeight;
    if (outputHeight < minHeight) outputHeight = minHeight;

    deps.inputArea.style.flexBasis = inputHeight + 'px';
    deps.outputArea.style.flexBasis = outputHeight + 'px';
  }

  setInitialEditorHeights();

  window.addEventListener('resize', () => {
    setInitialEditorHeights();
    deps.inputEditor.refresh();
    deps.outputEditor.refresh();
  });

  let isDragging = false;
  let startY = 0;
  let startInputHeight = 0;
  let startOutputHeight = 0;

  deps.splitter.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    deps.splitter.classList.add('active');
    startY = e.clientY;
    startInputHeight =
      parseInt(window.getComputedStyle(deps.inputArea).flexBasis) ||
      deps.inputArea.offsetHeight;
    startOutputHeight =
      parseInt(window.getComputedStyle(deps.outputArea).flexBasis) ||
      deps.outputArea.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    const containerRect = deps.appContainer.getBoundingClientRect();
    const dy = e.clientY - startY;
    let newInputHeight = Math.max(minHeight, startInputHeight + dy);
    let newOutputHeight = Math.max(minHeight, startOutputHeight - dy);
    const totalHeight = containerRect.height - deps.splitter.offsetHeight;

    if (newInputHeight + newOutputHeight > totalHeight) {
      if (dy > 0) {
        newInputHeight = totalHeight - minHeight;
        newOutputHeight = minHeight;
      } else {
        newInputHeight = minHeight;
        newOutputHeight = totalHeight - minHeight;
      }
    }
    deps.inputArea.style.flexBasis = newInputHeight + 'px';
    deps.outputArea.style.flexBasis = newOutputHeight + 'px';
    lastInputHeight = newInputHeight;
    lastOutputHeight = newOutputHeight;
    deps.inputEditor.refresh();
    deps.outputEditor.refresh();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      deps.splitter.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      deps.inputEditor.refresh();
      deps.outputEditor.refresh();
    }
  });
}
