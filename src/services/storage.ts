import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '../types';

const TRACKS_METADATA_KEY = 'tunes_native_tracks_meta';
const FAVORITES_KEY = 'tunes_favorites';
const TRACKS_DIR = `${FileSystem.documentDirectory}tracks/`;

// Ensure tracks directory exists on physical disk
const ensureDirectoryExists = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('[Storage] Error ensuring directory exists:', error);
  }
};

export const getTrackFilePath = (trackId: string): string => {
  return `${TRACKS_DIR}${trackId}.mp3`;
};

export const getAllTracks = async (): Promise<Track[]> => {
  try {
    const [rawTracks, rawFavs] = await Promise.all([
      AsyncStorage.getItem(TRACKS_METADATA_KEY),
      AsyncStorage.getItem(FAVORITES_KEY),
    ]);

    if (!rawTracks) return [];

    const list: Track[] = JSON.parse(rawTracks);
    const favSet = new Set<string>(rawFavs ? JSON.parse(rawFavs) : []);

    return list
      .map((track) => ({
        ...track,
        isFavorite: favSet.has(track.id),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error('[Storage] Failed to fetch tracks:', err);
    return [];
  }
};

export const saveTrack = async (track: Track): Promise<void> => {
  try {
    await ensureDirectoryExists();
    const existing = await getAllTracks();
    const updated = [track, ...existing.filter((t) => t.id !== track.id)];
    await AsyncStorage.setItem(TRACKS_METADATA_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[Storage] Failed to save track:', err);
    throw err;
  }
};

export const toggleTrackFavorite = async (trackId: string): Promise<boolean> => {
  try {
    const rawFavs = await AsyncStorage.getItem(FAVORITES_KEY);
    const favs: string[] = rawFavs ? JSON.parse(rawFavs) : [];
    const isFav = favs.includes(trackId);
    const updated = isFav ? favs.filter((id) => id !== trackId) : [...favs, trackId];

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return !isFav;
  } catch (err) {
    console.error('[Storage] Failed to toggle favorite:', err);
    return false;
  }
};

export const deleteTrack = async (id: string): Promise<void> => {
  try {
    const existing = await getAllTracks();
    const trackToDelete = existing.find((t) => t.id === id);

    // 1. Delete physical audio file from device storage
    if (trackToDelete && trackToDelete.fileUri) {
      const fileInfo = await FileSystem.getInfoAsync(trackToDelete.fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(trackToDelete.fileUri, { idempotent: true });
      }
    }

    // 2. Remove metadata from AsyncStorage
    const remaining = existing.filter((t) => t.id !== id);
    await AsyncStorage.setItem(TRACKS_METADATA_KEY, JSON.stringify(remaining));

    // 3. Clean up favorite entry if present
    const rawFavs = await AsyncStorage.getItem(FAVORITES_KEY);
    if (rawFavs) {
      const favs: string[] = JSON.parse(rawFavs);
      await AsyncStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favs.filter((itemId) => itemId !== id))
      );
    }
  } catch (err) {
    console.error('[Storage] Failed to delete track:', err);
  }
};

export const getStorageStats = async (): Promise<{ totalBytes: number; formattedSize: string }> => {
  try {
    await ensureDirectoryExists();
    const files = await FileSystem.readDirectoryAsync(TRACKS_DIR);
    let totalBytes = 0;

    for (const fileName of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${TRACKS_DIR}${fileName}`);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        totalBytes += fileInfo.size || 0;
      }
    }

    const formattedSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    return { totalBytes, formattedSize };
  } catch {
    return { totalBytes: 0, formattedSize: '0.0 MB' };
  }
};

export const pruneStaleStorage = async (): Promise<{ freedBytes: number; prunedCount: number }> => {
  try {
    await ensureDirectoryExists();
    const tracks = await getAllTracks();
    const validPaths = new Set(tracks.map((t) => t.fileUri));

    const files = await FileSystem.readDirectoryAsync(TRACKS_DIR);
    let freedBytes = 0;
    let prunedCount = 0;

    for (const file of files) {
      const fullPath = `${TRACKS_DIR}${file}`;
      if (!validPaths.has(fullPath)) {
        const info = await FileSystem.getInfoAsync(fullPath);
        if (info.exists) {
          freedBytes += info.size || 0;
          await FileSystem.deleteAsync(fullPath, { idempotent: true });
          prunedCount++;
        }
      }
    }

    return { freedBytes, prunedCount };
  } catch {
    return { freedBytes: 0, prunedCount: 0 };
  }
};