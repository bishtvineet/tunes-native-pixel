import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaletteStyle =
  | 'TONAL_SPOT'
  | 'VIBRANT'
  | 'EXPRESSIVE'
  | 'FRUIT_SALAD'
  | 'RAINBOW'
  | 'MONOCHROME';

export interface ThemeTokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  background: string;
  onBackground: string;
  outline: string;
  accentPink: string;
}

const PALETTES: Record<PaletteStyle, ThemeTokens> = {
  TONAL_SPOT: {
    primary: '#D0BCFF',
    onPrimary: '#381E72',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',
    surface: '#141218',
    onSurface: '#E6E0E9',
    surfaceVariant: '#49454F',
    onSurfaceVariant: '#CAC4D0',
    background: '#100D14',
    onBackground: '#E6E0E9',
    outline: '#938F99',
    accentPink: '#FFB1C8',
  },
  VIBRANT: {
    primary: '#FF88BD',
    onPrimary: '#5C003B',
    primaryContainer: '#810053',
    onPrimaryContainer: '#FFD8E7',
    secondary: '#E6B9CD',
    onSecondary: '#452636',
    secondaryContainer: '#5D3C4D',
    onSecondaryContainer: '#FFD8E7',
    surface: '#171215',
    onSurface: '#EAE0E3',
    surfaceVariant: '#504349',
    onSurfaceVariant: '#D4C2C9',
    background: '#120D10',
    onBackground: '#EAE0E3',
    outline: '#9D8C93',
    accentPink: '#FF6498',
  },
  EXPRESSIVE: {
    primary: '#7CD5FF',
    onPrimary: '#003548',
    primaryContainer: '#004D67',
    onPrimaryContainer: '#C4E7FF',
    secondary: '#B4CAD6',
    onSecondary: '#1F333C',
    secondaryContainer: '#354A53',
    onSecondaryContainer: '#D0E6F2',
    surface: '#101416',
    onSurface: '#E1E3E5',
    surfaceVariant: '#40484C',
    onSurfaceVariant: '#C0C8CD',
    background: '#0B0F11',
    onBackground: '#E1E3E5',
    outline: '#8A9297',
    accentPink: '#FF84B7',
  },
  FRUIT_SALAD: {
    primary: '#A0D57B',
    onPrimary: '#173800',
    primaryContainer: '#245100',
    onPrimaryContainer: '#BCF294',
    secondary: '#C1CAAB',
    onSecondary: '#2C341D',
    secondaryContainer: '#424A32',
    onSecondaryContainer: '#DDE7C6',
    surface: '#12140E',
    onSurface: '#E3E4DC',
    surfaceVariant: '#44483E',
    onSurfaceVariant: '#C4C8BB',
    background: '#0D100A',
    onBackground: '#E3E4DC',
    outline: '#8E9287',
    accentPink: '#FF8FA2',
  },
  RAINBOW: {
    primary: '#F0B8FF',
    onPrimary: '#4D175E',
    primaryContainer: '#663076',
    onPrimaryContainer: '#F7D8FF',
    secondary: '#D6C0DD',
    onSecondary: '#3B2B42',
    secondaryContainer: '#524159',
    onSecondaryContainer: '#F2DCFA',
    surface: '#151217',
    onSurface: '#E7E0E7',
    surfaceVariant: '#4B444D',
    onSurfaceVariant: '#CCC3CE',
    background: '#100D12',
    onBackground: '#E7E0E7',
    outline: '#968D98',
    accentPink: '#FFAFD0',
  },
  MONOCHROME: {
    primary: '#E2E2E2',
    onPrimary: '#1B1B1B',
    primaryContainer: '#474747',
    onPrimaryContainer: '#FFFFFF',
    secondary: '#C6C6C6',
    onSecondary: '#303030',
    secondaryContainer: '#474747',
    onSecondaryContainer: '#E2E2E2',
    surface: '#131313',
    onSurface: '#E2E2E2',
    surfaceVariant: '#474747',
    onSurfaceVariant: '#C6C6C6',
    background: '#0E0E0E',
    onBackground: '#E2E2E2',
    outline: '#919191',
    accentPink: '#D0D0D0',
  },
};

interface ThemeContextType {
  tokens: ThemeTokens;
  shapes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    sheet: number;
    pill: number;
  };
  currentPalette: PaletteStyle;
  setPalette: (palette: PaletteStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'pixel_music_palette_style';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPalette, setCurrentPalette] = useState<PaletteStyle>('TONAL_SPOT');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && (saved in PALETTES)) {
        setCurrentPalette(saved as PaletteStyle);
      }
    });
  }, []);

  const setPalette = (palette: PaletteStyle) => {
    setCurrentPalette(palette);
    AsyncStorage.setItem(STORAGE_KEY, palette);
  };

  const tokens = useMemo(() => PALETTES[currentPalette], [currentPalette]);

  const shapes = useMemo(
    () => ({
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      sheet: 28,
      pill: 999,
    }),
    []
  );

  return (
    <ThemeContext.Provider value={{ tokens, shapes, currentPalette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};