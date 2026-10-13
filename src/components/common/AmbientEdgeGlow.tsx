import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GLOW_WIDTH = 34;

interface AmbientEdgeGlowProps {
  isPlaying: boolean;
  enabled: boolean;
}

export const AmbientEdgeGlow: React.FC<AmbientEdgeGlowProps> = ({ isPlaying, enabled }) => {
  const { tokens } = useTheme();

  const glowPulseAnim = useRef(new Animated.Value(0)).current;
  const glowScaleXAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    let loopAnimation: Animated.CompositeAnimation | null = null;

    if (isPlaying && enabled) {
      loopAnimation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowPulseAnim, {
              toValue: 0.75,
              duration: 260,
              easing: Easing.bezier(0.16, 0.84, 0.28, 1.0),
              useNativeDriver: false,
            }),
            Animated.timing(glowScaleXAnim, {
              toValue: 1.1,
              duration: 260,
              easing: Easing.bezier(0.16, 0.84, 0.28, 1.0),
              useNativeDriver: false,
            }),
          ]),
          Animated.parallel([
            Animated.timing(glowPulseAnim, {
              toValue: 0.2,
              duration: 720,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
              useNativeDriver: false,
            }),
            Animated.timing(glowScaleXAnim, {
              toValue: 0.8,
              duration: 720,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
              useNativeDriver: false,
            }),
          ]),
        ])
      );
      loopAnimation.start();
    } else {
      glowPulseAnim.stopAnimation();
      glowScaleXAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(glowPulseAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowScaleXAnim, {
          toValue: 0.5,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    }

    return () => loopAnimation?.stop();
  }, [isPlaying, enabled, glowPulseAnim, glowScaleXAnim]);

  if (!enabled) return null;

  const primaryGlowColor = tokens.primary;
  const secondaryGlowColor = tokens.accentPink || tokens.secondary;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Left Ambient Edge */}
      <Animated.View
        style={[
          styles.leftGlowPillar,
          {
            opacity: glowPulseAnim,
            transform: [{ scaleX: glowScaleXAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.nativeGlowBezelLeft,
            {
              shadowColor: primaryGlowColor,
              backgroundColor: primaryGlowColor,
            },
          ]}
        />
        <Svg width={GLOW_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="globalLeftGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={primaryGlowColor} stopOpacity="0.5" />
              <Stop offset="25%" stopColor={primaryGlowColor} stopOpacity="0.25" />
              <Stop offset="55%" stopColor={primaryGlowColor} stopOpacity="0.08" />
              <Stop offset="85%" stopColor={primaryGlowColor} stopOpacity="0.01" />
              <Stop offset="100%" stopColor={primaryGlowColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={GLOW_WIDTH} height={SCREEN_HEIGHT} fill="url(#globalLeftGlow)" />
        </Svg>
      </Animated.View>

      {/* Right Ambient Edge */}
      <Animated.View
        style={[
          styles.rightGlowPillar,
          {
            opacity: glowPulseAnim,
            transform: [{ scaleX: glowScaleXAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.nativeGlowBezelRight,
            {
              shadowColor: secondaryGlowColor,
              backgroundColor: secondaryGlowColor,
            },
          ]}
        />
        <Svg width={GLOW_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="globalRightGlow" x1="100%" y1="0%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor={secondaryGlowColor} stopOpacity="0.5" />
              <Stop offset="25%" stopColor={secondaryGlowColor} stopOpacity="0.25" />
              <Stop offset="55%" stopColor={secondaryGlowColor} stopOpacity="0.08" />
              <Stop offset="85%" stopColor={secondaryGlowColor} stopOpacity="0.01" />
              <Stop offset="100%" stopColor={secondaryGlowColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={GLOW_WIDTH} height={SCREEN_HEIGHT} fill="url(#globalRightGlow)" />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 40, // Sits above all tabs and content, below modal sheets
  },
  leftGlowPillar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: GLOW_WIDTH,
  },
  rightGlowPillar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: GLOW_WIDTH,
  },
  nativeGlowBezelLeft: {
    position: 'absolute',
    left: -5,
    top: '20%',
    bottom: '20%',
    width: 8,
    opacity: 0.55,
    borderRadius: 4,
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
    elevation: 8,
  },
  nativeGlowBezelRight: {
    position: 'absolute',
    right: -5,
    top: '20%',
    bottom: '20%',
    width: 8,
    opacity: 0.55,
    borderRadius: 4,
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
    elevation: 8,
  },
});