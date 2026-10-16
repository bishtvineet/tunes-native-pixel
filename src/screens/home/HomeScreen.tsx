import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../../components/common/Icon';
import { SongCard } from '../../components/cards/SongCard';
import { M3Pressable } from '../../components/common/M3Pressable';
import { AppText } from '../../components/common/AppText';
import { getElevation } from '../../theme/elevation';
import type { Track, PlaybackContext } from '../../types';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.52, 200);

interface HomeScreenProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, context: PlaybackContext, queue: Track[]) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (id: string) => void;
  onDeleteTrack: (id: string) => void;
  onNavigateTab: (tab: 'Download' | 'Library') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
  onToggleFavorite,
  onDeleteTrack,
  onNavigateTab,
}) => {
  const { tokens, shapes } = useTheme();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const morphProgress = useRef(new Animated.Value(0)).current;

  const favoriteTracks = tracks.filter((t) => t.isFavorite);
  const recentTracks = tracks.slice(0, 6);
  const featuredTracks = tracks.slice(0, 6);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
    );
  }, [tracks, searchQuery]);

  const openSearch = () => {
    setIsSearchOpen(true);
    Animated.timing(morphProgress, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };

  const closeSearch = () => {
    searchInputRef.current?.blur();
    Animated.timing(morphProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.4, 0.0, 1.0, 1.0),
      useNativeDriver: false,
    }).start(() => {
      setIsSearchOpen(false);
      setSearchQuery('');
    });
  };

  const handleShuffleAll = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    onPlayTrack(shuffled[0], 'All', shuffled);
  };

  const handleTrackCardPress = (track: Track) => {
    if (currentTrack?.id === track.id) {
      onTogglePlay();
    } else {
      onPlayTrack(track, 'All', tracks);
    }
  };

  const confirmDeleteTrack = (track: Track) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${track.title}" from offline storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch {}
            onDeleteTrack(track.id);
          },
        },
      ]
    );
  };

  const titleOpacity = morphProgress.interpolate({
    inputRange: [0, 0.35],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const searchPillOpacity = morphProgress.interpolate({
    inputRange: [0.15, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const searchPillScale = morphProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
    extrapolate: 'clamp',
  });

  const iconRotation = morphProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─── 1. Header with Material 3 Morph ─── */}
      <View style={styles.headerRegion}>
        <Animated.View
          style={[styles.defaultHeaderRow, { opacity: titleOpacity }]}
          pointerEvents={isSearchOpen ? 'none' : 'auto'}
        >
          <View>
            <AppText variant="secondary" style={styles.welcomeBadge}>
              OFFLINE MUSIC
            </AppText>
            <AppText style={styles.mainBrandTitle}>LaviMusic</AppText>
          </View>

          <M3Pressable
            onPress={openSearch}
            style={[
              styles.headerSearchCircle,
              {
                backgroundColor: tokens.surfaceVariant,
                borderRadius: shapes.pill,
                borderColor: tokens.outline,
              },
            ]}
          >
            <Icon name="search" size={20} color={tokens.primary} />
          </M3Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.m3SearchPill,
            {
              opacity: searchPillOpacity,
              transform: [{ scale: searchPillScale }],
              backgroundColor: tokens.surface,
              borderRadius: shapes.pill,
              borderColor: tokens.primary,
            },
          ]}
          pointerEvents={isSearchOpen ? 'auto' : 'none'}
        >
          <View style={styles.leadingSearchIcon}>
            <Icon name="search" size={18} color={tokens.primary} />
          </View>

          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search offline tracks..."
            placeholderTextColor={tokens.onSurfaceVariant}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.m3SearchInput, { color: tokens.onSurface }]}
          />

          <M3Pressable
            onPress={closeSearch}
            style={[
              styles.trailingCloseBtn,
              { backgroundColor: tokens.surfaceVariant, borderRadius: shapes.pill },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
              <Icon name="close" size={16} color={tokens.primary} />
            </Animated.View>
          </M3Pressable>
        </Animated.View>
      </View>

      {/* ─── 2. Search Live Results View ─── */}
      {isSearchOpen && searchQuery.trim().length > 0 ? (
        <View style={styles.searchResultsSection}>
          <View style={styles.resultsHeaderRow}>
            <AppText variant="secondary" style={styles.resultsLabel}>
              MATCHING SONGS ({searchResults.length})
            </AppText>
          </View>

          {searchResults.length === 0 ? (
            <View
              style={[
                styles.noMatchCard,
                { backgroundColor: tokens.surface, borderRadius: shapes.md },
              ]}
            >
              <Icon name="library" size={32} color={tokens.outline} />
              <AppText variant="secondary" style={styles.noMatchText}>
                No offline tracks match "{searchQuery}"
              </AppText>
            </View>
          ) : (
            searchResults.map((track) => (
              <SongCard
                key={track.id}
                song={track}
                isPlaying={currentTrack?.id === track.id && isPlaying}
                onPress={() => {
                  handleTrackCardPress(track);
                  closeSearch();
                }}
                onToggleFavorite={() => onToggleFavorite(track.id)}
                onDelete={() => confirmDeleteTrack(track)}
              />
            ))
          )}
        </View>
      ) : (
        <>
          {/* ─── 3. Quick Action Chips with M3 Press ─── */}
          <View style={styles.chipRow}>
            <M3Pressable
              onPress={handleShuffleAll}
              style={[
                styles.quickChip,
                {
                  backgroundColor: tokens.surface,
                  borderRadius: shapes.pill,
                  borderColor: tokens.outline,
                  opacity: tracks.length === 0 ? 0.45 : 1,
                },
              ]}
            >
              <Icon name="shuffle" size={15} color={tokens.primary} />
              <AppText style={styles.quickChipText}>Shuffle All</AppText>
            </M3Pressable>

            <M3Pressable
              onPress={() => onNavigateTab('Library')}
              style={[
                styles.quickChip,
                {
                  backgroundColor: tokens.surface,
                  borderRadius: shapes.pill,
                  borderColor: tokens.outline,
                },
              ]}
            >
              <Icon name="heart-filled" size={15} color={tokens.accentPink} />
              <AppText style={styles.quickChipText}>
                Favorites ({favoriteTracks.length})
              </AppText>
            </M3Pressable>
          </View>

          {/* ─── 4. Daily Discover Carousel ─── */}
          <View style={styles.sectionHeader}>
            <AppText style={styles.sectionTitle}>Daily Discover</AppText>
            <AppText variant="secondary" style={styles.sectionSubtitle}>
              Curated from your downloads
            </AppText>
          </View>

          {featuredTracks.length === 0 ? (
            <View
              style={[
                styles.emptyDiscoverBox,
                {
                  backgroundColor: tokens.surface,
                  borderRadius: shapes.lg,
                  borderColor: tokens.outline,
                },
              ]}
            >
              <Icon name="library" size={40} color={tokens.primary} />
              <AppText style={styles.emptyDiscoverTitle}>No offline audio yet</AppText>
              <AppText variant="secondary" style={styles.emptyDiscoverSub}>
                Tap the Download tab to download and listen to YouTube tracks offline.
              </AppText>
              <M3Pressable
                onPress={() => onNavigateTab('Download')}
                style={[
                  styles.emptyDiscoverBtn,
                  { backgroundColor: tokens.primary, borderRadius: shapes.pill },
                ]}
              >
                <AppText style={styles.emptyDiscoverBtnText}>Download Track</AppText>
              </M3Pressable>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
            >
              {featuredTracks.map((item) => {
                const isThisTrack = currentTrack?.id === item.id;
                const isThisPlaying = isThisTrack && isPlaying;

                return (
                  <M3Pressable
                    key={item.id}
                    onPress={() => handleTrackCardPress(item)}
                    style={[
                      styles.carouselCard,
                      getElevation(2),
                      {
                        width: CAROUSEL_CARD_WIDTH,
                        backgroundColor: tokens.surface,
                        borderRadius: shapes.lg,
                        borderColor: isThisTrack ? tokens.primary : tokens.outline,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.carouselArtWrapper,
                        {
                          borderRadius: shapes.md,
                          backgroundColor: tokens.surfaceVariant,
                        },
                      ]}
                    >
                      {item.thumbnailUrl ? (
                        <Image source={{ uri: item.thumbnailUrl }} style={styles.fullImage} />
                      ) : (
                        <View style={styles.fallbackArt}>
                          <Icon name="library" size={32} color={tokens.primary} />
                        </View>
                      )}

                      <M3Pressable
                        onPress={() => handleTrackCardPress(item)}
                        style={[
                          styles.playPipContainer,
                          {
                            backgroundColor: tokens.primary,
                            borderRadius: shapes.pill,
                          },
                        ]}
                      >
                        <Icon
                          name={isThisPlaying ? 'pause' : 'play'}
                          size={16}
                          color="#FFFFFF"
                        />
                      </M3Pressable>
                    </View>

                    <View style={styles.carouselMeta}>
                      <AppText numberOfLines={1} style={styles.carouselTitle}>
                        {item.title}
                      </AppText>
                      <AppText numberOfLines={1} variant="secondary" style={styles.carouselSubtitle}>
                        {item.artist}
                      </AppText>
                    </View>
                  </M3Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* ─── 5. Recently Added Tracks ─── */}
          <View style={[styles.sectionHeader, { marginTop: 22 }]}>
            <AppText style={styles.sectionTitle}>Recently Added</AppText>
            <M3Pressable onPress={() => onNavigateTab('Library')}>
              <AppText variant="accent" style={styles.seeAllLink}>
                View Library
              </AppText>
            </M3Pressable>
          </View>

          <View style={styles.recentList}>
            {recentTracks.map((track) => (
              <SongCard
                key={track.id}
                song={track}
                isPlaying={currentTrack?.id === track.id && isPlaying}
                onPress={() => handleTrackCardPress(track)}
                onToggleFavorite={() => onToggleFavorite(track.id)}
                onDelete={() => confirmDeleteTrack(track)}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 150,
  },
  headerRegion: {
    height: 52,
    marginBottom: 14,
    position: 'relative',
    justifyContent: 'center',
  },
  defaultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  welcomeBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  mainBrandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerSearchCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  m3SearchPill: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  leadingSearchIcon: {
    marginRight: 8,
  },
  m3SearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  trailingCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  searchResultsSection: {
    marginTop: 4,
    gap: 4,
  },
  resultsHeaderRow: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  resultsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  noMatchCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  noMatchText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  carouselContainer: {
    gap: 12,
    paddingRight: 16,
  },
  carouselCard: {
    padding: 8,
    borderWidth: 1.5,
  },
  carouselArtWrapper: {
    width: '100%',
    height: 116,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fallbackArt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPipContainer: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  carouselMeta: {
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  carouselTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  carouselSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyDiscoverBox: {
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emptyDiscoverTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyDiscoverSub: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 240,
    marginTop: 4,
    lineHeight: 16,
  },
  emptyDiscoverBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyDiscoverBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    gap: 4,
  },
});