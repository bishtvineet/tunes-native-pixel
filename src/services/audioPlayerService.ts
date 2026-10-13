import { setAudioModeAsync } from 'expo-audio';

export const configureBackgroundAudio = async (): Promise<void> => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      staysActiveInBackground: true,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    } as any);
  } catch (error) {
    console.warn('[AudioService] Failed to set background audio mode:', error);
  }
};