import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Easing,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../common/Icon';
import { M3Pressable } from '../common/M3Pressable';
import { WavySliderExpressive } from './WavySliderExpressive';
import { formatDuration } from '../../utils/audio';
import type { Track, RepeatMode, PlaybackContext } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Trimmed 3D Card Dimensions ───
const ARTWORK_WIDTH = Math.min(SCREEN_WIDTH - 44, 340);
const ARTWORK_HEIGHT = Math.round(ARTWORK_WIDTH * 0.68);

const MINI_HEIGHT = 64;
const SCRUBBER_TRACK_WIDTH = SCREEN_WIDTH - 48;
const GLOW_WIDTH = 42;

interface FullPlayerSheetProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  repeatMode: RepeatMode;
  isShuffle?: boolean;
  playbackContext: PlaybackContext;
  isAmbientGlowEnabled?: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle?: () => void;
  onToggleFavorite?: (id: string) => void;
  onNavigateToLibrary?: () => void;
}

export const FullPlayerSheet: React.FC<FullPlayerSheetProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  repeatMode,
  isShuffle = false,
  playbackContext,
  isAmbientGlowEnabled = true,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onToggleRepeat,
  onToggleShuffle,
  onToggleFavorite,
  onNavigateToLibrary,
}) => {
  const { tokens, shapes } = useTheme();
  const insets = useSafeAreaInsets();

  const expansionFraction = useRef(new Animated.Value(0)).current;
  const isExpandedRef = useRef(false);
  const [isExpandedState, setIsExpandedState] = useState(false);
  const [isFavoriteOptimistic, setIsFavoriteOptimistic] = useState(
    currentTrack?.isFavorite ?? false
  );

  // ─── Bounce Animators for Bottom Controls (Shuffle, Repeat, Favorite) ───
  const shuffleBounceAnim = useRef(new Animated.Value(1)).current;
  const repeatBounceAnim = useRef(new Animated.Value(1)).current;
  const favoriteBounceAnim = useRef(new Animated.Value(1)).current;

  // ─── Continuous Organic Beat Glow Engine ───
  const glowPulseAnim = useRef(new Animated.Value(0)).current;
  const glowScaleXAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    let loopAnimation: Animated.CompositeAnimation | null = null;

    if (isPlaying && isExpandedState && isAmbientGlowEnabled) {
      loopAnimation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowPulseAnim, {
              toValue: 0.85,
              duration: 260,
              easing: Easing.bezier(0.16, 0.84, 0.28, 1.0),
              useNativeDriver: false,
            }),
            Animated.timing(glowScaleXAnim, {
              toValue: 1.12,
              duration: 260,
              easing: Easing.bezier(0.16, 0.84, 0.28, 1.0),
              useNativeDriver: false,
            }),
          ]),
          Animated.parallel([
            Animated.timing(glowPulseAnim, {
              toValue: 0.22,
              duration: 720,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
              useNativeDriver: false,
            }),
            Animated.timing(glowScaleXAnim, {
              toValue: 0.78,
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
          toValue: isPlaying && isAmbientGlowEnabled ? 0.25 : 0,
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
  }, [isPlaying, isExpandedState, isAmbientGlowEnabled, glowPulseAnim, glowScaleXAnim]);

  // Jitter-free Native Driver Bounce for bottom icons
  const triggerIconBounce = (anim: Animated.Value) => {
    anim.stopAnimation();
    anim.setValue(1);
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1.28,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true, // Native driver eliminates frame drops
      }),
      Animated.spring(anim, {
        toValue: 1.0,
        tension: 260,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const [targetSeekFraction, setTargetSeekFraction] = useState<number | null>(null);
  const lastSeekFinishedTime = useRef(0);

  useEffect(() => {
    setIsFavoriteOptimistic(currentTrack?.isFavorite ?? false);
  }, [currentTrack?.id, currentTrack?.isFavorite]);

  useEffect(() => {
    setTargetSeekFraction(null);
    lastSeekFinishedTime.current = 0;
  }, [currentTrack?.id]);

  const totalDuration = duration || currentTrack?.duration || 1;
  const actualFraction = Math.min(Math.max(0, currentTime / totalDuration), 1);

  useEffect(() => {
    if (targetSeekFraction !== null) {
      const timeSinceSeek = Date.now() - lastSeekFinishedTime.current;
      const diff = Math.abs(actualFraction - targetSeekFraction);
      if (timeSinceSeek > 5000 || diff < 0.04) {
        setTargetSeekFraction(null);
      }
    }
  }, [currentTime, actualFraction, targetSeekFraction]);

  const activeProgressFraction = targetSeekFraction !== null ? targetSeekFraction : actualFraction;

  // ─── Expansion Weights for Prev / Play / Next ───
  const prevWeight = useRef(new Animated.Value(1)).current;
  const playWeight = useRef(new Animated.Value(1.15)).current;
  const nextWeight = useRef(new Animated.Value(1)).current;

  const navBarOffset = (insets.bottom > 0 ? insets.bottom + 4 : 12) + 58 + 12;

  const expandSheet = () => {
    isExpandedRef.current = true;
    setIsExpandedState(true);
    Animated.spring(expansionFraction, {
      toValue: 1,
      tension: 70,
      friction: 9,
      useNativeDriver: false,
    }).start();
  };

  const collapseSheet = (callback?: () => void) => {
    isExpandedRef.current = false;
    Animated.timing(expansionFraction, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setIsExpandedState(false);
      if (callback) callback();
    });
  };

  const handleOpenLibrary = () => {
    collapseSheet(() => {
      if (onNavigateToLibrary) {
        onNavigateToLibrary();
      }
    });
  };

  const handleToggleFavoritePress = () => {
    if (!currentTrack) return;
    triggerIconBounce(favoriteBounceAnim);
    const nextVal = !isFavoriteOptimistic;
    setIsFavoriteOptimistic(nextVal);
    if (onToggleFavorite) {
      onToggleFavorite(currentTrack.id);
    }
  };

  const handleToggleShufflePress = () => {
    triggerIconBounce(shuffleBounceAnim);
    if (onToggleShuffle) {
      onToggleShuffle();
    }
  };

  const handleToggleRepeatPress = () => {
    triggerIconBounce(repeatBounceAnim);
    onToggleRepeat();
  };

  const handleSeekCommit = (fraction: number) => {
    setTargetSeekFraction(fraction);
    lastSeekFinishedTime.current = Date.now();
    onSeek(Math.floor(fraction * totalDuration));
  };

  // Smooth, non-blocking expansion spring for transport controls
  const triggerButtonExpansion = (button: 'prev' | 'play' | 'next') => {
    prevWeight.stopAnimation();
    playWeight.stopAnimation();
    nextWeight.stopAnimation();

    Animated.parallel([
      Animated.spring(prevWeight, {
        toValue: button === 'prev' ? 1.25 : 0.9,
        tension: 200,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.spring(playWeight, {
        toValue: button === 'play' ? 1.35 : 0.9,
        tension: 200,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.spring(nextWeight, {
        toValue: button === 'next' ? 1.25 : 0.9,
        tension: 200,
        friction: 12,
        useNativeDriver: false,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(prevWeight, { toValue: 1, tension: 160, friction: 11, useNativeDriver: false }),
        Animated.spring(playWeight, { toValue: 1.15, tension: 160, friction: 11, useNativeDriver: false }),
        Animated.spring(nextWeight, { toValue: 1, tension: 160, friction: 11, useNativeDriver: false }),
      ]).start();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        return (
          Math.abs(gesture.dy) > 15 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.8
        );
      },
      onPanResponderMove: (_, gesture) => {
        if (!isExpandedRef.current) {
          const progress = Math.min(Math.max(-gesture.dy / (SCREEN_HEIGHT * 0.5), 0), 1);
          expansionFraction.setValue(progress);
        } else {
          const progress = Math.min(Math.max(1 - gesture.dy / (SCREEN_HEIGHT * 0.5), 0), 1);
          expansionFraction.setValue(progress);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (!isExpandedRef.current) {
          if (gesture.dy < -70 || gesture.vy < -0.4) {
            expandSheet();
          } else {
            collapseSheet();
          }
        } else {
          if (gesture.dy > 80 || gesture.vy > 0.4) {
            collapseSheet();
          } else {
            expandSheet();
          }
        }
      },
    })
  ).current;

  if (!currentTrack) return null;

  const sheetHeight = expansionFraction.interpolate({
    inputRange: [0, 1],
    outputRange: [MINI_HEIGHT, SCREEN_HEIGHT],
  });

  const sheetBottom = expansionFraction.interpolate({
    inputRange: [0, 1],
    outputRange: [navBarOffset, 0],
  });

  const sheetBorderRadius = expansionFraction.interpolate({
    inputRange: [0, 1],
    outputRange: [shapes.sheet, 0],
  });

  const miniPlayerOpacity = expansionFraction.interpolate({
    inputRange: [0, 0.2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const fullPlayerOpacity = expansionFraction.interpolate({
    inputRange: [0.25, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const rootBackgroundColor = expansionFraction.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [tokens.surface, tokens.surface, '#0D0814'],
  });

  const rawContextString = String(playbackContext ?? '').toLowerCase();
  const categoryLabel =
    rawContextString === 'favorites' || rawContextString === 'favorite'
      ? 'FAVORITES'
      : rawContextString === 'all'
      ? 'ALL TRACKS'
      : String(playbackContext ?? '').toUpperCase();

  const primaryGlowColor = tokens.primary;
  const secondaryGlowColor = tokens.accentPink || tokens.secondary;

  return (
    <Animated.View
      style={[
        styles.sheetRoot,
        {
          height: sheetHeight,
          bottom: sheetBottom,
          borderRadius: sheetBorderRadius,
          backgroundColor: rootBackgroundColor,
          borderColor: isExpandedState ? 'transparent' : tokens.outline,
          borderWidth: isExpandedState ? 0 : 1.5,
          left: isExpandedState ? 0 : 16,
          right: isExpandedState ? 0 : 16,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[
          styles.blurredBackdropContainer,
          { opacity: fullPlayerOpacity },
        ]}
        pointerEvents="none"
      >
        {currentTrack.thumbnailUrl ? (
          <Image
            source={{ uri: currentTrack.thumbnailUrl }}
            style={styles.blurredBackdropImage}
            blurRadius={Platform.OS === 'ios' ? 18 : 10}
            resizeMode="cover"
          />
        ) : null}

        <View style={[styles.glassFrostedScrim, { backgroundColor: '#130B2288' }]} />
      </Animated.View>

      {/* Ultra-Smooth Dual-Layer Ambient Edge Bleed */}
      {isAmbientGlowEnabled ? (
        <Animated.View
          style={[
            styles.ambientGlowContainer,
            {
              opacity: fullPlayerOpacity,
            },
          ]}
          pointerEvents="none"
        >
          {/* Left Ambient Bleed */}
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
                <LinearGradient id="leftSoftWash" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={primaryGlowColor} stopOpacity="0.55" />
                  <Stop offset="20%" stopColor={primaryGlowColor} stopOpacity="0.30" />
                  <Stop offset="45%" stopColor={primaryGlowColor} stopOpacity="0.12" />
                  <Stop offset="70%" stopColor={primaryGlowColor} stopOpacity="0.03" />
                  <Stop offset="90%" stopColor={primaryGlowColor} stopOpacity="0.005" />
                  <Stop offset="100%" stopColor={primaryGlowColor} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={GLOW_WIDTH} height={SCREEN_HEIGHT} fill="url(#leftSoftWash)" />
            </Svg>
          </Animated.View>

          {/* Right Ambient Bleed */}
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
                <LinearGradient id="rightSoftWash" x1="100%" y1="0%" x2="0%" y2="0%">
                  <Stop offset="0%" stopColor={secondaryGlowColor} stopOpacity="0.55" />
                  <Stop offset="20%" stopColor={secondaryGlowColor} stopOpacity="0.30" />
                  <Stop offset="45%" stopColor={secondaryGlowColor} stopOpacity="0.12" />
                  <Stop offset="70%" stopColor={secondaryGlowColor} stopOpacity="0.03" />
                  <Stop offset="90%" stopColor={secondaryGlowColor} stopOpacity="0.005" />
                  <Stop offset="100%" stopColor={secondaryGlowColor} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={GLOW_WIDTH} height={SCREEN_HEIGHT} fill="url(#rightSoftWash)" />
            </Svg>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Mini Player */}
      <Animated.View
        style={[styles.miniLayer, { opacity: miniPlayerOpacity }]}
        pointerEvents={isExpandedState ? 'none' : 'auto'}
      >
        <TouchableOpacity activeOpacity={1} onPress={expandSheet} style={styles.miniTouchable}>
          <View style={styles.miniProgressTrack}>
            <View
              style={[
                styles.miniProgressFill,
                { width: `${activeProgressFraction * 100}%`, backgroundColor: tokens.primary },
              ]}
            />
          </View>

          <View style={styles.miniContentRow}>
            <View
              style={[
                styles.miniArtContainer,
                { backgroundColor: tokens.surfaceVariant, borderRadius: shapes.md },
              ]}
            >
              {currentTrack.thumbnailUrl ? (
                <Image
                  source={{ uri: currentTrack.thumbnailUrl }}
                  style={styles.fullImage}
                  resizeMode="cover"
                />
              ) : (
                <Icon name="library" size={18} color={tokens.primary} />
              )}
            </View>

            <View style={styles.miniMetaCol}>
              <Text numberOfLines={1} style={[styles.miniTitle, { color: tokens.onSurface }]}>
                {currentTrack.title}
              </Text>
              <Text numberOfLines={1} style={[styles.miniSubtitle, { color: tokens.onSurfaceVariant }]}>
                {currentTrack.artist}
              </Text>
            </View>

            <M3Pressable
              onPress={onTogglePlay}
              style={[styles.miniPlayCircle, { backgroundColor: tokens.primary }]}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={20} color="#FFFFFF" />
            </M3Pressable>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Full Player */}
      <Animated.View
        style={[
          styles.fullLayer,
          {
            opacity: fullPlayerOpacity,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        pointerEvents={isExpandedState ? 'auto' : 'none'}
      >
        <View style={styles.topAppBarRow}>
          <View style={styles.topLeftHeaderGroup}>
            <M3Pressable
              onPress={() => collapseSheet()}
              style={[styles.glassCircleButton, { borderColor: 'rgba(255, 255, 255, 0.14)' }]}
            >
              <Icon name="chevron-down" size={24} color={tokens.primary} />
            </M3Pressable>

            <View style={styles.nowPlayingTextGroup}>
              <Text style={[styles.nowPlayingText, { color: tokens.onSurface }]}>
                Now Playing
              </Text>
              <Text style={[styles.categoryBadgeText, { color: tokens.primary }]}>
                {categoryLabel}
              </Text>
            </View>
          </View>

          <M3Pressable
            onPress={handleOpenLibrary}
            style={[styles.glassCircleButton, { borderColor: 'rgba(255, 255, 255, 0.14)' }]}
          >
            <Icon name="queue" size={20} color={tokens.primary} />
          </M3Pressable>
        </View>

        {/* ─── Hero Artwork Section with 3D Depth ─── */}
        <View style={styles.artworkSection}>
          <View
            style={[
              styles.hero3DOuterShadowContainer,
              {
                width: ARTWORK_WIDTH,
                height: ARTWORK_HEIGHT,
                borderRadius: shapes.sheet,
              },
            ]}
          >
            <View
              style={[
                styles.heroArtworkBox,
                {
                  borderRadius: shapes.sheet,
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
              ]}
            >
              {currentTrack.thumbnailUrl ? (
                <Image
                  source={{ uri: currentTrack.thumbnailUrl }}
                  style={styles.heroArtworkImage}
                  resizeMode="cover"
                />
              ) : (
                <Icon name="library" size={96} color={tokens.primary} />
              )}

              {/* 3D Inner Bevel & Top-Light Specular Glaze */}
              <View style={[styles.inner3DBevelGleam, { borderRadius: shapes.sheet }]} pointerEvents="none" />
              <View style={[styles.inner3DBottomShadow, { borderRadius: shapes.sheet }]} pointerEvents="none" />
            </View>
          </View>
        </View>

        {/* Song Metadata */}
        <View style={styles.songMetadataRow}>
          <View style={styles.metaCol}>
            <Text numberOfLines={1} style={[styles.songTitle, { color: tokens.onSurface }]}>
              {currentTrack.title}
            </Text>
            <Text numberOfLines={1} style={[styles.songArtist, { color: tokens.onSurfaceVariant }]}>
              {currentTrack.artist}
            </Text>
          </View>
        </View>

        {/* Scrubber Section */}
        <View style={styles.scrubberSection}>
          <WavySliderExpressive
            progressFraction={activeProgressFraction}
            isPlaying={isPlaying}
            onSeekChange={(fraction) => setTargetSeekFraction(fraction)}
            onSeekCommit={handleSeekCommit}
            activeTrackColor={tokens.primary}
            inactiveTrackColor="rgba(255, 255, 255, 0.18)"
            thumbColor={tokens.primary}
            trackWidth={SCRUBBER_TRACK_WIDTH}
          />

          <View style={styles.timeLabelRow}>
            <Text style={[styles.timeLabelText, { color: tokens.onSurfaceVariant }]}>
              {formatDuration(activeProgressFraction * totalDuration)}
            </Text>

            <Text style={[styles.timeLabelText, { color: tokens.onSurfaceVariant }]}>
              {formatDuration(totalDuration)}
            </Text>
          </View>
        </View>

        {/* 3-Button Animated Playback Controls (Jitter-free expansion) */}
        <View style={styles.playbackControlsRow}>
          <Animated.View style={[styles.transportCol, { flex: prevWeight }]}>
            <M3Pressable
              onPress={() => {
                triggerButtonExpansion('prev');
                onPrev();
              }}
              pressedScale={0.93}
              style={[
                styles.transportSideButton,
                { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: shapes.pill },
              ]}
            >
              <Icon name="skip-prev" size={32} color={tokens.onSurface} />
            </M3Pressable>
          </Animated.View>

          <Animated.View style={[styles.transportCol, { flex: playWeight }]}>
            <M3Pressable
              onPress={() => {
                triggerButtonExpansion('play');
                onTogglePlay();
              }}
              pressedScale={0.93}
              style={[
                styles.transportPlayButton,
                {
                  backgroundColor: tokens.primary,
                  borderRadius: isPlaying ? 26 : 60,
                },
              ]}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={38} color="#FFFFFF" />
            </M3Pressable>
          </Animated.View>

          <Animated.View style={[styles.transportCol, { flex: nextWeight }]}>
            <M3Pressable
              onPress={() => {
                triggerButtonExpansion('next');
                onNext();
              }}
              pressedScale={0.93}
              style={[
                styles.transportSideButton,
                { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: shapes.pill },
              ]}
            >
              <Icon name="skip-next" size={32} color={tokens.onSurface} />
            </M3Pressable>
          </Animated.View>
        </View>

        {/* Bottom Toggle Segmented Row */}
        <View style={[styles.bottomToggleBar, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <M3Pressable
            onPress={handleToggleShufflePress}
            style={[
              styles.toggleSegment,
              {
                backgroundColor: isShuffle ? tokens.primaryContainer : 'transparent',
                borderRadius: shapes.pill,
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: shuffleBounceAnim }] }}>
              <Icon
                name="shuffle"
                size={22}
                color={isShuffle ? tokens.primary : tokens.onSurfaceVariant}
              />
            </Animated.View>
          </M3Pressable>

          <M3Pressable
            onPress={handleToggleRepeatPress}
            style={[
              styles.toggleSegment,
              {
                backgroundColor: repeatMode !== 'off' ? tokens.primaryContainer : 'transparent',
                borderRadius: shapes.pill,
              },
            ]}
          >
            <View style={styles.repeatIconContainer}>
              <Animated.View style={{ transform: [{ scale: repeatBounceAnim }] }}>
                <Icon
                  name="repeat"
                  size={22}
                  color={repeatMode !== 'off' ? tokens.primary : tokens.onSurfaceVariant}
                />
              </Animated.View>
              <View
                style={[
                  styles.repeatBadge,
                  {
                    backgroundColor:
                      repeatMode === 'off' ? tokens.outline : tokens.primary,
                  },
                ]}
              >
                <Text style={styles.repeatBadgeText}>
                  {repeatMode === 'one' ? '1' : repeatMode === 'all' ? 'ALL' : 'OFF'}
                </Text>
              </View>
            </View>
          </M3Pressable>

          <M3Pressable
            onPress={handleToggleFavoritePress}
            style={[
              styles.toggleSegment,
              {
                backgroundColor: isFavoriteOptimistic ? tokens.primaryContainer : 'transparent',
                borderRadius: shapes.pill,
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: favoriteBounceAnim }] }}>
              <Icon
                name={isFavoriteOptimistic ? 'heart-filled' : 'heart-outline'}
                size={22}
                color={isFavoriteOptimistic ? tokens.accentPink : tokens.onSurfaceVariant}
              />
            </Animated.View>
          </M3Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheetRoot: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  blurredBackdropContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  blurredBackdropImage: {
    ...StyleSheet.absoluteFill,
    width: '120%',
    height: '120%',
    left: '-10%',
    top: '-10%',
    transform: [{ scale: 1.25 }],
  },
  glassFrostedScrim: {
    ...StyleSheet.absoluteFill,
  },
  ambientGlowContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
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
    left: -6,
    top: '15%',
    bottom: '15%',
    width: 10,
    opacity: 0.65,
    borderRadius: 5,
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 22,
    elevation: 12,
  },
  nativeGlowBezelRight: {
    position: 'absolute',
    right: -6,
    top: '15%',
    bottom: '15%',
    width: 10,
    opacity: 0.65,
    borderRadius: 5,
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 22,
    elevation: 12,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  miniLayer: {
    ...StyleSheet.absoluteFill,
  },
  miniTouchable: {
    flex: 1,
  },
  miniProgressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  miniProgressFill: {
    height: '100%',
  },
  miniContentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  miniArtContainer: {
    width: 44,
    height: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMetaCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  miniSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  miniPlayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullLayer: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  topAppBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
  },
  topLeftHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nowPlayingTextGroup: {
    justifyContent: 'center',
  },
  nowPlayingText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  glassCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
  },
  artworkSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  hero3DOuterShadowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.75,
    shadowRadius: 28,
    elevation: 22,
  },
  heroArtworkBox: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
    borderRightColor: 'rgba(0, 0, 0, 0.45)',
    borderBottomColor: 'rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    position: 'relative',
  },
  heroArtworkImage: {
    width: '100%',
    height: '135%',
  },
  inner3DBevelGleam: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: 2.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.65)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  inner3DBottomShadow: {
    ...StyleSheet.absoluteFill,
    borderBottomWidth: 3,
    borderRightWidth: 1.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.65)',
    borderRightColor: 'rgba(0, 0, 0, 0.45)',
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  songMetadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    minHeight: 52,
  },
  metaCol: {
    flex: 1,
  },
  songTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  songArtist: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 3,
  },
  scrubberSection: {
    width: '100%',
    paddingVertical: 4,
  },
  timeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  timeLabelText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  playbackControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    paddingHorizontal: 2,
  },
  transportCol: {
    height: 80,
    paddingHorizontal: 3,
  },
  transportSideButton: {
    height: 80,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  transportPlayButton: {
    height: 80,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomToggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 68,
    borderRadius: 60,
    padding: 6,
    marginHorizontal: 8,
    gap: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  toggleSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  repeatBadge: {
    position: 'absolute',
    top: -6,
    right: -12,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  repeatBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});