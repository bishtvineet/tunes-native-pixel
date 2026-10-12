import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../../components/common/Icon';
import { SongCard } from '../../components/cards/SongCard';
import { pruneStaleStorage } from '../../services/storage';
import type { Track, PlaybackContext } from '../../types';

interface LibraryScreenProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  storageUsage: string;
  onPlayTrack: (track: Track, context: PlaybackContext, queue: Track[]) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteTrack: (id: string) => void;
  onRefreshLibrary: () => Promise<void>;
}

type LibraryTabFilter = 'ALL' | 'FAVORITES' | 'STORAGE';

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  storageUsage,
  onPlayTrack,
  onToggleFavorite,
  onDeleteTrack,
  onRefreshLibrary,
}) => {
  const { tokens, shapes } = useTheme();

  const [activeTab, setActiveTab] = useState<LibraryTabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanNotice, setCleanNotice] = useState<string | null>(null);

  // Exclusive separation: Favorites move out of the All Tracks list
  const nonFavoriteTracks = useMemo(
    () => tracks.filter((t) => !t.isFavorite),
    [tracks]
  );
  const favoriteTracks = useMemo(
    () => tracks.filter((t) => t.isFavorite),
    [tracks]
  );

  // Tab Selection
  const filteredByTab = useMemo(() => {
    if (activeTab === 'FAVORITES') {
      return favoriteTracks;
    }
    return nonFavoriteTracks;
  }, [nonFavoriteTracks, favoriteTracks, activeTab]);

  // Search Query Filtering
  const displayedTracks = useMemo(() => {
    if (!searchQuery.trim()) return filteredByTab;
    const q = searchQuery.toLowerCase();
    return filteredByTab.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
    );
  }, [filteredByTab, searchQuery]);

  const handlePruneStorage = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    setCleanNotice(null);
    try {
      const res = await pruneStaleStorage();
      await onRefreshLibrary();
      setCleanNotice(
        res.prunedCount > 0
          ? `Cleaned ${res.prunedCount} orphaned file(s) successfully.`
          : 'Storage is clean. No orphaned files detected.'
      );
    } catch {
      setCleanNotice('Failed to complete storage cleanup.');
    } finally {
      setIsCleaning(false);
      setTimeout(() => setCleanNotice(null), 4000);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Screen Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: tokens.onSurface }]}>Your Library</Text>
          <Text style={[styles.subtitle, { color: tokens.onSurfaceVariant }]}>
            {tracks.length} offline {tracks.length === 1 ? 'song' : 'songs'} saved
          </Text>
        </View>

        {/* Storage Size Badge */}
        <View
          style={[
            styles.storageBadge,
            {
              backgroundColor: tokens.surfaceVariant,
              borderRadius: shapes.pill,
              borderColor: tokens.outline,
            },
          ]}
        >
          <Icon name="library" size={14} color={tokens.primary} />
          <Text style={[styles.storageText, { color: tokens.onSurface }]}>{storageUsage}</Text>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchIcon}>
          <Icon name="search" size={18} color={tokens.outline} />
        </View>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filter songs or artists..."
          placeholderTextColor={tokens.onSurfaceVariant}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.searchInput,
            {
              backgroundColor: tokens.surfaceVariant,
              color: tokens.onSurface,
              borderRadius: shapes.md,
            },
          ]}
        />
      </View>

      {/* Sub-Tabs Row */}
      <View style={styles.pillRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('ALL')}
          style={[
            styles.pill,
            {
              borderRadius: shapes.pill,
              backgroundColor: activeTab === 'ALL' ? tokens.primary : tokens.surfaceVariant,
            },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: activeTab === 'ALL' ? '#FFFFFF' : tokens.onSurfaceVariant },
            ]}
          >
            All Tracks ({nonFavoriteTracks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('FAVORITES')}
          style={[
            styles.pill,
            {
              borderRadius: shapes.pill,
              backgroundColor:
                activeTab === 'FAVORITES' ? tokens.primary : tokens.surfaceVariant,
            },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: activeTab === 'FAVORITES' ? '#FFFFFF' : tokens.onSurfaceVariant },
            ]}
          >
            Favorites ({favoriteTracks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('STORAGE')}
          style={[
            styles.pill,
            {
              borderRadius: shapes.pill,
              backgroundColor:
                activeTab === 'STORAGE' ? tokens.primary : tokens.surfaceVariant,
            },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: activeTab === 'STORAGE' ? '#FFFFFF' : tokens.onSurfaceVariant },
            ]}
          >
            Storage
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 3 View: Storage Manager */}
      {activeTab === 'STORAGE' ? (
        <View
          style={[
            styles.storageCard,
            {
              backgroundColor: tokens.surfaceVariant,
              borderRadius: shapes.lg,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: tokens.onSurface }]}>Disk Management</Text>
          <Text style={[styles.cardDesc, { color: tokens.onSurfaceVariant }]}>
            All audio files are saved in the permanent app sandbox. You can clean up broken or
            incomplete downloads to free up storage space.
          </Text>

          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: tokens.onSurfaceVariant }]}>Total Audio Space</Text>
            <Text style={[styles.statValue, { color: tokens.primary }]}>{storageUsage}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: tokens.onSurfaceVariant }]}>Downloaded Tracks</Text>
            <Text style={[styles.statValue, { color: tokens.onSurface }]}>{tracks.length}</Text>
          </View>

          {cleanNotice && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{cleanNotice}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handlePruneStorage}
            disabled={isCleaning}
            style={[
              styles.cleanupBtn,
              {
                backgroundColor: tokens.primary,
                borderRadius: shapes.pill,
                opacity: isCleaning ? 0.6 : 1,
              },
            ]}
          >
            {isCleaning ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.cleanupBtnText}>Prune Orphaned Files</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* Tabs 1 & 2 View: Track List */
        <View style={styles.trackListContainer}>
          {displayedTracks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="library" size={48} color={tokens.outline} />
              <Text style={[styles.emptyTitle, { color: tokens.onSurface }]}>
                {activeTab === 'FAVORITES' ? 'No favorites yet' : 'No un-favorited tracks'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: tokens.onSurfaceVariant }]}>
                {activeTab === 'FAVORITES'
                  ? 'Tap the heart icon on any track to add it to your favorites.'
                  : 'All your tracks are currently marked as favorites.'}
              </Text>
            </View>
          ) : (
            displayedTracks.map((track) => (
              <SongCard
                key={track.id}
                song={track}
                isPlaying={currentTrack?.id === track.id && isPlaying}
                onPress={() =>
                  onPlayTrack(
                    track,
                    activeTab === 'FAVORITES' ? 'Favorite' : 'All',
                    displayedTracks
                  )
                }
                onToggleFavorite={() => onToggleFavorite(track.id)}
                onDelete={() => onDeleteTrack(track.id)}
              />
            ))
          )}
        </View>
      )}
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
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  storageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  storageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchWrapper: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 14,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 2,
  },
  searchInput: {
    height: 44,
    paddingLeft: 38,
    paddingRight: 14,
    fontSize: 13,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trackListContainer: {
    gap: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    marginTop: 6,
    lineHeight: 18,
  },
  storageCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    fontSize: 13,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  cleanupBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  cleanupBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  noticeBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
  },
  noticeText: {
    color: '#34D399',
    fontSize: 12,
    textAlign: 'center',
  },
});