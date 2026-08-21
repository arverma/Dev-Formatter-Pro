export interface ComboController {
  open: () => void;
  close: (opts?: { restoreFocus?: boolean }) => void;
  toggle: () => void;
  isOpen: () => boolean;
  btn: HTMLButtonElement;
  menu: HTMLElement;
}

interface ComboOptions {
  btn: HTMLButtonElement;
  menu: HTMLElement;
  align: 'left' | 'right';
  idPrefix: string;
}

const registry: ComboController[] = [];

let typeaheadBuffer = '';
let typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

function clearTypeahead() {
  typeaheadBuffer = '';
  if (typeaheadTimer !== null) {
    clearTimeout(typeaheadTimer);
    typeaheadTimer = null;
  }
}

function getOptions(menu: HTMLElement): HTMLButtonElement[] {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>('.combo-option'));
}

function ensureOptionIds(menu: HTMLElement, idPrefix: string) {
  getOptions(menu).forEach((opt, i) => {
    if (!opt.id) opt.id = `${idPrefix}-opt-${i}`;
  });
}

function setActiveOption(menu: HTMLElement, opt: HTMLButtonElement | null) {
  getOptions(menu).forEach((o) => o.classList.remove('is-active'));
  if (opt) {
    opt.classList.add('is-active');
    menu.setAttribute('aria-activedescendant', opt.id);
    opt.scrollIntoView({ block: 'nearest' });
  } else {
    menu.removeAttribute('aria-activedescendant');
  }
}

function getActiveOption(menu: HTMLElement): HTMLButtonElement | null {
  return (
    menu.querySelector<HTMLButtonElement>('.combo-option.is-active') ||
    menu.querySelector<HTMLButtonElement>('.combo-option[aria-selected="true"]') ||
    null
  );
}

function positionMenu(
  menu: HTMLElement,
  anchor: HTMLElement,
  align: 'left' | 'right'
) {
  const r = anchor.getBoundingClientRect();
  const gap = 6;
  // Measure with menu temporarily visible so scrollHeight is accurate.
  const wasHidden = menu.hidden;
  if (wasHidden) {
    menu.hidden = false;
    menu.style.visibility = 'hidden';
  }
  const menuHeight = menu.offsetHeight || 0;
  const menuWidth = Math.max(menu.offsetWidth || 0, r.width, 140);
  if (wasHidden) {
    menu.style.visibility = '';
    menu.hidden = true;
  }

  const spaceBelow = window.innerHeight - r.bottom - gap;
  const spaceAbove = r.top - gap;
  const flipUp = menuHeight > spaceBelow && spaceAbove > spaceBelow;

  if (flipUp) {
    menu.style.top = `${Math.round(Math.max(8, r.top - gap - menuHeight))}px`;
  } else {
    menu.style.top = `${Math.round(r.bottom + gap)}px`;
  }

  menu.style.minWidth = `${Math.round(menuWidth)}px`;

  if (align === 'left') {
    let left = r.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    menu.style.left = `${Math.round(left)}px`;
    menu.style.right = 'auto';
  } else {
    let right = window.innerWidth - r.right;
    if (r.right - menuWidth < 8) {
      right = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    menu.style.right = `${Math.round(right)}px`;
    menu.style.left = 'auto';
  }
}

function closeAllExcept(keep: ComboController | null) {
  for (const c of registry) {
    if (c !== keep && c.isOpen()) c.close();
  }
}

export function createCombo(opts: ComboOptions): ComboController {
  const { btn, menu, align, idPrefix } = opts;
  let open = false;
  // Assigned after method bodies so openMenu can close sibling combos.
  // eslint-disable-next-line prefer-const
  let controller!: ComboController;

  function isOpen() {
    return open;
  }

  function close(closeOpts?: { restoreFocus?: boolean }) {
    if (!open) return;
    open = false;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    setActiveOption(menu, null);
    clearTypeahead();
    if (closeOpts?.restoreFocus) btn.focus();
  }

  function openMenu() {
    if (open) return;
    closeAllExcept(controller);
    ensureOptionIds(menu, idPrefix);
    open = true;
    positionMenu(menu, btn, align);
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');

    const selected =
      menu.querySelector<HTMLButtonElement>('.combo-option[aria-selected="true"]') ||
      getOptions(menu)[0] ||
      null;
    setActiveOption(menu, selected);
    clearTypeahead();
  }

  function toggle() {
    if (open) close();
    else openMenu();
  }

  function moveActive(delta: number) {
    const options = getOptions(menu);
    if (!options.length) return;
    const current = getActiveOption(menu);
    let idx = current ? options.indexOf(current) : -1;
    if (idx < 0) idx = delta > 0 ? -1 : 0;
    idx = (idx + delta + options.length) % options.length;
    setActiveOption(menu, options[idx]);
  }

  function jumpActive(to: 'start' | 'end') {
    const options = getOptions(menu);
    if (!options.length) return;
    setActiveOption(menu, to === 'start' ? options[0] : options[options.length - 1]);
  }

  function commitActive() {
    const active = getActiveOption(menu);
    if (!active) return;
    active.click();
  }

  function typeahead(char: string) {
    typeaheadBuffer += char.toLowerCase();
    if (typeaheadTimer !== null) clearTimeout(typeaheadTimer);
    typeaheadTimer = setTimeout(() => {
      typeaheadBuffer = '';
      typeaheadTimer = null;
    }, 700);

    const options = getOptions(menu);
    if (!options.length) return;
    const current = getActiveOption(menu);
    const start = current ? options.indexOf(current) + 1 : 0;
    for (let i = 0; i < options.length; i++) {
      const opt = options[(start + i) % options.length];
      const text = (opt.textContent || '').trim().toLowerCase();
      if (text.startsWith(typeaheadBuffer)) {
        setActiveOption(menu, opt);
        return;
      }
    }
  }

  function onTriggerKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openMenu();
      else moveActive(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) commitActive();
      else openMenu();
      return;
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        close({ restoreFocus: true });
      }
      return;
    }
    if (e.key === 'Home' && open) {
      e.preventDefault();
      jumpActive('start');
      return;
    }
    if (e.key === 'End' && open) {
      e.preventDefault();
      jumpActive('end');
      return;
    }
    if (open && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      typeahead(e.key);
    }
  }

  function onMenuKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      jumpActive('start');
    } else if (e.key === 'End') {
      e.preventDefault();
      jumpActive('end');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commitActive();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close({ restoreFocus: true });
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      typeahead(e.key);
    }
  }

  btn.addEventListener('keydown', onTriggerKeydown);
  menu.addEventListener('keydown', onMenuKeydown);

  controller = {
    open: openMenu,
    close,
    toggle,
    isOpen,
    btn,
    menu,
  };
  registry.push(controller);
  return controller;
}

