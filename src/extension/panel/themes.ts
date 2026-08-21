export const DEFAULT_EDITOR_THEME = 'dev-formatter-dark';

interface EditorThemeOption {
  label: string;
  value: string;
  cssFile?: string;
  isDark: boolean;
}

export const EDITOR_THEMES: EditorThemeOption[] = [
  { label: 'Dev ToolBox Dark', value: 'dev-formatter-dark', isDark: true },
  { label: 'Dev ToolBox Light', value: 'dev-formatter-light', isDark: false },
  { label: 'Dracula', value: 'dracula', cssFile: 'dracula.css', isDark: true },
  { label: 'Material Darker', value: 'material-darker', cssFile: 'material-darker.css', isDark: true },
  { label: 'Monokai', value: 'monokai', cssFile: 'monokai.css', isDark: true },
  { label: 'Midnight', value: 'midnight', cssFile: 'midnight.css', isDark: true },
  { label: 'Idea', value: 'idea', cssFile: 'idea.css', isDark: false },
];

interface ApplyThemeDeps {
  themeValue: string;
  cmDynamicThemeLink: HTMLLinkElement;
  inputEditor: { setOption: (key: string, value: unknown) => void };
  outputEditor: { setOption: (key: string, value: unknown) => void };
  themeKey: string;
  themePickerBtn: HTMLButtonElement;
  themePickerMenu: HTMLElement;
}

/** Apply editor + app chrome theme and persist the selection. */
export function applyTheme(deps: ApplyThemeDeps): EditorThemeOption {
  const matched =
    EDITOR_THEMES.find((t) => t.value === deps.themeValue) || EDITOR_THEMES[0];

  // Automatically match the app window background and borders to the theme type
  if (matched.isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  if (matched.cssFile) {
    deps.cmDynamicThemeLink.href = `codemirror/theme/${matched.cssFile}`;
  } else {
    deps.cmDynamicThemeLink.href = '';
  }

  deps.inputEditor.setOption('theme', matched.value);
  deps.outputEditor.setOption('theme', matched.value);

  localStorage.setItem(deps.themeKey, matched.value);
  deps.themePickerBtn.title = matched.label;
  deps.themePickerMenu
    .querySelectorAll<HTMLButtonElement>('.combo-option')
    .forEach((btn) => {
      btn.setAttribute(
        'aria-selected',
        btn.dataset.value === matched.value ? 'true' : 'false'
      );
    });

  return matched;
}
