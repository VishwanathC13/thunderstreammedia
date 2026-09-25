import { useCallback, useEffect, useState } from 'react';

// The initial theme is set on <html data-theme> by the inline script in
// index.html (saved choice, else the OS preference) so the first paint is
// already correct; this hook just reads and flips it.
const STORAGE_KEY = 'ts_theme';
const EVENT = 'ts-theme-change';

const current = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function useTheme() {
  const [theme, setThemeState] = useState(current);

  useEffect(() => {
    const sync = () => setThemeState(current());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const setTheme = useCallback((next) => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode: still works for this session */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => setTheme(current() === 'light' ? 'dark' : 'light'), [setTheme]);

  return { theme, setTheme, toggle };
}
