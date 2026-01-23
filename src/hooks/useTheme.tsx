// Theme Context and Hook for WalkForage
// Follows device light/dark mode preference

import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, ThemeMode, getTheme, lightTheme } from '../config/theme';

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const themeMode: ThemeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
  const theme = getTheme(themeMode);

  // Memoize the context value to prevent unnecessary re-renders
  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeMode,
      isDark: themeMode === 'dark',
    }),
    [theme, themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default theme if used outside provider (for backward compatibility)
    return {
      theme: lightTheme,
      themeMode: 'light',
      isDark: false,
    };
  }
  return context;
}
