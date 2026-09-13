import { createContext, useContext, useEffect, useState } from 'react';

/**
 * `matchMedia` is not universally available: jsdom does not implement it, and
 * neither does any non-browser runtime. Calling it at import time would make merely
 * importing a component that reads the theme throw there, before any test can run.
 * Resolve it defensively and fall back to light.
 */
const darkMq: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const prefersDark = (): boolean => darkMq?.matches ?? false;

// Applied at module load, before the first render, so a dark system never flashes light.
if (typeof document !== 'undefined' && prefersDark()) {
  document.documentElement.classList.add('dark');
}

export const DarkModeContext = createContext<boolean>(prefersDark());

/** Whether the app currently renders dark, for code that can't use `dark:` classes (charts, canvas). */
export function useIsDark(): boolean {
  return useContext(DarkModeContext);
}

/**
 * Follows the system colour scheme. `toggle` overrides it for the session only, and
 * a change of the system setting wins back over the override.
 */
export function useDarkMode(): { isDark: boolean; toggle: () => void } {
  const [browserScheme, setBrowserScheme] = useState<'light' | 'dark'>(prefersDark() ? 'dark' : 'light');
  const [override, setOverride] = useState<'light' | 'dark' | null>(null);
  const effective = override ?? browserScheme;

  useEffect(() => {
    if (!darkMq) return;
    const handler = (e: MediaQueryListEvent) => {
      setBrowserScheme(e.matches ? 'dark' : 'light');
      setOverride(null);
    };
    darkMq.addEventListener('change', handler);
    return () => darkMq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effective === 'dark');
  }, [effective]);

  return {
    isDark: effective === 'dark',
    toggle: () => setOverride(effective === 'dark' ? 'light' : 'dark'),
  };
}
