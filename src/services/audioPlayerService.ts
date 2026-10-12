import { setAudioModeAsync } from 'expo-audio';

let isConfigured = false;

export const configureBackgroundAudio = async (): Promise<void> => {
  if (isConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      staysActiveInBackground: true,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    } as any);
    isConfigured = true;
  } catch (error) {
    console.warn('[AudioService] Failed to set background audio mode:', error);
  }
};