export function closeAllCombos(opts?: { restoreFocus?: boolean }) {
  for (const c of registry) {
    if (c.isOpen()) c.close(opts);
  }
}

export function closeCombosOutside(target: Node) {
  for (const c of registry) {
    if (!c.isOpen()) continue;
    if (c.btn.contains(target) || c.menu.contains(target)) continue;
    // Also ignore clicks inside the picker wrapper that contains the button.
    const wrapper = c.btn.parentElement;
    if (wrapper && wrapper.contains(target)) continue;
    c.close();
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

/** Build the four panel combos and expose a thin compatibility API. */
export function createMenuControllers(chrome: MenuChrome) {
  const theme = createCombo({
    btn: chrome.themePickerBtn,
    menu: chrome.themePickerMenu,
    align: 'right',
    idPrefix: 'theme',
  });
  const shell = createCombo({
    btn: chrome.shellPickerBtn,
    menu: chrome.shellPickerMenu,
    align: 'left',
    idPrefix: 'shell',
  });
  const dialect = createCombo({
    btn: chrome.dialectPickerBtn,
    menu: chrome.dialectPickerMenu,
    align: 'left',
    idPrefix: 'dialect',
  });
  const tz = createCombo({
    btn: chrome.tzPickerBtn,
    menu: chrome.tzPickerMenu,
    align: 'left',
    idPrefix: 'tz',
  });

  function setThemeMenuOpen(next: boolean) {
    if (next) theme.open();
    else theme.close();
  }
  function setShellMenuOpen(next: boolean) {
    if (next) shell.open();
    else shell.close();
  }
  function setDialectMenuOpen(next: boolean) {
    if (next) dialect.open();
    else dialect.close();
  }
  function setTzMenuOpen(next: boolean) {
    if (next) tz.open();
    else tz.close();
  }

  return {
    setThemeMenuOpen,
    setShellMenuOpen,
    setDialectMenuOpen,
    setTzMenuOpen,
    theme,
    shell,
    dialect,
    tz,
  };
}
