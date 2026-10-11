import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../common/Icon';
import { formatDuration } from '../../utils/audio';
import type { Track, RepeatMode, PlaybackContext } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCRUBBER_BAR_WIDTH = SCREEN_WIDTH - 48;

interface FullPlayerSheetProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  repeatMode: RepeatMode;
  playbackContext: PlaybackContext;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleRepeat: () => void;
}

export const FullPlayerSheet: React.FC<FullPlayerSheetProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  repeatMode,
  playbackContext,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onToggleRepeat,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tokens, shapes } = useTheme();
  const insets = useSafeAreaInsets();

  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let waveLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (isPlaying) {
      waveLoop = Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      waveLoop.start();
      pulseLoop.start();
    } else {
      waveAnim.setValue(0);
      pulseAnim.setValue(0);
    }

    return () => {
      waveLoop?.stop();
      pulseLoop?.stop();
    };
  }, [isPlaying]);

  if (!currentTrack) return null;

  const totalDuration = duration || currentTrack.duration || 1;
  const progressPercent = Math.min(Math.max(0, (currentTime / totalDuration) * 100), 100);

  const waveTranslateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60],
  });

  const snakeTranslateY = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-2.5, 2.5],
  });

  const snakeScaleY = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.4, 1],
  });

  return (
    <>
      {/* 1. Floating Docked Mini Player Pill */}
      <View
        style={[
          styles.miniPlayerContainer,
          { bottom: insets.bottom > 0 ? insets.bottom + 76 : 84 },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setIsExpanded(true)}
          style={[
            styles.miniPlayerCard,
            { backgroundColor: tokens.surfaceVariant, borderRadius: shapes.md },
          ]}
        >
          <View style={styles.miniProgressTrack}>
            <View
              style={[
                styles.miniProgressFill,
                { width: `${progressPercent}%`, backgroundColor: tokens.primary },
              ]}
            />
          </View>

          <View style={styles.miniContentRow}>
            <View style={[styles.miniArtWrapper, { borderRadius: shapes.sm }]}>
              {currentTrack.thumbnailUrl ? (
                <Image source={{ uri: currentTrack.thumbnailUrl }} style={styles.artImage} />
              ) : (
                <View style={[styles.artPlaceholder, { backgroundColor: tokens.primaryContainer }]}>
                  <Icon name="library" size={16} color={tokens.primary} />
                </View>
              )}
            </View>

            <View style={styles.miniMetaCol}>
              <Text numberOfLines={1} style={[styles.miniTitle, { color: tokens.onSurface }]}>
                {currentTrack.title}
              </Text>
              <Text numberOfLines={1} style={[styles.miniSubtitle, { color: tokens.onSurfaceVariant }]}>
                {currentTrack.artist} • {playbackContext}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                onTogglePlay();
              }}
              style={[
                styles.miniPlayBtn,
                { backgroundColor: tokens.primary, borderRadius: shapes.pill },
              ]}
            >
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Fullscreen Expanded Player Sheet */}
      <Modal
        visible={isExpanded}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsExpanded(false)}
      >
        <View style={[styles.modalSheet, { backgroundColor: tokens.surface }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsExpanded(false)} style={styles.closeBtn}>
              <Icon name="chevron-down" size={24} color={tokens.onSurface} />
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              <Text style={[styles.headerContextBadge, { color: tokens.primary }]}>
                PLAYING FROM {playbackContext.toUpperCase()}
              </Text>
              <Text style={[styles.headerSubtitle, { color: tokens.onSurfaceVariant }]}>
                Offline Storage
              </Text>
            </View>

            <TouchableOpacity
              onPress={onToggleRepeat}
              style={[
                styles.repeatBtn,
                repeatMode !== 'off' && { backgroundColor: tokens.primaryContainer },
              ]}
            >
              <Icon
                name="repeat"
                size={20}
                color={repeatMode !== 'off' ? tokens.primary : tokens.outline}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.artworkSection}>
            <View
              style={[
                styles.largeArtworkWrapper,
                {
                  borderRadius: shapes.lg,
                  backgroundColor: tokens.surfaceVariant,
                  shadowColor: tokens.primary,
                },
              ]}
            >
              {currentTrack.thumbnailUrl ? (
                <Image source={{ uri: currentTrack.thumbnailUrl }} style={styles.artImage} />
              ) : (
                <Icon name="library" size={80} color={tokens.outline} />
              )}
            </View>

            <View style={styles.largeMetaSection}>
              <Text style={[styles.largeTitle, { color: tokens.onSurface }]} numberOfLines={2}>
                {currentTrack.title}
              </Text>
              <Text style={[styles.largeArtist, { color: tokens.onSurfaceVariant }]} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
          </View>

          <View style={styles.playerControlsSection}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.scrubberTouchArea}
              onPress={(e) => {
                const { locationX } = e.nativeEvent;
                const percent = Math.min(Math.max(0, locationX / SCRUBBER_BAR_WIDTH), 1);
                onSeek(Math.floor(percent * totalDuration));
              }}
            >
              <View style={[styles.scrubberTrack, { backgroundColor: tokens.surfaceVariant }]}>
                <View
                  style={[
                    styles.scrubberFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: tokens.primary,
                    },
                  ]}
                >
                  {isPlaying && (
                    <Animated.View
                      style={[
                        styles.snakeWaveSegment,
                        {
                          backgroundColor: tokens.accentPink,
                          transform: [
                            { translateY: snakeTranslateY },
                            { scaleY: snakeScaleY },
                          ],
                        },
                      ]}
                    />
                  )}
                  {isPlaying && (
                    <Animated.View
                      style={[
                        styles.waveShimmerGlow,
                        { transform: [{ translateX: waveTranslateX }] },
                      ]}
                    />
                  )}
                </View>

                {progressPercent > 0 && (
                  <Animated.View
                    style={[
                      styles.snakeHeadPip,
                      {
                        left: `${progressPercent}%`,
                        borderColor: tokens.primary,
                        transform: [
                          { translateX: -6 },
                          { translateY: isPlaying ? snakeTranslateY : 0 },
                        ],
                      },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.timeRow}>
              <Text style={[styles.timeText, { color: tokens.onSurfaceVariant }]}>
                {formatDuration(currentTime)}
              </Text>
              <Text style={[styles.timeText, { color: tokens.onSurfaceVariant }]}>
                {formatDuration(totalDuration)}
              </Text>
            </View>

            <View style={styles.transportButtonsRow}>
              <TouchableOpacity onPress={onPrev} style={styles.transportBtn}>
                <Icon name="skip-prev" size={32} color={tokens.onSurface} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onTogglePlay}
                style={[
                  styles.largePlayBtn,
                  { backgroundColor: tokens.primary, borderRadius: shapes.pill },
                ]}
              >
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={32}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={onNext} style={styles.transportBtn}>
                <Icon name="skip-next" size={32} color={tokens.onSurface} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  miniPlayerContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 45,
  },
  miniPlayerCard: {
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  miniArtWrapper: {
    width: 42,
    height: 42,
    overflow: 'hidden',
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  artPlaceholder: {
    flex: 1,
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
    fontWeight: '600',
  },
  miniSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  miniPlayBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSheet: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    padding: 8,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerContextBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  repeatBtn: {
    padding: 8,
    borderRadius: 16,
  },
  artworkSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  largeArtworkWrapper: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    maxWidth: 320,
    maxHeight: 320,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  largeMetaSection: {
    marginTop: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  largeTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  largeArtist: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  playerControlsSection: {
    width: '100%',
  },
  scrubberTouchArea: {
    paddingVertical: 12,
  },
  scrubberTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    position: 'relative',
    justifyContent: 'center',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 2.5,
    overflow: 'hidden',
    position: 'relative',
  },
  snakeWaveSegment: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.8,
  },
  waveShimmerGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  snakeHeadPip: {
    position: 'absolute',
    top: -3.5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    zIndex: 10,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  transportButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 18,
    paddingHorizontal: 24,
  },
  transportBtn: {
    padding: 8,
  },
  largePlayBtn: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
});