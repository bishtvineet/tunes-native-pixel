import { Platform, ViewStyle } from 'react-native';

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Generates identical visual depth on both Android and iOS.
 * Android maps to native hardware elevation, while iOS computes
 * matching Quartz shadow offset, opacity, and radius.
 */
export const getElevation = (level: ElevationLevel): ViewStyle => {
  switch (level) {
    case 1:
      return Platform.select({
        android: { elevation: 2 },
        default: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.18,
          shadowRadius: 2,
        },
      });
    case 2:
      return Platform.select({
        android: { elevation: 4 },
        default: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.22,
          shadowRadius: 5,
        },
      });
    case 3:
      return Platform.select({
        android: { elevation: 8 },
        default: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
        },
      });
    case 4:
      return Platform.select({
        android: { elevation: 12 },
        default: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.36,
          shadowRadius: 16,
        },
      });
    case 5:
      return Platform.select({
        android: { elevation: 20 },
        default: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.46,
          shadowRadius: 24,
        },
      });
    default:
      return Platform.select({
        android: { elevation: 0 },
        default: {
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
        },
      });
  }
};