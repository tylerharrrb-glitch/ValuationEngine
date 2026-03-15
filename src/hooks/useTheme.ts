/**
 * Theme hook — locked to WOLF dark terminal aesthetic.
 * Provides CSS class strings for consistent theming across components.
 * The isDarkMode flag + toggleDarkMode are kept for API compatibility,
 * but the theme always returns dark-mode classes.
 */
import { useState } from 'react';
import { ThemeClasses } from '../types/financial';

export interface UseThemeReturn extends ThemeClasses {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

/**
 * Always returns WOLF dark terminal theme classes.
 */
export function useTheme(): UseThemeReturn {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // WOLF Design System — always dark
  const bgClass = 'bg-[var(--bg-primary)]';
  const cardClass = 'bg-[var(--bg-card)] border-[var(--border)]';
  const textClass = 'text-[var(--text-primary)]';
  const textMutedClass = 'text-[var(--text-secondary)]';
  const inputClass = 'wolf-input';

  return {
    isDarkMode: true,  // Always dark
    toggleDarkMode,
    bgClass,
    cardClass,
    textClass,
    textMutedClass,
    inputClass,
  };
}
