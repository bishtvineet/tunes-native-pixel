export const lightTokens = {
  background: '#F7F2FF',        // LightBackground
  surface: '#FBF8FF',           // LightSurface
  surfaceVariant: '#E8DEF9',    // LightSurfaceVariant[cite: 1]
  primary: '#6C4FF5',           // LightPrimary[cite: 1]
  primaryContainer: '#E3DBFF',  // LightPrimaryContainer[cite: 1]
  onPrimaryContainer: '#23005C',// LightOnPrimaryContainer[cite: 1]
  onSurface: '#1E1237',         // LightOnSurface[cite: 1]
  onSurfaceVariant: '#4D4165',  // LightOnSurfaceVariant[cite: 1]
  outline: '#78659A',           // LightOutline[cite: 1]
  accentPink: '#F06292',        // PixelPlayerPink[cite: 1]
  accentOrange: '#FF8A65',      // PixelPlayerOrange[cite: 1]
};

export const darkTokens = {
  background: '#19191B',        // pixel_play_purple_dark[cite: 1]
  surface: '#1E1234',           // PixelPlayerPurpleDark[cite: 1]
  surfaceVariant: '#2A1F40',    // PixelPlayerSurface[cite: 1]
  primary: '#AB47BC',           // PixelPlayerPurplePrimary[cite: 1]
  primaryContainer: '#3E2459',
  onPrimaryContainer: '#E1BEE7',// PixelPlayerLightPurple[cite: 1]
  onSurface: '#FFFFFF',         // PixelPlayerWhite[cite: 1]
  onSurfaceVariant: '#E1BEE7',  // PixelPlayerLightPurple[cite: 1]
  outline: '#AB47BC',
  accentPink: '#F06292',        // PixelPlayerPink[cite: 1]
  accentOrange: '#FF8A65',      // PixelPlayerOrange[cite: 1]
};

export type ThemeTokens = typeof darkTokens;