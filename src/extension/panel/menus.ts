function positionAnchoredMenu(
  menu: HTMLElement,
  anchor: HTMLElement,
  align: 'left' | 'right'
) {
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${Math.round(r.bottom + 6)}px`;
  if (align === 'left') {
    menu.style.left = `${Math.round(r.left)}px`;
    menu.style.right = 'auto';
  } else {
    menu.style.right = `${Math.round(window.innerWidth - r.right)}px`;
    menu.style.left = 'auto';
  }
}

interface MenuChrome {
  themePickerMenu: HTMLElement;
  themePickerBtn: HTMLButtonElement;
  shellPickerMenu: HTMLElement;
  shellPickerBtn: HTMLButtonElement;
  dialectPickerMenu: HTMLElement;
  dialectPickerBtn: HTMLButtonElement;
  tzPickerMenu: HTMLElement;
  tzPickerBtn: HTMLButtonElement;
}

function closeAllMenus(chrome: MenuChrome) {
  chrome.themePickerMenu.hidden = true;
  chrome.themePickerBtn.setAttribute('aria-expanded', 'false');
  chrome.shellPickerMenu.hidden = true;
  chrome.shellPickerBtn.setAttribute('aria-expanded', 'false');
  chrome.dialectPickerMenu.hidden = true;
  chrome.dialectPickerBtn.setAttribute('aria-expanded', 'false');
  chrome.tzPickerMenu.hidden = true;
  chrome.tzPickerBtn.setAttribute('aria-expanded', 'false');
}

export function createMenuControllers(chrome: MenuChrome) {
  function setThemeMenuOpen(open: boolean) {
    if (open) closeAllMenus(chrome);
    chrome.themePickerMenu.hidden = !open;
    chrome.themePickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      positionAnchoredMenu(chrome.themePickerMenu, chrome.themePickerBtn, 'right');
    }
  }

  function setShellMenuOpen(open: boolean) {
    if (open) closeAllMenus(chrome);
    chrome.shellPickerMenu.hidden = !open;
    chrome.shellPickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      positionAnchoredMenu(chrome.shellPickerMenu, chrome.shellPickerBtn, 'left');
    }
  }

  function setDialectMenuOpen(open: boolean) {
    if (open) closeAllMenus(chrome);
    chrome.dialectPickerMenu.hidden = !open;
    chrome.dialectPickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      positionAnchoredMenu(chrome.dialectPickerMenu, chrome.dialectPickerBtn, 'left');
    }
  }

  function setTzMenuOpen(open: boolean) {
    if (open) closeAllMenus(chrome);
    chrome.tzPickerMenu.hidden = !open;
    chrome.tzPickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      positionAnchoredMenu(chrome.tzPickerMenu, chrome.tzPickerBtn, 'left');
    }
  }

  return { setThemeMenuOpen, setShellMenuOpen, setDialectMenuOpen, setTzMenuOpen };
}
