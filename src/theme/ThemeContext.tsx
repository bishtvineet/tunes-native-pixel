import React, { createContext, useContext, useState, useMemo } from 'react';
import { darkTokens, lightTokens, ThemeTokens } from './tokens/colors';
import { shapes } from './tokens/shapes';
import { typography } from './tokens/typography';

interface ThemeContextType {
  tokens: ThemeTokens;
  shapes: typeof shapes;
  typography: typeof typography;
  isDark: boolean;
  toggleTheme: () => void;
  setDynamicColors: (primary: string, surface: string) => void;
  clearDynamicColors: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [dynamicColors, setDynamicColorsState] = useState<{ primary: string; surface: string } | null>(null);

  const toggleTheme = () => setIsDark(prev => !prev);
  const setDynamicColors = (primary: string, surface: string) => setDynamicColorsState({ primary, surface });
  const clearDynamicColors = () => setDynamicColorsState(null);

  const tokens = useMemo(() => {
    const base = isDark ? darkTokens : lightTokens;
    if (dynamicColors) {
      return {
        ...base,
        primary: dynamicColors.primary,
        surface: dynamicColors.surface,
      };
    }
    return base;
  }, [isDark, dynamicColors]);

  return (
    <ThemeContext.Provider
      value={{
        tokens,
        shapes,
        typography,
        isDark,
        toggleTheme,
        setDynamicColors,
        clearDynamicColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);