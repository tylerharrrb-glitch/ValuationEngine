/**
 * Theme hook — WOLF design system, dark default with a light "cream paper" mode.
 * Sets `data-theme` on <html> and persists the choice to localStorage.
 * Components consume CSS variables (--bg, --panel, --gold, …), so the class
 * strings returned here stay theme-agnostic and re-skin automatically.
 */
import { useState, useEffect, useCallback } from 'react';
import { ThemeClasses } from '../types/financial';

export interface UseThemeReturn extends ThemeClasses {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const STORAGE_KEY = 'wolf-theme';

function getInitialDark(): boolean {
  if (typeof document === 'undefined') return true;
  // index.html sets data-theme="light" pre-paint when persisted; trust it.
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

export function useTheme(): UseThemeReturn {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialDark);

  // Keep <html data-theme> and localStorage in sync with state.
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', 'light');
    }
    try {
      localStorage.setItem(STORAGE_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => setIsDarkMode(prev => !prev), []);

  // WOLF Design System — class strings reference CSS variables (theme-aware)
  const bgClass = 'bg-[var(--bg)]';
  const cardClass = 'bg-[var(--panel)] border-[var(--border)]';
  const textClass = 'text-[var(--text)]';
  const textMutedClass = 'text-[var(--text2)]';
  const inputClass = 'wolf-input';

  return {
    isDarkMode,
    toggleDarkMode,
    bgClass,
    cardClass,
    textClass,
    textMutedClass,
    inputClass,
  };
}
