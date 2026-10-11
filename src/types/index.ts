export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
  originalUrl: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  durationFormatted: string;
  thumbnailUrl: string;
  fileUri: string; // Permanent offline audio path on device disk
  createdAt: number;
  isFavorite?: boolean;
}

export type Song = Track;

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaybackContext = 'All' | 'Favorite';

export interface ProgressCallbackData {
  percent: number; // 0 to 100, or -1 when indeterminate
  receivedBytes: number;
  totalBytes: number;
  statusText: string;
}