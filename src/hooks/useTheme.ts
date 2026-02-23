/**
 * Theme hook for dark/light mode management.
 * Provides CSS class strings for consistent theming across components.
 */
import { useState } from 'react';
import { ThemeClasses } from '../types/financial';

export interface UseThemeReturn extends ThemeClasses {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

/**
 * Manages dark/light mode state and provides theme CSS classes.
 */
export function useTheme(): UseThemeReturn {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // AMOLED Theme classes
  const bgClass = isDarkMode ? 'bg-black' : 'bg-gray-50';
  const cardClass = isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200';
  const textClass = isDarkMode ? 'text-white' : 'text-gray-900';
  const textMutedClass = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const inputClass = isDarkMode 
    ? 'bg-zinc-800 border-zinc-700 text-white focus:ring-red-500 focus:border-red-500' 
    : 'bg-white border-gray-300 text-gray-900 focus:ring-red-500 focus:border-red-500';

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
