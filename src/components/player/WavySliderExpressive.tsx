import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  Easing,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface WavySliderExpressiveProps {
  progressFraction: number; // 0.0 to 1.0
  isPlaying: boolean;
  onSeekChange: (fraction: number) => void;
  onSeekCommit: (fraction: number) => void;
  activeTrackColor: string;
  inactiveTrackColor: string;
  thumbColor: string;
  trackWidth: number;
}

const WAVELENGTH = 30; // 30.dp from Kotlin spec
const WAVE_AMPLITUDE = 3.8;
const TRACK_HEIGHT = 28;
const THUMB_RADIUS = 7;

export const WavySliderExpressive: React.FC<WavySliderExpressiveProps> = ({
  progressFraction,
  isPlaying,
  onSeekChange,
  onSeekCommit,
  activeTrackColor,
  inactiveTrackColor,
  thumbColor,
  trackWidth,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const lastHapticStep = useRef(-1);

  // Phase animation for continuous sine wave undulation
  const phaseAnim = useRef(new Animated.Value(0)).current;
  // Amplitude animation: smoothly transitions between wavy (playing) and flat (paused)
  const amplitudeAnim = useRef(new Animated.Value(isPlaying ? 1 : 0)).current;
  const [phaseValue, setPhaseValue] = useState(0);
  const [ampValue, setAmpValue] = useState(isPlaying ? 1 : 0);

  useEffect(() => {
    const idPhase = phaseAnim.addListener(({ value }) => setPhaseValue(value));
    const idAmp = amplitudeAnim.addListener(({ value }) => setAmpValue(value));
    return () => {
      phaseAnim.removeListener(idPhase);
      amplitudeAnim.removeListener(idAmp);
    };
  }, [phaseAnim, amplitudeAnim]);

  // Undulation animation loop
  useEffect(() => {
    let loopAnimation: Animated.CompositeAnimation | null = null;
    if (isPlaying) {
      loopAnimation = Animated.loop(
        Animated.timing(phaseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      loopAnimation.start();
    } else {
      phaseAnim.stopAnimation();
    }
    return () => loopAnimation?.stop();
  }, [isPlaying, phaseAnim]);

  // Smooth flat <-> wave morphing
  useEffect(() => {
    Animated.timing(amplitudeAnim, {
      toValue: isPlaying ? 1 : 0,
      duration: 350,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
      useNativeDriver: false,
    }).start();
  }, [isPlaying, amplitudeAnim]);

  const effectiveFraction = isDragging && dragFraction !== null ? dragFraction : progressFraction;
  const clampedFraction = Math.min(Math.max(0, effectiveFraction), 1);
  const currentHeadX = clampedFraction * trackWidth;

  // 20-step quantized haptic feedback (every 5% step)
  const triggerQuantizedHaptic = (fraction: number) => {
    const step = Math.floor(Math.min(Math.max(0, fraction), 1) * 20);
    if (step !== lastHapticStep.current) {
      lastHapticStep.current = step;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Haptics fallback on web or devices lacking haptic motors
      }
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          setIsDragging(true);
          const { locationX } = evt.nativeEvent;
          const frac = Math.min(Math.max(0, locationX / trackWidth), 1);
          setDragFraction(frac);
          triggerQuantizedHaptic(frac);
          onSeekChange(frac);
        },
        onPanResponderMove: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          const newX = Math.min(Math.max(0, currentHeadX + gesture.dx), trackWidth);
          const frac = newX / trackWidth;
          setDragFraction(frac);
          triggerQuantizedHaptic(frac);
          onSeekChange(frac);
        },
        onPanResponderRelease: () => {
          setIsDragging(false);
          const finalFrac = dragFraction ?? clampedFraction;
          onSeekCommit(finalFrac);
          setDragFraction(null);
          lastHapticStep.current = -1;
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          setDragFraction(null);
          lastHapticStep.current = -1;
        },
      }),
    [trackWidth, currentHeadX, dragFraction, clampedFraction, onSeekChange, onSeekCommit]
  );

  // Generate SVG path for the active wavy track up to the thumb head
  const centerY = TRACK_HEIGHT / 2;
  const activePathData = useMemo(() => {
    if (currentHeadX <= 0) return '';
    let d = `M 0 ${centerY}`;
    const stepPx = 3;
    const currentAmp = WAVE_AMPLITUDE * ampValue;
    const phaseOffset = phaseValue * 2 * Math.PI;

    for (let x = 0; x <= currentHeadX; x += stepPx) {
      const angle = (x / WAVELENGTH) * 2 * Math.PI - phaseOffset;
      const y = centerY + Math.sin(angle) * currentAmp;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${currentHeadX.toFixed(1)} ${centerY}`;
    return d;
  }, [currentHeadX, centerY, ampValue, phaseValue]);

  // Inactive straight track extending from the thumb head to the end
  const inactivePathData = useMemo(() => {
    return `M ${Math.max(0, currentHeadX).toFixed(1)} ${centerY} L ${trackWidth.toFixed(1)} ${centerY}`;
  }, [currentHeadX, trackWidth, centerY]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Svg width={trackWidth} height={TRACK_HEIGHT}>
        {/* Inactive tail */}
        <Path
          d={inactivePathData}
          stroke={inactiveTrackColor}
          strokeWidth={4}
          strokeLinecap="round"
        />

        {/* Active oscillating sine wave */}
        {activePathData ? (
          <Path
            d={activePathData}
            stroke={activeTrackColor}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}

        {/* Scrubber thumb circle */}
        <Circle
          cx={Math.max(THUMB_RADIUS, Math.min(trackWidth - THUMB_RADIUS, currentHeadX))}
          cy={centerY}
          r={isDragging ? THUMB_RADIUS + 2.5 : THUMB_RADIUS}
          fill={thumbColor}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingVertical: 2,
  },
});