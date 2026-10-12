import { useState, useRef, useEffect, useCallback } from 'react';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import { updateTrackDuration } from '../services/storage';
import { configureBackgroundAudio } from '../services/audioPlayerService';
import type { Track, RepeatMode, PlaybackContext } from '../types';

export function useAudioPlayer() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext>('All');
  const [queue, setQueue] = useState<Track[]>([]);

  // Engine references
  const playerRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<Track[]>([]);
  const currentTrackRef = useRef<Track | null>(null);
  const repeatModeRef = useRef<RepeatMode>('off');
  const isShuffleRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const playRequestIdRef = useRef<number>(0);
  const isTransitioningRef = useRef<boolean>(false);
  const statusSubscriptionRef = useRef<any>(null);

  // Mutable refs for lock screen remote commands
  const nextTrackRef = useRef<() => void>(() => {});
  const prevTrackRef = useRef<() => void>(() => {});

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    configureBackgroundAudio();
    return () => {
      if (statusSubscriptionRef.current) {
        try {
          statusSubscriptionRef.current.remove?.();
        } catch {}
        statusSubscriptionRef.current = null;
      }
      if (playerRef.current) {
        try {
          if (typeof (playerRef.current as any).setActiveForLockScreen === 'function') {
            (playerRef.current as any).setActiveForLockScreen(false);
          }
          playerRef.current.pause();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  const safeTearDownCurrentPlayer = useCallback(() => {
    if (statusSubscriptionRef.current) {
      try {
        if (typeof statusSubscriptionRef.current.remove === 'function') {
          statusSubscriptionRef.current.remove();
        }
      } catch {}
      statusSubscriptionRef.current = null;
    }

    if (playerRef.current) {
      const p = playerRef.current;
      playerRef.current = null;
      try {
        if (typeof (p as any).setActiveForLockScreen === 'function') {
          (p as any).setActiveForLockScreen(false);
        }
        p.pause();
      } catch {}
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current || isTransitioningRef.current) return;
    try {
      if (isPlayingRef.current) {
        playerRef.current.pause();
        setIsPlaying(false);
        isPlayingRef.current = false;
      } else {
        playerRef.current.play();
        setIsPlaying(true);
        isPlayingRef.current = true;
      }
    } catch (err) {
      console.warn('[useAudioPlayer] togglePlay error:', err);
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    if (!playerRef.current) return;
    try {
      const target = Math.max(0, seconds);
      playerRef.current.seekTo(target);
      setCurrentTime(target);
    } catch (err) {
      console.warn('[useAudioPlayer] seek error:', err);
    }
  }, []);

  const playTrack = useCallback(
    async (track: Track, context: PlaybackContext = 'All', newQueue?: Track[]) => {
      if (!track || !track.fileUri) return;

      if (isTransitioningRef.current) {
        playRequestIdRef.current++;
      }
      isTransitioningRef.current = true;
      const currentRequestId = ++playRequestIdRef.current;

      try {
        safeTearDownCurrentPlayer();

        setCurrentTrack(track);
        setPlaybackContext(context);
        if (newQueue && newQueue.length > 0) {
          setQueue(newQueue);
          queueRef.current = newQueue;
        }

        const fallbackDur = track.duration && track.duration > 0 ? track.duration : 0;
        setDuration(fallbackDur);
        setCurrentTime(0);
        setIsPlaying(false);
        isPlayingRef.current = false;

        await configureBackgroundAudio();

        if (currentRequestId !== playRequestIdRef.current) {
          isTransitioningRef.current = false;
          return;
        }

        // Initialize AudioPlayer with updateInterval for native scrubber updates
        const newPlayer = createAudioPlayer(
          { uri: track.fileUri },
          { updateInterval: 1000 } as any
        );

        playerRef.current = newPlayer;

        // Native Lock Screen MediaSession registration matching your working implementation
        if (typeof (newPlayer as any).setActiveForLockScreen === 'function') {
          try {
            (newPlayer as any).setActiveForLockScreen(
              true,
              {
                title: track.title,
                artist: track.artist,
                artworkUrl: track.thumbnailUrl || undefined,
              },
              {
                showNextTrack: true,
                showPreviousTrack: true,
                // showSeekForward: true,
                // showSeekBackward: true,
              }
            );
          } catch {
            (newPlayer as any).setActiveForLockScreen(true);
          }
        }

        // Remote action listeners for lock screen transport buttons
        if (typeof (newPlayer as any).addListener === 'function') {
          try {
            (newPlayer as any).addListener('onRemoteNextTrack', () => {
              nextTrackRef.current();
            });
            (newPlayer as any).addListener('onRemotePreviousTrack', () => {
              prevTrackRef.current();
            });
          } catch {}
        }

        const handleStatus = (status: any) => {
          if (playerRef.current !== newPlayer || currentRequestId !== playRequestIdRef.current) {
            return;
          }

          const isNowPlaying = Boolean(status?.playing);
          setIsPlaying(isNowPlaying);
          isPlayingRef.current = isNowPlaying;

          const rawTime = status?.currentTime ?? newPlayer?.currentTime ?? 0;
          const rawDur = status?.duration ?? newPlayer?.duration ?? 0;

          const timeSec = rawTime > 1000 && (rawDur ? rawDur > 1000 : true) ? rawTime / 1000 : rawTime;
          const durSec = rawDur > 1000 ? rawDur / 1000 : rawDur;

          setCurrentTime(timeSec);

          if (durSec > 0) {
            setDuration(durSec);
            if (!track.duration || track.duration <= 0 || !track.durationFormatted || track.durationFormatted === '--:--') {
              track.duration = Math.floor(durSec);
              const m = Math.floor(durSec / 60);
              const s = Math.floor(durSec % 60);
              track.durationFormatted = `${m}:${s.toString().padStart(2, '0')}`;
              updateTrackDuration(track.id, Math.floor(durSec));
            }
          } else if (track.duration && track.duration > 0) {
            setDuration(track.duration);
          }

          if (status?.didJustFinish) {
            handleTrackDidFinish();
          }
        };

        if (typeof newPlayer.addListener === 'function') {
          statusSubscriptionRef.current = newPlayer.addListener('playbackStatusUpdate', handleStatus);
        }

        newPlayer.play();
        setIsPlaying(true);
        isPlayingRef.current = true;
      } catch (err) {
        console.error('[useAudioPlayer] playTrack critical error:', err);
      } finally {
        isTransitioningRef.current = false;
      }
    },
    [safeTearDownCurrentPlayer]
  );

  const handleTrackDidFinish = useCallback(() => {
    if (repeatModeRef.current === 'one') {
      if (playerRef.current) {
        try {
          playerRef.current.seekTo(0);
          playerRef.current.play();
          setIsPlaying(true);
          isPlayingRef.current = true;
        } catch {}
      }
      return;
    }

    const currentList = queueRef.current;
    const current = currentTrackRef.current;
    if (!currentList.length || !current) return;

    const currentIndex = currentList.findIndex((t) => t.id === current.id);
    let nextIndex = currentIndex + 1;

    if (nextIndex >= currentList.length) {
      if (repeatModeRef.current === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
    }

    const nextTrackItem = currentList[nextIndex];
    if (nextTrackItem) {
      playTrack(nextTrackItem, playbackContext, currentList);
    }
  }, [playTrack, playbackContext]);

  const nextTrack = useCallback(() => {
    if (isTransitioningRef.current) return;

    const list = queueRef.current;
    const current = currentTrackRef.current;
    if (!list.length || !current) return;

    if (repeatModeRef.current === 'one') {
      if (playerRef.current) {
        try {
          playerRef.current.seekTo(0);
          playerRef.current.play();
          setIsPlaying(true);
          isPlayingRef.current = true;
        } catch {}
      }
      return;
    }

    const currentIndex = list.findIndex((t) => t.id === current.id);
    let nextIndex = currentIndex + 1;

    if (nextIndex >= list.length) {
      if (repeatModeRef.current === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
    }

    const target = list[nextIndex];
    if (target) {
      playTrack(target, playbackContext, list);
    }
  }, [playTrack, playbackContext]);

  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

  const prevTrack = useCallback(() => {
    if (isTransitioningRef.current) return;

    const list = queueRef.current;
    const current = currentTrackRef.current;
    if (!list.length || !current) return;

    if (currentTime > 3) {
      if (playerRef.current) {
        try {
          playerRef.current.seekTo(0);
          setCurrentTime(0);
        } catch {}
      }
      return;
    }

    const currentIndex = list.findIndex((t) => t.id === current.id);
    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      prevIndex = repeatModeRef.current === 'all' ? list.length - 1 : 0;
    }

    const target = list[prevIndex];
    if (target) {
      playTrack(target, playbackContext, list);
    }
  }, [currentTime, playTrack, playbackContext]);

  useEffect(() => {
    prevTrackRef.current = prevTrack;
  }, [prevTrack]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        const shuffled = [...queueRef.current].sort(() => Math.random() - 0.5);
        setQueue(shuffled);
      } else {
        setQueue(queueRef.current);
      }
      return nextVal;
    });
  }, []);

  const stopTrack = useCallback(() => {
    safeTearDownCurrentPlayer();
    setCurrentTrack(null);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    setDuration(0);
  }, [safeTearDownCurrentPlayer]);

  const updatePlaybackContext = useCallback(
    (context: PlaybackContext, updatedQueue: Track[]) => {
      setPlaybackContext(context);
      setQueue(updatedQueue);
    },
    []
  );

  return {
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
  };
}