import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchVideoInfo, downloadAudioStream } from './api';
import type { VideoInfo, Track } from '../types';

const QUEUE_STORAGE_KEY = 'tunes_download_queue';

export type QueueItemStatus =
  | 'fetching_info'
  | 'pending'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'error';

export interface QueueItem {
  id: string;
  url: string;
  title?: string;
  channel?: string;
  thumbnail?: string;
  durationFormatted?: string;
  status: QueueItemStatus;
  progressPercent: number;
  statusText: string;
  videoInfo?: VideoInfo | null;
  errorMessage?: string;
  createdAt: number;
}

type QueueListener = (items: QueueItem[]) => void;
type TrackSavedCallback = (track: Track) => Promise<void>;

class QueueService {
  private queue: QueueItem[] = [];
  private listeners: Set<QueueListener> = new Set();
  private isProcessing = false;
  private abortControllers: Map<string, AbortController> = new Map();
  private onTrackSavedCallback: TrackSavedCallback | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public registerTrackSavedCallback(cb: TrackSavedCallback) {
    this.onTrackSavedCallback = cb;
  }

  private async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed: QueueItem[] = JSON.parse(raw);
        // If app was killed while downloading, mark paused
        this.queue = parsed.map((item) => {
          if (item.status === 'downloading' || item.status === 'fetching_info') {
            return {
              ...item,
              status: 'paused',
              statusText: 'Paused (App closed)',
            };
          }
          return item;
        });
        this.notify();
      }
    } catch (err) {
      console.warn('[QueueService] Boot load error:', err);
    }
  }

  public getQueue(): QueueItem[] {
    return [...this.queue];
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.queue];
    this.listeners.forEach((l) => l(copy));
    AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(copy)).catch(() => {});
  }

  private updateItem(id: string, updates: Partial<QueueItem>) {
    this.queue = this.queue.map((item) => (item.id === id ? { ...item, ...updates } : item));
    this.notify();
  }

  public addToQueue(url: string, videoInfo?: VideoInfo | null) {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    const hasInfoAlready = Boolean(videoInfo);
    const newId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newItem: QueueItem = {
      id: newId,
      url: cleanUrl,
      title: videoInfo?.title || cleanUrl,
      channel: videoInfo?.channel,
      thumbnail: videoInfo?.thumbnail,
      durationFormatted: videoInfo?.durationFormatted,
      status: hasInfoAlready ? 'pending' : 'fetching_info',
      progressPercent: 5,
      statusText: hasInfoAlready ? 'In queue...' : 'Resolving info...',
      videoInfo: videoInfo || null,
      createdAt: Date.now(),
    };

    this.queue.push(newItem);
    this.notify();

    if (!hasInfoAlready) {
      this.fetchInfoImmediately(newId, cleanUrl);
    } else {
      setTimeout(() => this.processNext(), 50);
    }
  }

  private async fetchInfoImmediately(itemId: string, itemUrl: string) {
    try {
      const info = await fetchVideoInfo(itemUrl);
      this.updateItem(itemId, {
        videoInfo: info,
        title: info.title,
        channel: info.channel,
        thumbnail: info.thumbnail,
        status: 'pending',
        statusText: 'In queue...',
      });
      setTimeout(() => this.processNext(), 50);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch details';
      this.updateItem(itemId, {
        status: 'error',
        errorMessage: msg,
        statusText: 'Meta fetch error',
      });
    }
  }

  public async processNext() {
    if (this.isProcessing) return;

    const nextItem = this.queue.find((item) => item.status === 'pending');
    if (!nextItem) return;

    this.isProcessing = true;
    const controller = new AbortController();
    this.abortControllers.set(nextItem.id, controller);

    try {
      this.updateItem(nextItem.id, {
        status: 'downloading',
        statusText: 'Downloading stream...',
        progressPercent: 10,
      });

      const track = await downloadAudioStream(
        nextItem.url,
        nextItem.videoInfo,
        (progress) => {
          this.updateItem(nextItem.id, {
            progressPercent: Math.max(10, progress.percent),
            statusText: progress.statusText,
          });
        },
        3,
        2000,
        controller.signal
      );

      if (this.onTrackSavedCallback) {
        await this.onTrackSavedCallback(track);
      }

      this.updateItem(nextItem.id, {
        status: 'completed',
        durationFormatted: track.durationFormatted,
        statusText: 'Saved to library',
        progressPercent: 100,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        this.updateItem(nextItem.id, {
          status: 'paused',
          statusText: 'Paused by user',
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Download failed';
        this.updateItem(nextItem.id, {
          status: 'error',
          errorMessage: msg,
          statusText: msg,
        });
      }
    } finally {
      this.abortControllers.delete(nextItem.id);
      this.isProcessing = false;
      setTimeout(() => this.processNext(), 150);
    }
  }

  public cancelItem(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
    this.updateItem(id, {
      status: 'paused',
      statusText: 'Paused',
    });
  }

  public resumeItem(id: string) {
    const item = this.queue.find((q) => q.id === id);
    if (!item) return;

    if (!item.videoInfo) {
      this.updateItem(id, {
        status: 'fetching_info',
        statusText: 'Retrying details...',
        errorMessage: undefined,
      });
      this.fetchInfoImmediately(id, item.url);
    } else {
      this.updateItem(id, {
        status: 'pending',
        statusText: 'Queued',
        errorMessage: undefined,
      });
      setTimeout(() => this.processNext(), 50);
    }
  }

  public removeItem(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
    this.queue = this.queue.filter((item) => item.id !== id);
    this.notify();
  }

  public bulkResume(ids: string[]) {
    this.queue = this.queue.map((item) => {
      if (ids.includes(item.id) && (item.status === 'paused' || item.status === 'error')) {
        if (!item.videoInfo) {
          this.fetchInfoImmediately(item.id, item.url);
          return {
            ...item,
            status: 'fetching_info',
            statusText: 'Fetching details...',
            errorMessage: undefined,
          };
        }
        return {
          ...item,
          status: 'pending',
          statusText: 'Queued',
          errorMessage: undefined,
        };
      }
      return item;
    });
    this.notify();
    setTimeout(() => this.processNext(), 100);
  }

  public bulkRemove(ids: string[]) {
    ids.forEach((id) => {
      const controller = this.abortControllers.get(id);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(id);
      }
    });
    this.queue = this.queue.filter((item) => !ids.includes(item.id));
    this.notify();
  }
}

export const queueService = new QueueService();