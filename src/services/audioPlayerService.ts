/**
 * Background audio lifecycle configuration.
 * react-native-track-player manages the native AudioSession (iOS)
 * and ForegroundService (Android) lifecycle directly.
 */
export const configureBackgroundAudio = async (): Promise<void> => {
  // Handled natively by react-native-track-player playback service
};