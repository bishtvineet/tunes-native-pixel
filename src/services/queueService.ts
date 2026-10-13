import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchVideoInfo, downloadAudioStream } from './api';
import type { VideoInfo, Track } from '../types';

const QUEUE_STORAGE_KEY = 'tunes_download_queue';
const MAX_CONCURRENT_KEY = 'tunes_max_concurrent_downloads';

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
  private abortControllers: Map<string, AbortController> = new Map();
  private activeDownloads: Set<string> = new Set();
  private maxConcurrentDownloads = 1;
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
      const [rawQueue, rawLimit] = await Promise.all([
        AsyncStorage.getItem(QUEUE_STORAGE_KEY),
        AsyncStorage.getItem(MAX_CONCURRENT_KEY),
      ]);

      if (rawLimit) {
        const parsedLimit = parseInt(rawLimit, 10);
        if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 4) {
          this.maxConcurrentDownloads = parsedLimit;
        }
      }

      if (rawQueue) {
        const parsed: QueueItem[] = JSON.parse(rawQueue);
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

  public getMaxConcurrentDownloads(): number {
    return this.maxConcurrentDownloads;
  }

  public async setMaxConcurrentDownloads(limit: number): Promise<void> {
    const clamped = Math.max(1, Math.min(4, Math.floor(limit)));
    this.maxConcurrentDownloads = clamped;
    await AsyncStorage.setItem(MAX_CONCURRENT_KEY, clamped.toString()).catch(() => {});

    // If limit was decreased, scale down active downloads
    if (this.activeDownloads.size > clamped) {
      const activeArray = Array.from(this.activeDownloads);
      const excessCount = this.activeDownloads.size - clamped;
      // Abort the most recently started active downloads
      const toPause = activeArray.slice(-excessCount);

      for (const id of toPause) {
        const controller = this.abortControllers.get(id);
        if (controller) {
          controller.abort();
          this.abortControllers.delete(id);
        }
        this.activeDownloads.delete(id);
        this.updateItem(id, {
          status: 'pending',
          statusText: 'In queue...',
        });
      }
    } else {
      this.checkAndProcessNext();
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
      this.checkAndProcessNext();
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
      this.checkAndProcessNext();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch details';
      this.updateItem(itemId, {
        status: 'error',
        errorMessage: msg,
        statusText: 'Meta fetch error',
      });
      this.checkAndProcessNext();
    }
  }

  // Token-Bucket: spawns download tasks up to maxConcurrentDownloads limit
  public checkAndProcessNext() {
    while (this.activeDownloads.size < this.maxConcurrentDownloads) {
      const nextItem = this.queue.find(
        (item) => item.status === 'pending' && !this.activeDownloads.has(item.id)
      );

      if (!nextItem) break;
      this.startDownloadTask(nextItem);
    }
  }

  private async startDownloadTask(item: QueueItem) {
    const controller = new AbortController();
    this.abortControllers.set(item.id, controller);
    this.activeDownloads.add(item.id);

    try {
      this.updateItem(item.id, {
        status: 'downloading',
        statusText: 'Downloading stream...',
        progressPercent: 10,
      });

      const track = await downloadAudioStream(
        item.url,
        item.videoInfo,
        (progress) => {
          this.updateItem(item.id, {
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

      this.updateItem(item.id, {
        status: 'completed',
        durationFormatted: track.durationFormatted,
        statusText: 'Saved to library',
        progressPercent: 100,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        // Handled directly inside cancel/pause/scale logic
      } else {
        const msg = err instanceof Error ? err.message : 'Download failed';
        this.updateItem(item.id, {
          status: 'error',
          errorMessage: msg,
          statusText: msg,
        });
      }
    } finally {
      this.abortControllers.delete(item.id);
      this.activeDownloads.delete(item.id);
      setTimeout(() => this.checkAndProcessNext(), 50);
    }
  }

  public cancelItem(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
    this.activeDownloads.delete(id);

    this.updateItem(id, {
      status: 'paused',
      statusText: 'Paused',
    });

    setTimeout(() => this.checkAndProcessNext(), 50);
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
      this.checkAndProcessNext();
    }
  }

  public removeItem(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
    this.activeDownloads.delete(id);
    this.queue = this.queue.filter((item) => item.id !== id);
    this.notify();

    setTimeout(() => this.checkAndProcessNext(), 50);
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
    setTimeout(() => this.checkAndProcessNext(), 50);
  }

  public bulkRemove(ids: string[]) {
    ids.forEach((id) => {
      const controller = this.abortControllers.get(id);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(id);
      }
      this.activeDownloads.delete(id);
    });
    this.queue = this.queue.filter((item) => !ids.includes(item.id));
    this.notify();
    setTimeout(() => this.checkAndProcessNext(), 50);
  }
}

export const queueService = new QueueService();