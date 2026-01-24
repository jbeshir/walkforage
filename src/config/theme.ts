// Theme Configuration for WalkForage
// Centralized color palette for light and dark modes

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceSecondary: string;
  overlay: string;
  overlayPanel: string; // Semi-transparent panel overlay (for map overlays)

  // Selection highlights
  selectedBackground: string;
  selectedBackgroundAlt: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;

  // Accent colors (consistent across themes)
  primary: string;
  primaryDark: string;
  success: string;
  error: string;
  warning: string;
  warningBackground: string;
  warningText: string;
  info: string;

  // Special colors
  danger: string;
  cheat: string;

  // Shadows (for light mode primarily)
  shadow: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
}

// Light theme - used by main gameplay screens
export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    // Backgrounds
    background: '#f5f5f5',
    surface: '#ffffff',
    surfaceSecondary: '#fafafa',
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayPanel: 'rgba(255, 255, 255, 0.95)',

    // Selection highlights
    selectedBackground: '#E8F5E9',
    selectedBackgroundAlt: '#E3F2FD',

    // Text
    textPrimary: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',
    textInverse: '#ffffff',

    // Borders
    border: '#e0e0e0',
    borderLight: '#f0f0f0',

    // Accent colors
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    success: '#4CAF50',
    error: '#f44336',
    warning: '#FF9800',
    warningBackground: '#FFF3E0',
    warningText: '#E65100',
    info: '#2196F3',

    // Special colors
    danger: '#D32F2F',
    cheat: '#ff6b6b',

    // Shadows
    shadow: '#000000',
  },
};

// Dark theme
export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    // Backgrounds
    background: '#1a1a1a',
    surface: '#2a2a2a',
    surfaceSecondary: '#333333',
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayPanel: 'rgba(42, 42, 42, 0.95)',

    // Selection highlights
    selectedBackground: 'rgba(76, 175, 80, 0.15)',
    selectedBackgroundAlt: 'rgba(33, 150, 243, 0.15)',

    // Text
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#888888',
    textInverse: '#1a1a1a',

    // Borders
    border: '#404040',
    borderLight: '#333333',

    // Accent colors (consistent across themes)
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    success: '#4CAF50',
    error: '#f44336',
    warning: '#FF9800',
    warningBackground: 'rgba(255, 152, 0, 0.15)',
    warningText: '#FFB74D',
    info: '#2196F3',

    // Special colors
    danger: '#D32F2F',
    cheat: '#ff6b6b',

    // Shadows
    shadow: '#000000',
  },
};

// Get theme by mode
export function getTheme(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
