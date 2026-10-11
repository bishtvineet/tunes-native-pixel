import { useState, useRef, useEffect, useCallback } from 'react';
import {
  createAudioPlayer,
  AudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import type { Track, RepeatMode, PlaybackContext } from '../types';

export const useAudioPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext>('All');

  const activeQueueRef = useRef<Track[]>([]);
  const repeatModeRef = useRef<RepeatMode>('off');
  const currentTrackRef = useRef<Track | null>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Configure native audio session on mount with background playback enabled
  useEffect(() => {
    const initAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          staysActiveInBackground: true,
          interruptionMode: 'doNotMix',
          shouldRouteThroughEarpiece: false,
        } as any);
      } catch (err) {
        console.warn('[AudioPlayer] AudioMode initialization warning:', err);
      }
    };

    initAudio();

    return () => {
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.remove === 'function') {
            playerRef.current.remove();
          } else if (typeof playerRef.current.release === 'function') {
            playerRef.current.release();
          }
        } catch {}
      }
    };
  }, []);

  const nextTrackRef = useRef<() => void>(() => {});

  const playTrack = useCallback(
    async (track: Track, context: PlaybackContext = 'All', queue: Track[] = []) => {
      try {
        setPlaybackContext(context);
        if (queue.length > 0) {
          activeQueueRef.current = queue;
        }

        // Release previous player instance if active
        if (playerRef.current) {
          try {
            if (typeof playerRef.current.setActiveForLockScreen === 'function') {
              playerRef.current.setActiveForLockScreen(false);
            }
            if (typeof playerRef.current.remove === 'function') {
              playerRef.current.remove();
            } else if (typeof playerRef.current.release === 'function') {
              playerRef.current.release();
            }
          } catch {}
          playerRef.current = null;
        }

        const newPlayer: any = createAudioPlayer({ uri: track.fileUri });

        if (typeof newPlayer.setActiveForLockScreen === 'function') {
          newPlayer.setActiveForLockScreen(true);
        }

        if (typeof newPlayer.addListener === 'function') {
          newPlayer.addListener('playbackStatusUpdate', (status: any) => {
            setIsPlaying(Boolean(status?.playing));
            setCurrentTime(Math.floor(status?.currentTime || 0));
            setDuration(Math.floor(status?.duration || 0));

            if (status?.didJustFinish) {
              const mode = repeatModeRef.current;
              if (mode === 'one') {
                newPlayer.seekTo(0);
                newPlayer.play();
              } else if (mode === 'all') {
                nextTrackRef.current();
              } else {
                setIsPlaying(false);
                newPlayer.seekTo(0);
              }
            }
          });
        }

        playerRef.current = newPlayer;
        setCurrentTrack(track);
        currentTrackRef.current = track;

        newPlayer.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('[AudioPlayer] Failed to load and play track:', err);
      }
    },
    []
  );

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;

    if (isPlaying) {
      p.pause();
      setIsPlaying(false);
    } else {
      p.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seek = useCallback((seconds: number) => {
    const p = playerRef.current;
    if (!p) return;

    p.seekTo(seconds);
    setCurrentTime(seconds);
  }, []);

  const nextTrack = useCallback(() => {
    const queue = activeQueueRef.current;
    const track = currentTrackRef.current;
    if (!queue.length || !track) return;

    const currentIndex = queue.findIndex((t) => t.id === track.id);
    if (currentIndex === -1) return;

    if (currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1], playbackContext, queue);
    } else {
      playTrack(queue[0], playbackContext, queue);
    }
  }, [playbackContext, playTrack]);

  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

  const prevTrack = useCallback(() => {
    const queue = activeQueueRef.current;
    const track = currentTrackRef.current;
    const p = playerRef.current;
    if (!queue.length || !track) return;

    if (p && currentTime > 3) {
      p.seekTo(0);
      setCurrentTime(0);
      return;
    }

    const currentIndex = queue.findIndex((t) => t.id === track.id);
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1], playbackContext, queue);
    } else {
      playTrack(queue[queue.length - 1], playbackContext, queue);
    }
  }, [playbackContext, playTrack, currentTime]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      let next: RepeatMode = 'off';
      if (prev === 'off') next = 'all';
      else if (prev === 'all') next = 'one';
      else next = 'off';
      repeatModeRef.current = next;
      return next;
    });
  }, []);

  const stopTrack = useCallback(() => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.setActiveForLockScreen === 'function') {
          playerRef.current.setActiveForLockScreen(false);
        }
        playerRef.current.pause();
        if (typeof playerRef.current.remove === 'function') {
          playerRef.current.remove();
        } else if (typeof playerRef.current.release === 'function') {
          playerRef.current.release();
        }
      } catch {}
      playerRef.current = null;
    }
    setCurrentTrack(null);
    currentTrackRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const updatePlaybackContext = useCallback(
    (context: PlaybackContext, queue: Track[]) => {
      setPlaybackContext(context);
      activeQueueRef.current = queue;
    },
    []
  );

  return {
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
  };
};