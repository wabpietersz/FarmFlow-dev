import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'farmflow-theme';
const THEME_EVENT = 'farmflow:theme';

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d131b' : '#ffffff');
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
  applyTheme(preference);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: preference }));
}

/** The user's theme choice, kept in sync across components and with the OS setting when on "system". */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    const onChange = (event: Event) => setPreference((event as CustomEvent<ThemePreference>).detail);
    window.addEventListener(THEME_EVENT, onChange);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => {
      if (getThemePreference() === 'system') applyTheme('system');
    };
    media.addEventListener('change', onSystem);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      media.removeEventListener('change', onSystem);
    };
  }, []);

  return { preference, setPreference: setThemePreference };
}
