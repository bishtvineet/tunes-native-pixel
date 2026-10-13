import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../../components/common/Icon';
import { SongCard } from '../../components/cards/SongCard';
import {
  getCustomLibraries,
  createCustomLibrary,
  deleteCustomLibrary,
  toggleTrackInLibrary,
  type CustomLibrary,
} from '../../services/storage';
import type { Track, PlaybackContext } from '../../types';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SONG_CARD_HEIGHT = 76; // 68px item + 8px vertical margins

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
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [customLibs, setCustomLibs] = useState<CustomLibrary[]>([]);

  // Multi-Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const selectionBarAnim = useRef(new Animated.Value(0)).current;

  // Dialog & Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLibName, setNewLibName] = useState('');
  const [tracksToAssign, setTracksToAssign] = useState<Track[]>([]);

  // Swipe-to-Dismiss Sheet Animations
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  const loadLibraries = useCallback(async () => {
    const list = await getCustomLibraries();
    setCustomLibs(list);
  }, []);

  useEffect(() => {
    loadLibraries();
  }, [loadLibraries]);

  // Contextual Toolbar Animation
  useEffect(() => {
    Animated.spring(selectionBarAnim, {
      toValue: isSelectionMode ? 1 : 0,
      tension: 90,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isSelectionMode, selectionBarAnim]);

  // Assign Sheet Animation
  useEffect(() => {
    if (tracksToAssign.length > 0) {
      sheetTranslateY.setValue(SCREEN_HEIGHT * 0.4);
      Animated.parallel([
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 75,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [tracksToAssign, sheetTranslateY, scrimOpacity]);

  const closeAssignSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT * 0.5,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTracksToAssign([]);
    });
  }, [sheetTranslateY, scrimOpacity]);

  // Thumb Drag Responder for Slide Down Gesture
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          sheetTranslateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 110 || gesture.vy > 0.6) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          closeAssignSheet();
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            tension: 80,
            friction: 9,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // ─── Bulk Action Helpers ───

  const enterSelectionMode = (initialTrackId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    setIsSelectionMode(true);
    setSelectedTrackIds([initialTrackId]);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedTrackIds([]);
  };

  const toggleSelectTrack = (trackId: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedTrackIds((prev) => {
      if (prev.includes(trackId)) {
        const next = prev.filter((id) => id !== trackId);
        if (next.length === 0) {
          setIsSelectionMode(false);
        }
        return next;
      } else {
        return [...prev, trackId];
      }
    });
  };

  const handleToggleSelectAll = (currentVisibleTracks: Track[]) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (selectedTrackIds.length === currentVisibleTracks.length) {
      setSelectedTrackIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedTrackIds(currentVisibleTracks.map((t) => t.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedTrackIds.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    Alert.alert(
      'Delete Selected Songs',
      `Are you sure you want to delete ${selectedTrackIds.length} song(s) from your offline library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch {}
            for (const id of selectedTrackIds) {
              await onDeleteTrack(id);
            }
            exitSelectionMode();
            await onRefreshLibrary();
          },
        },
      ]
    );
  };

  const handleBulkFavorite = async () => {
    if (selectedTrackIds.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    for (const id of selectedTrackIds) {
      await onToggleFavorite(id);
    }
    exitSelectionMode();
    await onRefreshLibrary();
  };

  const handleBulkAddToLibrary = () => {
    if (selectedTrackIds.length === 0) return;
    const targetTracks = tracks.filter((t) => selectedTrackIds.includes(t.id));
    setTracksToAssign(targetTracks);
  };

  const handleToggleBulkInLibrary = async (libId: string) => {
    if (tracksToAssign.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    for (const track of tracksToAssign) {
      await toggleTrackInLibrary(libId, track.id);
    }
    await loadLibraries();
  };

  // ─── Custom Library Helpers ───

  const handleCreateLibrary = async () => {
    if (!newLibName.trim()) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    try {
      const created = await createCustomLibrary(newLibName.trim());
      setNewLibName('');
      setIsCreateModalOpen(false);
      await loadLibraries();
      setActiveTab(created.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create library';
      Alert.alert('Error', msg);
    }
  };

  const handleDeleteLibraryPrompt = (lib: CustomLibrary) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    Alert.alert(
      'Delete Library',
      `Are you sure you want to delete "${lib.name}"? (Songs will remain in your offline storage)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomLibrary(lib.id);
            if (activeTab === lib.id) {
              setActiveTab('ALL');
            }
            await loadLibraries();
          },
        },
      ]
    );
  };

  const confirmDeleteTrack = (track: Track) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${track.title}" from your offline storage?`,
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

  const nonFavoriteTracks = useMemo(() => tracks.filter((t) => !t.isFavorite), [tracks]);
  const favoriteTracks = useMemo(() => tracks.filter((t) => t.isFavorite), [tracks]);

  const activeCustomLib = useMemo(
    () => customLibs.find((l) => l.id === activeTab),
    [customLibs, activeTab]
  );

  const filteredByTab = useMemo(() => {
    if (activeTab === 'ALL') return nonFavoriteTracks;
    if (activeTab === 'FAVORITES') return favoriteTracks;
    if (activeCustomLib) {
      const trackIdSet = new Set(activeCustomLib.trackIds);
      return tracks.filter((t) => trackIdSet.has(t.id));
    }
    return nonFavoriteTracks;
  }, [activeTab, nonFavoriteTracks, favoriteTracks, activeCustomLib, tracks]);

  const displayedTracks = useMemo(() => {
    if (!searchQuery.trim()) return filteredByTab;
    const q = searchQuery.toLowerCase();
    return filteredByTab.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [filteredByTab, searchQuery]);

  // ─── FlatList Optimization Callbacks ───

  const renderSongItem: ListRenderItem<Track> = useCallback(
    ({ item }) => {
      const isSelected = selectedTrackIds.includes(item.id);

      return (
        <SongCard
          song={item}
          isPlaying={currentTrack?.id === item.id && isPlaying}
          isSelectionMode={isSelectionMode}
          isSelected={isSelected}
          onPress={() => {
            if (isSelectionMode) {
              toggleSelectTrack(item.id);
            } else {
              onPlayTrack(
                item,
                activeCustomLib
                  ? activeCustomLib.name
                  : activeTab === 'FAVORITES'
                  ? 'Favorite'
                  : 'All',
                displayedTracks
              );
            }
          }}
          onLongPress={() => {
            if (!isSelectionMode) {
              enterSelectionMode(item.id);
            }
          }}
          onToggleFavorite={() => onToggleFavorite(item.id)}
          onDelete={() => confirmDeleteTrack(item)}
          onAddToLibrary={() => setTracksToAssign([item])}
        />
      );
    },
    [
      selectedTrackIds,
      currentTrack?.id,
      isPlaying,
      isSelectionMode,
      activeCustomLib,
      activeTab,
      displayedTracks,
      onPlayTrack,
      onToggleFavorite,
    ]
  );

  const keyExtractor = useCallback((item: Track) => item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SONG_CARD_HEIGHT,
      offset: SONG_CARD_HEIGHT * index,
      index,
    }),
    []
  );

  const renderHeader = useMemo(() => {
    if (isSelectionMode) return null;

    return (
      <View style={styles.headerComponentWrapper}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: tokens.onSurface }]}>Your Library</Text>
            <Text style={[styles.subtitle, { color: tokens.onSurfaceVariant }]}>
              {tracks.length} offline {tracks.length === 1 ? 'song' : 'songs'} saved
            </Text>
          </View>

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

        {/* Scrollable Sub-Tabs Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
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
                backgroundColor: activeTab === 'FAVORITES' ? tokens.primary : tokens.surfaceVariant,
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

          {customLibs.map((lib) => {
            const isSelected = activeTab === lib.id;
            const songCount = tracks.filter((t) => lib.trackIds.includes(t.id)).length;
            return (
              <TouchableOpacity
                key={lib.id}
                onPress={() => setActiveTab(lib.id)}
                onLongPress={() => handleDeleteLibraryPrompt(lib)}
                style={[
                  styles.pill,
                  {
                    borderRadius: shapes.pill,
                    backgroundColor: isSelected ? tokens.primary : tokens.surfaceVariant,
                    borderColor: isSelected ? tokens.primary : tokens.outline + '40',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: isSelected ? '#FFFFFF' : tokens.onSurface },
                  ]}
                >
                  {lib.name} ({songCount})
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={() => setIsCreateModalOpen(true)}
            style={[
              styles.pill,
              {
                borderRadius: shapes.pill,
                backgroundColor: tokens.primaryContainer,
                borderColor: tokens.primary + '55',
                borderWidth: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              },
            ]}
          >
            <Icon name="sparkles" size={13} color={tokens.primary} />
            <Text style={[styles.pillText, { color: tokens.primary, fontWeight: '800' }]}>
              + Add
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }, [
    isSelectionMode,
    tokens,
    shapes,
    tracks,
    storageUsage,
    searchQuery,
    activeTab,
    nonFavoriteTracks.length,
    favoriteTracks.length,
    customLibs,
  ]);

  const renderEmptyList = useMemo(() => {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="library" size={48} color={tokens.outline} />
        <Text style={[styles.emptyTitle, { color: tokens.onSurface }]}>
          {activeTab === 'FAVORITES'
            ? 'No favorites yet'
            : activeCustomLib
            ? `No tracks in "${activeCustomLib.name}"`
            : 'No un-favorited tracks'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: tokens.onSurfaceVariant }]}>
          {activeTab === 'FAVORITES'
            ? 'Tap the heart icon on any track to add it to your favorites.'
            : activeCustomLib
            ? 'Tap the playlist icon on any song card to add tracks into this library.'
            : 'All your tracks are currently marked as favorites.'}
        </Text>
      </View>
    );
  }, [activeTab, activeCustomLib, tokens]);

  return (
    <View style={{ flex: 1 }}>
      {/* ─── DYNAMIC TOP BAR: Contextual Multi-Select Toolbar ─── */}
      {isSelectionMode ? (
        <Animated.View
          style={[
            styles.contextualBar,
            {
              backgroundColor: tokens.surfaceVariant,
              borderColor: tokens.outline + '40',
              opacity: selectionBarAnim,
              transform: [
                {
                  translateY: selectionBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.contextualLeft}>
            <TouchableOpacity onPress={exitSelectionMode} style={styles.contextualIconBtn}>
              <Icon name="close" size={20} color={tokens.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.contextualCountText, { color: tokens.onSurface }]}>
              {selectedTrackIds.length} Selected
            </Text>
          </View>

          <View style={styles.contextualActions}>
            <TouchableOpacity
              onPress={() => handleToggleSelectAll(displayedTracks)}
              style={styles.contextualTextBtn}
            >
              <Text style={[styles.selectBtnText, { color: tokens.primary }]}>
                {selectedTrackIds.length === displayedTracks.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleBulkDelete} style={styles.actionCircleBtn}>
              <Icon name="trash" size={18} color="#F87171" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleBulkFavorite} style={styles.actionCircleBtn}>
              <Icon name="heart-filled" size={18} color={tokens.accentPink} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleBulkAddToLibrary} style={styles.actionCircleBtn}>
              <Icon name="queue" size={18} color={tokens.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}

      {/* ─── VIRTUALIZED FLATLIST ─── */}
      <FlatList
        data={displayedTracks}
        keyExtractor={keyExtractor}
        renderItem={renderSongItem}
        getItemLayout={getItemLayout}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={[
          styles.container,
          isSelectionMode && { paddingTop: 6 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* ─── Modal 1: Create Custom Library ─── */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsCreateModalOpen(false)}
        >
          <Pressable
            style={[
              styles.dialogCard,
              {
                backgroundColor: tokens.surface,
                borderRadius: shapes.lg,
                borderColor: tokens.outline + '40',
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.dialogTitle, { color: tokens.onSurface }]}>
              New Custom Library
            </Text>
            <Text style={[styles.dialogSubtitle, { color: tokens.onSurfaceVariant }]}>
              Group specific genres, regions, or playlists (e.g. "Pahari Songs", "Gym", "Lofi").
            </Text>

            <TextInput
              value={newLibName}
              onChangeText={setNewLibName}
              placeholder="e.g. Pahari Songs"
              placeholderTextColor={tokens.onSurfaceVariant + '80'}
              autoFocus
              style={[
                styles.dialogInput,
                {
                  backgroundColor: tokens.surfaceVariant + '40',
                  color: tokens.onSurface,
                  borderRadius: shapes.md,
                  borderColor: tokens.primary + '55',
                },
              ]}
            />

            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  setNewLibName('');
                  setIsCreateModalOpen(false);
                }}
                style={styles.dialogCancelBtn}
              >
                <Text style={[styles.dialogBtnText, { color: tokens.onSurfaceVariant }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateLibrary}
                style={[styles.dialogCreateBtn, { backgroundColor: tokens.primary, borderRadius: shapes.pill }]}
              >
                <Text style={[styles.dialogBtnText, { color: '#FFFFFF' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Modal 2: Modern Gesture-Dismissable Bottom Sheet (Bulk & Single) ─── */}
      <Modal
        visible={tracksToAssign.length > 0}
        transparent
        animationType="none"
        onRequestClose={closeAssignSheet}
      >
        <View style={styles.modalBackdropBottom}>
          <Animated.View
            style={[
              styles.scrimAbsolute,
              {
                opacity: scrimOpacity,
                backgroundColor: 'rgba(0, 0, 0, 0.72)',
              },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeAssignSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheetCard,
              {
                backgroundColor: tokens.surface,
                borderTopLeftRadius: shapes.sheet,
                borderTopRightRadius: shapes.sheet,
                borderColor: tokens.outline + '35',
                transform: [{ translateY: sheetTranslateY }],
                paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24,
              },
            ]}
          >
            <View {...sheetPanResponder.panHandlers} style={styles.dragGestureHeader}>
              <View style={styles.handleContainer}>
                <View style={[styles.handlePill, { backgroundColor: tokens.outline + '45' }]} />
              </View>

              <View style={styles.sheetHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.sheetTitle, { color: tokens.onSurface }]}>
                    Add to Library
                  </Text>
                  <Text numberOfLines={1} style={[styles.sheetSubtitle, { color: tokens.onSurfaceVariant }]}>
                    {tracksToAssign.length === 1
                      ? tracksToAssign[0]?.title
                      : `${tracksToAssign.length} selected tracks`}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={closeAssignSheet}
                  style={[styles.closeIconCircle, { backgroundColor: tokens.surfaceVariant + '75' }]}
                >
                  <Icon name="close" size={17} color={tokens.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </View>

            {customLibs.length === 0 ? (
              <View style={styles.emptyCustomLibPrompt}>
                <View style={[styles.emptyIconCircle, { backgroundColor: tokens.primaryContainer + '40' }]}>
                  <Icon name="library" size={30} color={tokens.primary} />
                </View>
                <Text style={[styles.emptyPromptTitle, { color: tokens.onSurface }]}>
                  No Custom Libraries Yet
                </Text>
                <Text style={[styles.emptyPromptSubtitle, { color: tokens.onSurfaceVariant }]}>
                  Create collections like "Pahari Songs", "Road Trip", or "Workout" to organize your offline music.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    closeAssignSheet();
                    setIsCreateModalOpen(true);
                  }}
                  style={[styles.createFirstBtn, { backgroundColor: tokens.primary, borderRadius: shapes.pill }]}
                >
                  <Icon name="sparkles" size={16} color="#FFFFFF" />
                  <Text style={styles.createFirstBtnText}>+ Create Library</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView
                  style={{ maxHeight: SCREEN_HEIGHT * 0.42 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 6 }}
                >
                  {customLibs.map((lib) => {
                    const allInLib = tracksToAssign.every((t) => lib.trackIds.includes(t.id));
                    const songCount = tracks.filter((t) => lib.trackIds.includes(t.id)).length;

                    return (
                      <TouchableOpacity
                        key={lib.id}
                        activeOpacity={0.7}
                        onPress={() => handleToggleBulkInLibrary(lib.id)}
                        style={[
                          styles.assignRow,
                          {
                            backgroundColor: allInLib
                              ? tokens.primaryContainer + '28'
                              : tokens.surfaceVariant + '35',
                            borderColor: allInLib
                              ? tokens.primary + '65'
                              : 'rgba(255, 255, 255, 0.06)',
                            borderRadius: shapes.lg,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                          <View
                            style={[
                              styles.libIconBox,
                              {
                                backgroundColor: allInLib
                                  ? tokens.primaryContainer
                                  : tokens.surfaceVariant,
                              },
                            ]}
                          >
                            <Icon
                              name="library"
                              size={19}
                              color={allInLib ? tokens.primary : tokens.onSurfaceVariant}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: allInLib ? tokens.primary : tokens.onSurface,
                                fontWeight: '700',
                                fontSize: 15,
                                letterSpacing: -0.2,
                              }}
                            >
                              {lib.name}
                            </Text>
                            <Text
                              style={{
                                color: tokens.onSurfaceVariant,
                                fontSize: 12,
                                marginTop: 2,
                                fontWeight: '500',
                              }}
                            >
                              {songCount} {songCount === 1 ? 'song' : 'songs'}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: allInLib ? tokens.primary : tokens.outline + '55',
                              backgroundColor: allInLib ? tokens.primary : 'transparent',
                            },
                          ]}
                        >
                          {allInLib && <Icon name="check" size={13} color="#FFFFFF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.sheetFooterRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      closeAssignSheet();
                      setIsCreateModalOpen(true);
                    }}
                    style={[
                      styles.addNewLibInlineBtn,
                      {
                        backgroundColor: tokens.surfaceVariant + '45',
                        borderColor: tokens.outline + '35',
                        borderRadius: shapes.pill,
                      },
                    ]}
                  >
                    <Icon name="sparkles" size={15} color={tokens.primary} />
                    <Text style={[styles.addNewLibInlineText, { color: tokens.primary }]}>
                      New Library
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      closeAssignSheet();
                      exitSelectionMode();
                    }}
                    style={[
                      styles.sheetDoneBtn,
                      {
                        backgroundColor: tokens.primary,
                        borderRadius: shapes.pill,
                      },
                    ]}
                  >
                    <Text style={styles.sheetDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 160,
  },
  headerComponentWrapper: {
    marginBottom: 8,
  },
  contextualBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    zIndex: 100,
  },
  contextualLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contextualIconBtn: {
    padding: 4,
  },
  contextualCountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  contextualActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextualTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  selectBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 12,
    paddingRight: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    padding: 22,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dialogSubtitle: {
    fontSize: 12.5,
    marginTop: 5,
    marginBottom: 18,
    lineHeight: 18,
  },
  dialogInput: {
    borderWidth: 1.2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  dialogActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dialogCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  dialogCreateBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  dialogBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  modalBackdropBottom: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrimAbsolute: {
    ...StyleSheet.absoluteFill,
  },
  sheetCard: {
    paddingHorizontal: 22,
    borderTopWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 24,
  },
  dragGestureHeader: {
    paddingBottom: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handlePill: {
    width: 42,
    height: 4.5,
    borderRadius: 2.5,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  closeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 4,
    borderWidth: 1.2,
  },
  libIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCustomLibPrompt: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyPromptTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyPromptSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 20,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  createFirstBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
  },
  sheetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  addNewLibInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1.2,
  },
  addNewLibInlineText: {
    fontWeight: '800',
    fontSize: 13,
  },
  sheetDoneBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
  },
});