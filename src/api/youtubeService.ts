import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import type { VideoInfo, Track, ProgressCallbackData } from '../types';
import { getApiConfig, getRenderUrl } from '../services/network';
import { getTrackFilePath } from '../services/storage';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const safeDecode = (str: string | null): string => {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

// Pure TypeScript base64 encoder to avoid missing 'btoa' global in React Native
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    const c0 = b0 >> 2;
    const c1 = ((b0 & 3) << 4) | (b1 >> 4);
    const c2 = ((b1 & 15) << 2) | (b2 >> 6);
    const c3 = b2 & 63;

    base64 += chars[c0] + chars[c1];
    base64 += i + 1 < len ? chars[c2] : '=';
    base64 += i + 2 < len ? chars[c3] : '=';
  }
  return base64;
};

export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const pingRenderHealth = async (): Promise<{ ok: boolean; timeMs: number }> => {
  const renderUrl = getRenderUrl();
  const startTime = Date.now();
  try {
    const res = await fetch(`${renderUrl}/health`, { method: 'GET' });
    const timeMs = Date.now() - startTime;
    if (!res.ok) return { ok: false, timeMs };
    const data = await res.json();
    return { ok: data?.status === 'ok', timeMs };
  } catch {
    return { ok: false, timeMs: Date.now() - startTime };
  }
};

export const fetchVideoInfo = async (url: string): Promise<VideoInfo> => {
  const { baseUrl, networkMode } = getApiConfig();
  const res = await fetch(`${baseUrl}/converter/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, networkMode }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Received non-JSON response from backend (${baseUrl})`);
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.message || `Failed to fetch video preview: ${res.statusText}`);
  }

  return await res.json();
};

export const getAudioDurationFromUri = (uri: string): Promise<number> => {
  return new Promise<number>((resolve) => {
    try {
      const tempPlayer: any = createAudioPlayer({ uri });
      let resolved = false;

      const cleanup = (val: number): void => {
        if (resolved) return;
        resolved = true;
        try {
          if (typeof tempPlayer.remove === 'function') {
            tempPlayer.remove();
          } else if (typeof tempPlayer.release === 'function') {
            tempPlayer.release();
          }
        } catch {}
        resolve(val > 0 ? Math.round(val) : 0);
      };

      const timer = setTimeout(() => {
        cleanup(tempPlayer.duration || 0);
      }, 3500);

      if (tempPlayer.duration && tempPlayer.duration > 0) {
        clearTimeout(timer);
        cleanup(tempPlayer.duration);
        return;
      }

      if (typeof tempPlayer.addListener === 'function') {
        tempPlayer.addListener('playbackStatusUpdate', (status: any) => {
          if (status?.duration && status.duration > 0) {
            clearTimeout(timer);
            cleanup(status.duration);
          }
        });
      }
    } catch {
      resolve(0);
    }
  });
};

export const downloadAudioStream = async (
  url: string,
  previewFallback?: VideoInfo | null,
  onProgress?: (progress: ProgressCallbackData) => void,
  maxRetries = 3,
  retryDelayMs = 2000
): Promise<Track> => {
  let attempt = 0;
  const { baseUrl, networkMode } = getApiConfig();

  while (attempt < maxRetries) {
    attempt++;
    try {
      onProgress?.({
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        statusText:
          attempt > 1
            ? `Retrying download (${attempt}/${maxRetries})...`
            : 'Connecting to audio stream...',
      });

      const res = await fetch(`${baseUrl}/converter/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          networkMode,
          id: previewFallback?.id,
          title: previewFallback?.title,
          channel: previewFallback?.channel,
          thumbnail: previewFallback?.thumbnail,
          duration: previewFallback?.duration,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const rawTitle = res.headers.get('X-Audio-Title');
      const rawArtist = res.headers.get('X-Audio-Artist');
      const rawThumb = res.headers.get('X-Audio-Thumbnail');

      const title = previewFallback?.title || safeDecode(rawTitle) || 'Unknown Title';
      const artist = previewFallback?.channel || safeDecode(rawArtist) || 'Unknown Artist';
      const thumbnailUrl = previewFallback?.thumbnail || rawThumb || '';
      let duration = previewFallback?.duration || Number(res.headers.get('X-Audio-Duration')) || 0;
      const id = previewFallback?.id || res.headers.get('X-Audio-Id') || `track_${Date.now()}`;

      const targetFilePath = getTrackFilePath(id);

      onProgress?.({
        percent: 50,
        receivedBytes: 0,
        totalBytes: 0,
        statusText: 'Writing track to device storage...',
      });

      const arrayBuffer = await res.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Data = uint8ArrayToBase64(uint8Array);

      await FileSystem.writeAsStringAsync(targetFilePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!duration || duration <= 0) {
        duration = await getAudioDurationFromUri(targetFilePath);
      }

      onProgress?.({
        percent: 100,
        receivedBytes: uint8Array.length,
        totalBytes: uint8Array.length,
        statusText: 'Saved offline!',
      });

      return {
        id,
        title,
        artist,
        duration,
        durationFormatted: formatDuration(duration),
        thumbnailUrl,
        fileUri: targetFilePath,
        createdAt: Date.now(),
        isFavorite: false,
      };
    } catch (err: unknown) {
      if (attempt >= maxRetries) {
        const msg = err instanceof Error ? err.message : 'Network error';
        throw new Error(`Download failed after ${maxRetries} attempts: ${msg}`);
      }

      onProgress?.({
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        statusText: `Connection dropped. Retrying in ${retryDelayMs / 1000}s...`,
      });

      await sleep(retryDelayMs);
    }
  }

  throw new Error('Download terminated unexpectedly');
};

export const syncCookiesToBackend = async (
  cookieText: string
): Promise<{ success: boolean; message: string; byteCount: number }> => {
  const { baseUrl } = getApiConfig();

  const res = await fetch(`${baseUrl}/converter/cookies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookies: cookieText.trim() }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.message || 'Failed to update cookies on server.');
  }

  return await res.json();
};