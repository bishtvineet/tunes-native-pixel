import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { BottomNavBar, type RootTab } from './src/components/navigation/BottomNavBar';
import { FullPlayerSheet } from './src/components/player/FullPlayerSheet';
import { HomeScreen } from './src/screens/home/HomeScreen';
import { SearchScreen } from './src/screens/search/SearchScreen';
import { LibraryScreen } from './src/screens/library/LibraryScreen';
import { useAudioPlayer } from './src/hooks/useAudioPlayer';
import {
  getAllTracks,
  deleteTrack,
  toggleTrackFavorite,
  getStorageStats,
} from './src/services/storage';
import { initNetworkMode } from './src/services/network';
import type { Track, PlaybackContext } from './src/types';

function MainAppShell() {
  const { tokens } = useTheme();
  const [currentRoute, setCurrentRoute] = useState<RootTab>('Home');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [storageUsage, setStorageUsageStr] = useState('0.0 MB');
  const [isLoading, setIsLoading] = useState(true);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeatMode,
    playbackContext,
    playTrack,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    toggleRepeat,
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
    await refreshLibrary();
    setCurrentRoute('Library');
    const updated = await getAllTracks();
    playTrack(newTrack, 'All', updated);
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
    <SafeAreaView style={[styles.root, { backgroundColor: tokens.background }]}>
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
            {currentRoute === 'Home' && (
              <HomeScreen
                tracks={tracks}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onToggleFavorite={handleToggleFavorite}
                onDeleteTrack={handleDeleteTrack}
                onNavigateTab={setCurrentRoute}
              />
            )}

            {currentRoute === 'Search' && (
              <SearchScreen onTrackSaved={handleTrackSaved} />
            )}

            {currentRoute === 'Library' && (
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
            )}
          </>
        )}
      </View>

      {/* Floating Mini Player & Full Player Modal */}
      <FullPlayerSheet
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        repeatMode={repeatMode}
        playbackContext={playbackContext}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onNext={nextTrack}
        onPrev={prevTrack}
        onToggleRepeat={toggleRepeat}
      />

      {/* Floating Bottom Navigation Bar */}
      <BottomNavBar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
      />
    </SafeAreaView>
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
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});