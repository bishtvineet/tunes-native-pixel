import React, { useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../common/Icon';
import { AppText } from '../common/AppText';
import { getElevation } from '../../theme/elevation';
import type { Track } from '../../types';

interface MiniPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  progressFraction: number; // 0.0 to 1.0
  opacityAnim: Animated.AnimatedInterpolation<number> | Animated.Value;
  onExpand: () => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  progressFraction,
  opacityAnim,
  onExpand,
  onTogglePlay,
  onPrev,
  onNext,
}) => {
  const { tokens, shapes } = useTheme();

  // Distinct Spring Bounce Animators for all 3 Controls
  const prevBounceAnim = useRef(new Animated.Value(1)).current;
  const playBounceAnim = useRef(new Animated.Value(1)).current;
  const nextBounceAnim = useRef(new Animated.Value(1)).current;

  const triggerBounce = (anim: Animated.Value) => {
    anim.stopAnimation();
    anim.setValue(1);
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1.25,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(anim, {
        toValue: 1.0,
        tension: 260,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePrev = () => {
    triggerBounce(prevBounceAnim);
    onPrev();
  };

  const handleTogglePlay = () => {
    triggerBounce(playBounceAnim);
    onTogglePlay();
  };

  const handleNext = () => {
    triggerBounce(nextBounceAnim);
    onNext();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onExpand}
        style={styles.touchableArea}
      >
        {/* Top Edge Progress Line */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(Math.max(0, progressFraction), 1) * 100}%`,
                backgroundColor: tokens.primary,
              },
            ]}
          />
        </View>

        <View style={styles.contentRow}>
          {/* 1. Track Artwork */}
          <View
            style={[
              styles.artContainer,
              {
                borderRadius: shapes.md,
                backgroundColor: tokens.surfaceVariant,
                borderColor: 'rgba(255, 255, 255, 0.14)',
              },
            ]}
          >
            {currentTrack.thumbnailUrl ? (
              <Image
                source={{ uri: currentTrack.thumbnailUrl }}
                style={styles.artImage}
                resizeMode="cover"
              />
            ) : (
              <Icon name="library" size={20} color={tokens.primary} />
            )}
          </View>

          {/* 2. Track Title & Artist */}
          <View style={styles.metaCol}>
            <AppText numberOfLines={1} style={styles.title}>
              {currentTrack.title}
            </AppText>
            <AppText
              numberOfLines={1}
              variant="secondary"
              style={styles.subtitle}
            >
              {currentTrack.artist}
            </AppText>
          </View>

          {/* 3. Middle Transport Actions (Prev & Next with extra spacing) */}
          <View style={styles.middleSkipControls}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePrev}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.skipBtn}
            >
              <Animated.View style={{ transform: [{ scale: prevBounceAnim }] }}>
                <Icon name="skip-prev" size={20} color={tokens.onSurfaceVariant} />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleNext}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.skipBtn}
            >
              <Animated.View style={{ transform: [{ scale: nextBounceAnim }] }}>
                <Icon name="skip-next" size={20} color={tokens.onSurfaceVariant} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* 4. Far Right Primary Play / Pause Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleTogglePlay}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={[
              styles.playCircle,
              getElevation(3),
              {
                backgroundColor: tokens.primary,
                borderRadius: shapes.pill,
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: playBounceAnim }] }}>
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color="#FFFFFF"
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
  touchableArea: {
    flex: 1,
  },
  progressTrack: {
    width: '100%',
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressFill: {
    height: '100%',
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  artContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  metaCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2.5,
    fontWeight: '500',
  },
  middleSkipControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
    flexShrink: 0,
  },
  skipBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  playCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});