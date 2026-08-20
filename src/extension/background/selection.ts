/** Inject into the active tab to read the live selection (activeTab gesture). */

export async function capturePageSelection(tabId: number): Promise<string> {
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
