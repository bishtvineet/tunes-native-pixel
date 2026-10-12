import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { BottomNavBar, RootTab } from './src/components/navigation/BottomNavBar';
import { FullPlayerSheet } from './src/components/player/FullPlayerSheet';
import { SettingsSheet } from './src/components/settings/SettingsSheet';
import { HomeScreen } from './src/screens/home/HomeScreen';
import { SearchScreen } from './src/screens/search/SearchScreen';
import { LibraryScreen } from './src/screens/library/LibraryScreen';
import { useAudioPlayer } from './src/hooks/useAudioPlayer';
import {
  getAllTracks,
  saveTrack,
  deleteTrack,
  toggleTrackFavorite,
  getStorageStats,
} from './src/services/storage';
import { initNetworkMode } from './src/services/network';
import type { Track, PlaybackContext } from './src/types';

function MainAppShell() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentRoute, setCurrentRoute] = useState<RootTab>('Home');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [storageUsage, setStorageUsageStr] = useState('0.0 MB');
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeatMode,
    isShuffle,
    playbackContext,
    playTrack,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    toggleRepeat,
    toggleShuffle,
    stopTrack,
    updatePlaybackContext,
  } = useAudioPlayer();

  const refreshLibrary = useCallback(async () => {
    try {
      const storedTracks = await getAllTracks();
      setTracks(storedTracks);
      const stats = await getStorageStats();
      setStorageUsageStr(stats.formattedSize);

      if (updatePlaybackContext) {
        updatePlaybackContext(playbackContext, storedTracks);
      }
    } catch (err) {
      console.error('[App] Failed to refresh library:', err);
    }
  }, [playbackContext, updatePlaybackContext]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initNetworkMode();
        await refreshLibrary();
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [refreshLibrary]);

  const handleTrackSaved = async (newTrack: Track) => {
    try {
      await saveTrack(newTrack);
      const updatedList = await getAllTracks();
      setTracks(updatedList);
      const stats = await getStorageStats();
      setStorageUsageStr(stats.formattedSize);
    } catch (err) {
      console.error('[App] Error saving newly downloaded track:', err);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (currentTrack?.id === id) {
      stopTrack();
    }
    await deleteTrack(id);
    await refreshLibrary();
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleTrackFavorite(id);

    setTracks((prevTracks) => {
      const updated = prevTracks.map((t) =>
        t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
      );

      const currentQueue =
        playbackContext === 'Favorites'
          ? updated.filter((t) => t.isFavorite)
          : updated.filter((t) => !t.isFavorite);

      if (updatePlaybackContext) {
        updatePlaybackContext(playbackContext, currentQueue);
      }
      return updated;
    });

    await refreshLibrary();
  };

  const handlePlayTrack = (
    track: Track,
    context: PlaybackContext,
    queue: Track[]
  ) => {
    playTrack(track, context, queue);
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: tokens.background,
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        {...(Platform.OS === 'android' ? { backgroundColor: tokens.background } : {})}
      />

      <View style={styles.body}>
        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={tokens.primary} />
          </View>
        ) : (
          <>
            {/* Kept permanently mounted in native view hierarchy */}
            <View
              style={[
                styles.tabContainer,
                {
                  opacity: currentRoute === 'Home' ? 1 : 0,
                  zIndex: currentRoute === 'Home' ? 1 : -1,
                  pointerEvents: currentRoute === 'Home' ? 'auto' : 'none',
                },
              ]}
            >
              <HomeScreen
                tracks={tracks}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onTogglePlay={togglePlay}
                onToggleFavorite={handleToggleFavorite}
                onDeleteTrack={handleDeleteTrack}
                onNavigateTab={setCurrentRoute}
              />
            </View>

            <View
              style={[
                styles.tabContainer,
                {
                  opacity: currentRoute === 'Download' ? 1 : 0,
                  zIndex: currentRoute === 'Download' ? 1 : -1,
                  pointerEvents: currentRoute === 'Download' ? 'auto' : 'none',
                },
              ]}
            >
              <SearchScreen onTrackSaved={handleTrackSaved} />
            </View>

            <View
              style={[
                styles.tabContainer,
                {
                  opacity: currentRoute === 'Library' ? 1 : 0,
                  zIndex: currentRoute === 'Library' ? 1 : -1,
                  pointerEvents: currentRoute === 'Library' ? 'auto' : 'none',
                },
              ]}
            >
              <LibraryScreen
                tracks={tracks}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                storageUsage={storageUsage}
                onPlayTrack={handlePlayTrack}
                onToggleFavorite={handleToggleFavorite}
                onDeleteTrack={handleDeleteTrack}
                onRefreshLibrary={refreshLibrary}
              />
            </View>
          </>
        )}
      </View>

      {/* Full Player & Mini Player Sheet */}
      <FullPlayerSheet
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        repeatMode={repeatMode}
        isShuffle={isShuffle}
        playbackContext={playbackContext}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onNext={nextTrack}
        onPrev={prevTrack}
        onToggleRepeat={toggleRepeat}
        onToggleShuffle={toggleShuffle}
        onToggleFavorite={handleToggleFavorite}
        onNavigateToLibrary={() => setCurrentRoute('Library')}
      />

      {/* Floating Bottom Navigation Bar */}
      <BottomNavBar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Slide-Up Settings Sheet */}
      <SettingsSheet
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        storageUsage={storageUsage}
        onClearCache={refreshLibrary}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainAppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    position: 'relative',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    ...StyleSheet.absoluteFill,
  },
});