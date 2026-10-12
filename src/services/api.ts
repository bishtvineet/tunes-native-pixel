import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import type { VideoInfo, Track, ProgressCallbackData } from '../types';
import { getApiConfig, getRenderUrl } from './network';
import { getTrackFilePath, getTrackArtworkPath } from './storage';

export { ProgressCallbackData };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const safeDecode = (str: string | null): string => {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

export const parseDurationToSeconds = (input: any): number => {
  if (!input) return 0;
  if (typeof input === 'number') {
    return input > 1000 ? Math.floor(input / 1000) : Math.floor(input);
  }
  if (typeof input === 'string') {
    if (input.includes(':')) {
      const parts = input.split(':').map((p) => parseInt(p, 10) || 0);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
    const parsed = parseFloat(input);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed > 1000 ? Math.floor(parsed / 1000) : Math.floor(parsed);
    }
  }
  return 0;
};

export const formatDuration = (seconds: number | string | undefined | null): string => {
  if (seconds === undefined || seconds === null) return '--:--';
  if (typeof seconds === 'string' && seconds.includes(':')) return seconds.trim();

  const total = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  if (isNaN(total) || total <= 0) return '--:--';

  const secsTotal = total > 1000 ? Math.floor(total / 1000) : Math.floor(total);
  const mins = Math.floor(secsTotal / 60);
  const secs = secsTotal % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Measures the real duration directly from the downloaded audio file
const detectLocalAudioDuration = async (fileUri: string): Promise<number> => {
  return new Promise((resolve) => {
    let tempPlayer: any = null;
    let timeout: any = null;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (tempPlayer) {
        try {
          if (typeof tempPlayer.remove === 'function') tempPlayer.remove();
          else if (typeof tempPlayer.release === 'function') tempPlayer.release();
        } catch {}
        tempPlayer = null;
      }
    };

    timeout = setTimeout(() => {
      cleanup();
      resolve(0);
    }, 1200);

    try {
      tempPlayer = createAudioPlayer({ uri: fileUri });
      if (!tempPlayer) {
        cleanup();
        resolve(0);
        return;
      }

      const immediateDur = typeof tempPlayer.duration === 'number' ? tempPlayer.duration : 0;
      if (immediateDur > 0) {
        cleanup();
        resolve(immediateDur > 1000 ? Math.floor(immediateDur / 1000) : Math.floor(immediateDur));
        return;
      }

      if (typeof tempPlayer.addListener === 'function') {
        tempPlayer.addListener('playbackStatusUpdate', (status: any) => {
          const sDur = status?.duration ?? tempPlayer?.duration ?? 0;
          if (sDur > 0) {
            cleanup();
            resolve(sDur > 1000 ? Math.floor(sDur / 1000) : Math.floor(sDur));
          }
        });
      }
    } catch {
      cleanup();
      resolve(0);
    }
  });
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
    const timeMs = Date.now() - startTime;
    return { ok: false, timeMs };
  }
};

// Lightweight info API (titles, channel, thumbnail only)
export const fetchVideoInfo = async (url: string, signal?: AbortSignal): Promise<VideoInfo> => {
  const { baseUrl, networkMode } = getApiConfig();

  const res = await fetch(`${baseUrl}/converter/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, networkMode }),
    signal,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Received non-JSON response from backend (${baseUrl})`);
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.message || `Failed to fetch preview: ${res.statusText}`);
  }

  const data = await res.json();
  const durSec = parseDurationToSeconds(data.duration || data.durationFormatted);

  return {
    ...data,
    duration: durSec,
    durationFormatted: durSec > 0 ? formatDuration(durSec) : '--:--',
  };
};

// Full audio converter: extracts stream, downloads artwork offline, and measures real duration
export const downloadAudioStream = async (
  url: string,
  previewFallback?: VideoInfo | null,
  onProgress?: (progress: ProgressCallbackData) => void,
  maxRetries = 3,
  retryDelayMs = 2000,
  signal?: AbortSignal
): Promise<Track> => {
  let attempt = 0;
  const { baseUrl, networkMode } = getApiConfig();

  while (attempt < maxRetries) {
    if (signal?.aborted) {
      throw new Error('Download aborted by user');
    }

    attempt++;

    try {
      if (attempt > 1 && onProgress) {
        onProgress({
          percent: 0,
          receivedBytes: 0,
          totalBytes: 0,
          statusText: `Retrying download (Attempt ${attempt}/${maxRetries})...`,
        });
      }

      onProgress?.({
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        statusText: 'Connecting to audio stream...',
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
        }),
        signal,
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const rawTitle = res.headers.get('X-Audio-Title');
      const rawArtist = res.headers.get('X-Audio-Artist');
      const rawThumb = res.headers.get('X-Audio-Thumbnail');
      const rawDuration =
        res.headers.get('X-Audio-Duration') ||
        res.headers.get('x-duration') ||
        res.headers.get('x-audio-duration');

      const title = previewFallback?.title || safeDecode(rawTitle) || 'Unknown Title';
      const artist = previewFallback?.channel || safeDecode(rawArtist) || 'Unknown Artist';
      const remoteThumbUrl = previewFallback?.thumbnail || rawThumb || '';
      const id = previewFallback?.id || res.headers.get('X-Audio-Id') || `track_${Date.now()}`;
      const targetFilePath = getTrackFilePath(id);

      onProgress?.({
        percent: 45,
        receivedBytes: 0,
        totalBytes: 0,
        statusText: 'Writing track to device storage...',
      });

      const arrayBuffer = await res.arrayBuffer();
      if (signal?.aborted) {
        throw new Error('Download aborted by user');
      }

      const uint8Array = new Uint8Array(arrayBuffer);

      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        binaryString += String.fromCharCode.apply(
          null,
          Array.from(uint8Array.subarray(i, i + chunkSize))
        );
      }
      const base64Data = btoa(binaryString);

      await FileSystem.writeAsStringAsync(targetFilePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // ─── Cache Artwork Locally for Airplane / Offline / Lockscreen Mode ───
      let localArtworkUri = remoteThumbUrl;
      if (remoteThumbUrl && remoteThumbUrl.startsWith('http')) {
        try {
          const artworkDiskPath = getTrackArtworkPath(id);
          const thumbResult = await FileSystem.downloadAsync(remoteThumbUrl, artworkDiskPath);
          if (thumbResult && thumbResult.uri) {
            localArtworkUri = thumbResult.uri;
          }
        } catch (thumbErr) {
          console.warn('[API] Could not save artwork offline, fallback to remote link:', thumbErr);
          localArtworkUri = remoteThumbUrl;
        }
      }

      onProgress?.({
        percent: 90,
        receivedBytes: uint8Array.length,
        totalBytes: uint8Array.length,
        statusText: 'Analyzing duration...',
      });

      // 1. Check if the download API provided duration in headers
      let durationSeconds = parseDurationToSeconds(rawDuration);

      // 2. If not in headers, measure the saved MP3 file directly
      if (durationSeconds <= 0) {
        durationSeconds = await detectLocalAudioDuration(targetFilePath);
      }

      const formatted = formatDuration(durationSeconds);

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
        duration: durationSeconds,
        durationFormatted: formatted,
        thumbnailUrl: localArtworkUri,
        fileUri: targetFilePath,
        createdAt: Date.now(),
        isFavorite: false,
      };
    } catch (err: unknown) {
      if (signal?.aborted) {
        throw new Error('Download aborted by user');
      }

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