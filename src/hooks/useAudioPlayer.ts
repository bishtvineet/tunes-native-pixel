import { useState, useRef, useEffect, useCallback } from 'react';
import TrackPlayer, {
  Capability,
  State,
  usePlaybackState,
  useProgress,
  Event,
  useTrackPlayerEvents,
  RepeatMode as TrackPlayerRepeatMode,
} from 'react-native-track-player';
import { updateTrackDuration } from '../services/storage';
import type { Track, RepeatMode, PlaybackContext } from '../types';

let isPlayerSetup = false;

const setupPlayer = async (): Promise<void> => {
  if (isPlayerSetup) return;
  try {
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
    });
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
    });
    isPlayerSetup = true;
  } catch {
    // Already setup
    isPlayerSetup = true;
  }
};

export function useAudioPlayer() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext>('All');
  const [queue, setQueue] = useState<Track[]>([]);

  const queueRef = useRef<Track[]>([]);
  const currentTrackRef = useRef<Track | null>(null);
  const repeatModeRef = useRef<RepeatMode>('off');
  const isShuffleRef = useRef<boolean>(false);

  const playbackState = usePlaybackState();
  const { position, duration: trackPlayerDuration } = useProgress(500);

  const isPlaying = playbackState.state === State.Playing;

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
    setupPlayer().catch(console.error);
  }, []);

  // Update current track when the active track changes in TrackPlayer
  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], async (event) => {
    if (event.track) {
      const active = queueRef.current.find((t) => t.id === event.track?.id);
      if (active) {
        setCurrentTrack(active);
      }
    }
  });

  // Track finished listener to handle repeat modes
  useTrackPlayerEvents([Event.PlaybackQueueEnded], async () => {
    if (repeatModeRef.current === 'all' && queueRef.current.length > 0) {
      await TrackPlayer.skip(0);
      await TrackPlayer.play();
    }
  });

  // Persist duration if missing
  useEffect(() => {
    if (currentTrack && trackPlayerDuration > 0) {
      if (
        !currentTrack.duration ||
        currentTrack.duration <= 0 ||
        !currentTrack.durationFormatted ||
        currentTrack.durationFormatted === '--:--'
      ) {
        const totalSecs = Math.floor(trackPlayerDuration);
        currentTrack.duration = totalSecs;
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        currentTrack.durationFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;
        updateTrackDuration(currentTrack.id, totalSecs);
      }
    }
  }, [currentTrack, trackPlayerDuration]);

  const playTrack = useCallback(
    async (track: Track, context: PlaybackContext = 'All', newQueue?: Track[]) => {
      if (!track || !track.fileUri) return;
      await setupPlayer();

      const activeList = newQueue && newQueue.length > 0 ? newQueue : [track];
      setQueue(activeList);
      queueRef.current = activeList;
      setPlaybackContext(context);
      setCurrentTrack(track);

      await TrackPlayer.reset();

      const formattedTracks = activeList.map((t) => ({
        id: t.id,
        url: t.fileUri,
        title: t.title,
        artist: t.artist,
        artwork: t.thumbnailUrl ? t.thumbnailUrl : undefined,
        duration: t.duration && t.duration > 0 ? t.duration : undefined,
      }));

      await TrackPlayer.add(formattedTracks);

      const targetIndex = activeList.findIndex((t) => t.id === track.id);
      if (targetIndex > 0) {
        await TrackPlayer.skip(targetIndex);
      }

      await TrackPlayer.play();
    },
    []
  );

  const togglePlay = useCallback(async () => {
    const state = await TrackPlayer.getPlaybackState();
    if (state.state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, []);

  const seek = useCallback(async (seconds: number) => {
    await TrackPlayer.seekTo(Math.max(0, seconds));
  }, []);

  const nextTrack = useCallback(async () => {
    if (repeatModeRef.current === 'one') {
      await TrackPlayer.seekTo(0);
      await TrackPlayer.play();
      return;
    }

    try {
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
    } catch {
      if (repeatModeRef.current === 'all' && queueRef.current.length > 0) {
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
      }
    }
  }, []);

  const prevTrack = useCallback(async () => {
    if (position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }
    try {
      await TrackPlayer.skipToPrevious();
      await TrackPlayer.play();
    } catch {
      await TrackPlayer.seekTo(0);
    }
  }, [position]);

  const toggleRepeat = useCallback(async () => {
    setRepeatMode((prev) => {
      let next: RepeatMode = 'off';
      if (prev === 'off') next = 'all';
      else if (prev === 'all') next = 'one';
      else next = 'off';

      if (next === 'one') {
        TrackPlayer.setRepeatMode(TrackPlayerRepeatMode.Track).catch(() => {});
      } else if (next === 'all') {
        TrackPlayer.setRepeatMode(TrackPlayerRepeatMode.Queue).catch(() => {});
      } else {
        TrackPlayer.setRepeatMode(TrackPlayerRepeatMode.Off).catch(() => {});
      }
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        const current = currentTrackRef.current;
        const remaining = queueRef.current.filter((t) => t.id !== current?.id);
        const shuffled = remaining.sort(() => Math.random() - 0.5);
        const newQ = current ? [current, ...shuffled] : shuffled;
        setQueue(newQ);
      } else {
        setQueue(queueRef.current);
      }
      return nextVal;
    });
  }, []);

  const stopTrack = useCallback(async () => {
    await TrackPlayer.reset();
    setCurrentTrack(null);
  }, []);

  const updatePlaybackContext = useCallback(
    (context: PlaybackContext, updatedQueue: Track[]) => {
      setPlaybackContext(context);
      setQueue(updatedQueue);
      queueRef.current = updatedQueue;
    },
    []
  );

  return {
    currentTrack,
    isPlaying,
    currentTime: position,
    duration: trackPlayerDuration || currentTrack?.duration || 0,
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