import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '../types';
import { formatDuration } from '../utils/audio';

const TRACKS_METADATA_KEY = 'tunes_native_tracks_meta';
const FAVORITES_KEY = 'tunes_favorites';
const LIBRARIES_KEY = 'tunes_custom_libraries';
const TRACKS_DIR = `${FileSystem.documentDirectory}tracks/`;

export interface CustomLibrary {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

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

export const getTrackArtworkPath = (trackId: string): string => {
  return `${TRACKS_DIR}${trackId}.jpg`;
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
      .map((track) => {
        let formatted = track.durationFormatted;
        if ((!formatted || formatted === '--:--') && track.duration && track.duration > 0) {
          formatted = formatDuration(track.duration);
        }

        return {
          ...track,
          durationFormatted: formatted || '--:--',
          isFavorite: favSet.has(track.id),
        };
      })
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

    if (trackToDelete) {
      if (trackToDelete.fileUri) {
        const fileInfo = await FileSystem.getInfoAsync(trackToDelete.fileUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(trackToDelete.fileUri, { idempotent: true });
        }
      }
      if (trackToDelete.thumbnailUrl && trackToDelete.thumbnailUrl.startsWith('file://')) {
        const thumbInfo = await FileSystem.getInfoAsync(trackToDelete.thumbnailUrl);
        if (thumbInfo.exists) {
          await FileSystem.deleteAsync(trackToDelete.thumbnailUrl, { idempotent: true });
        }
      }
    }

    const remaining = existing.filter((t) => t.id !== id);
    await AsyncStorage.setItem(TRACKS_METADATA_KEY, JSON.stringify(remaining));

    const rawFavs = await AsyncStorage.getItem(FAVORITES_KEY);
    if (rawFavs) {
      const favs: string[] = JSON.parse(rawFavs);
      await AsyncStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favs.filter((itemId) => itemId !== id))
      );
    }

    // Clean up track ID references from custom libraries
    const libs = await getCustomLibraries();
    const updatedLibs = libs.map((l) => ({
      ...l,
      trackIds: l.trackIds.filter((tId) => tId !== id),
    }));
    await AsyncStorage.setItem(LIBRARIES_KEY, JSON.stringify(updatedLibs));
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
    const validFilePaths = new Set(tracks.map((t) => t.fileUri));
    tracks.forEach((t) => {
      if (t.thumbnailUrl && t.thumbnailUrl.startsWith('file://')) {
        validFilePaths.add(t.thumbnailUrl);
      }
    });

    const files = await FileSystem.readDirectoryAsync(TRACKS_DIR);
    let freedBytes = 0;
    let prunedCount = 0;

    for (const file of files) {
      const fullPath = `${TRACKS_DIR}${file}`;
      if (!validFilePaths.has(fullPath)) {
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

export const updateTrackDuration = async (
  trackId: string,
  durationSeconds: number
): Promise<void> => {
  try {
    if (!trackId || !durationSeconds || durationSeconds <= 0) return;

    const raw = await AsyncStorage.getItem(TRACKS_METADATA_KEY);
    if (!raw) return;

    const tracks: Track[] = JSON.parse(raw);
    let hasChanged = false;

    const totalSecs = Math.floor(durationSeconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;

    const updated = tracks.map((t) => {
      if (t.id === trackId) {
        if (!t.duration || t.duration <= 0 || !t.durationFormatted || t.durationFormatted === '--:--') {
          hasChanged = true;
          return {
            ...t,
            duration: totalSecs,
            durationFormatted: formatted,
          };
        }
      }
      return t;
    });

    if (hasChanged) {
      await AsyncStorage.setItem(TRACKS_METADATA_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('[Storage] Failed to persist detected track duration:', err);
  }
};

export const findDuplicateTrack = async (preview: {
  id?: string;
  title?: string;
  channel?: string;
  thumbnail?: string;
}): Promise<Track | null> => {
  try {
    const tracks = await getAllTracks();
    const cleanTitle = (preview.title || '').trim().toLowerCase();
    const cleanChannel = (preview.channel || '').trim().toLowerCase();

    for (const t of tracks) {
      if (preview.id && t.id === preview.id) {
        return t;
      }
      if (preview.thumbnail && t.thumbnailUrl && t.thumbnailUrl === preview.thumbnail) {
        return t;
      }
      if (cleanTitle && cleanChannel) {
        const tTitle = (t.title || '').trim().toLowerCase();
        const tArtist = (t.artist || '').trim().toLowerCase();
        if (tTitle === cleanTitle && tArtist === cleanChannel) {
          return t;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
};

// ─── Custom Libraries (Playlists / Category Folders) ───

export const getCustomLibraries = async (): Promise<CustomLibrary[]> => {
  try {
    const raw = await AsyncStorage.getItem(LIBRARIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const createCustomLibrary = async (name: string): Promise<CustomLibrary> => {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Library name cannot be empty');

  const libs = await getCustomLibraries();
  const newLib: CustomLibrary = {
    id: `lib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    trackIds: [],
    createdAt: Date.now(),
  };

  const updated = [newLib, ...libs];
  await AsyncStorage.setItem(LIBRARIES_KEY, JSON.stringify(updated));
  return newLib;
};

export const deleteCustomLibrary = async (id: string): Promise<void> => {
  const libs = await getCustomLibraries();
  const filtered = libs.filter((l) => l.id !== id);
  await AsyncStorage.setItem(LIBRARIES_KEY, JSON.stringify(filtered));
};

export const toggleTrackInLibrary = async (
  libraryId: string,
  trackId: string
): Promise<boolean> => {
  const libs = await getCustomLibraries();
  let isNowIncluded = false;

  const updated = libs.map((lib) => {
    if (lib.id === libraryId) {
      const exists = lib.trackIds.includes(trackId);
      isNowIncluded = !exists;
      return {
        ...lib,
        trackIds: exists
          ? lib.trackIds.filter((tId) => tId !== trackId)
          : [...lib.trackIds, trackId],
      };
    }
    return lib;
  });

  await AsyncStorage.setItem(LIBRARIES_KEY, JSON.stringify(updated));
  return isNowIncluded;
};