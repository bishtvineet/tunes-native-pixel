import React from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const AtmosphericBackground: React.FC = () => {
  const { tokens } = useTheme();

  // Extract base colors for multi-layer depth
  const baseBg = tokens.background;
  const accentTint = tokens.primaryContainer;
  const deepSurface = tokens.surfaceVariant;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Layer 1: Diagonal Atmospheric Mesh */}
          <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={accentTint} stopOpacity="0.45" />
            <Stop offset="30%" stopColor={baseBg} stopOpacity="0.95" />
            <Stop offset="70%" stopColor={deepSurface} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={baseBg} stopOpacity="1" />
          </LinearGradient>

          {/* Layer 2: Subtle Top-Right Ambient Glow */}
          <LinearGradient id="topAura" x1="100%" y1="0%" x2="40%" y2="60%">
            <Stop offset="0%" stopColor={tokens.primary} stopOpacity="0.18" />
            <Stop offset="50%" stopColor={tokens.primary} stopOpacity="0.04" />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </LinearGradient>

          {/* Layer 3: Bottom-Left Soft Glow */}
          <LinearGradient id="bottomAura" x1="0%" y1="100%" x2="60%" y2="40%">
            <Stop offset="0%" stopColor={tokens.accentPink || tokens.secondary} stopOpacity="0.14" />
            <Stop offset="50%" stopColor={tokens.accentPink || tokens.secondary} stopOpacity="0.03" />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Base Gradient Canvas */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#bgGradient)" />

        {/* Top-Right Ambient Light Aura */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#topAura)" />

        {/* Bottom-Left Ambient Light Aura */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#bottomAura)" />
      </Svg>
    </View>
  );
};