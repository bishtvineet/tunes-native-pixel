import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../../components/common/Icon';
import { SongCard } from '../../components/cards/SongCard';
import type { Track, PlaybackContext } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH * 0.72;

interface HomeScreenProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, context: PlaybackContext, queue: Track[]) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteTrack: (id: string) => void;
  onNavigateTab: (tab: 'Search' | 'Library') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onToggleFavorite,
  onDeleteTrack,
  onNavigateTab,
}) => {
  const { tokens, shapes } = useTheme();

  const favoriteTracks = tracks.filter((t) => t.isFavorite);
  const recentTracks = tracks.slice(0, 5);
  const featuredTracks = tracks.slice(0, 4);

  const handleShuffleAll = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    onPlayTrack(shuffled[0], 'All', shuffled);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Hero Greeting */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.welcomeText, { color: tokens.onSurfaceVariant }]}>
            Offline Audio
          </Text>
          <Text style={[styles.mainHeading, { color: tokens.onSurface }]}>
            PixelMusic
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => onNavigateTab('Search')}
          style={[
            styles.headerActionPill,
            {
              backgroundColor: tokens.primaryContainer,
              borderRadius: shapes.pill,
            },
          ]}
        >
          <Icon name="search" size={16} color={tokens.primary} />
          <Text style={[styles.headerActionText, { color: tokens.primary }]}>
            Download
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Quick Action Chips */}
      <View style={styles.chipRow}>
        <TouchableOpacity
          onPress={handleShuffleAll}
          disabled={tracks.length === 0}
          style={[
            styles.quickChip,
            {
              backgroundColor: tokens.surfaceVariant,
              borderRadius: shapes.pill,
              opacity: tracks.length === 0 ? 0.5 : 1,
            },
          ]}
        >
          <Icon name="shuffle" size={16} color={tokens.primary} />
          <Text style={[styles.quickChipText, { color: tokens.onSurface }]}>
            Shuffle All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onNavigateTab('Library')}
          style={[
            styles.quickChip,
            {
              backgroundColor: tokens.surfaceVariant,
              borderRadius: shapes.pill,
            },
          ]}
        >
          <Icon name="heart-filled" size={16} color={tokens.accentPink} />
          <Text style={[styles.quickChipText, { color: tokens.onSurface }]}>
            Favorites ({favoriteTracks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Daily Discover Carousel Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: tokens.onSurface }]}>
          Daily Discover
        </Text>
        <Text style={[styles.sectionSubtitle, { color: tokens.onSurfaceVariant }]}>
          Recommended offline tracks
        </Text>
      </View>

      {featuredTracks.length === 0 ? (
        <View
          style={[
            styles.emptyHeroCard,
            {
              backgroundColor: tokens.surfaceVariant,
              borderRadius: shapes.lg,
            },
          ]}
        >
          <Icon name="library" size={40} color={tokens.outline} />
          <Text style={[styles.emptyHeroTitle, { color: tokens.onSurface }]}>
            Your library is empty
          </Text>
          <Text style={[styles.emptyHeroSubtitle, { color: tokens.onSurfaceVariant }]}>
            Search and download tracks from YouTube to play offline.
          </Text>
          <TouchableOpacity
            onPress={() => onNavigateTab('Search')}
            style={[
              styles.emptyHeroBtn,
              {
                backgroundColor: tokens.primary,
                borderRadius: shapes.pill,
              },
            ]}
          >
            <Text style={styles.emptyHeroBtnText}>Add Music Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
        >
          {featuredTracks.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              onPress={() => onPlayTrack(item, 'All', tracks)}
              style={[
                styles.carouselCard,
                {
                  width: CAROUSEL_CARD_WIDTH,
                  backgroundColor: tokens.surfaceVariant,
                  borderRadius: shapes.lg,
                },
              ]}
            >
              <View style={[styles.carouselImageWrapper, { borderRadius: shapes.md }]}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.carouselImage} />
                ) : (
                  <View style={[styles.carouselPlaceholder, { backgroundColor: tokens.primaryContainer }]}>
                    <Icon name="library" size={32} color={tokens.primary} />
                  </View>
                )}
                <View style={styles.carouselPlayOverlay}>
                  <View
                    style={[
                      styles.carouselPlayPip,
                      { backgroundColor: tokens.primary, borderRadius: shapes.pill },
                    ]}
                  >
                    <Icon
                      name={currentTrack?.id === item.id && isPlaying ? 'pause' : 'play'}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              </View>

              <Text numberOfLines={1} style={[styles.carouselTitle, { color: tokens.onSurface }]}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={[styles.carouselArtist, { color: tokens.onSurfaceVariant }]}>
                {item.artist} • {item.durationFormatted}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 4. Recent Offline Additions */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={[styles.sectionTitle, { color: tokens.onSurface }]}>
          Recently Added
        </Text>
        <TouchableOpacity onPress={() => onNavigateTab('Library')}>
          <Text style={[styles.seeAllText, { color: tokens.primary }]}>View Library</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentList}>
        {recentTracks.map((track) => (
          <SongCard
            key={track.id}
            song={track}
            isPlaying={currentTrack?.id === track.id && isPlaying}
            onPress={() => onPlayTrack(track, 'All', tracks)}
            onToggleFavorite={() => onToggleFavorite(track.id)}
            onDelete={() => onDeleteTrack(track.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 160,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mainHeading: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  headerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  carouselContainer: {
    gap: 14,
    paddingRight: 20,
  },
  carouselCard: {
    padding: 12,
  },
  carouselImageWrapper: {
    width: '100%',
    height: 140,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselPlayOverlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
  },
  carouselPlayPip: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  carouselTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  carouselArtist: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyHeroCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeroTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyHeroSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
    marginTop: 4,
    lineHeight: 18,
  },
  emptyHeroBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyHeroBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    gap: 4,
  },
});