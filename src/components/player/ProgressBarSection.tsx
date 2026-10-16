import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppText } from '../common/AppText';
import { WavySliderExpressive } from './WavySliderExpressive';
import { formatDuration } from '../../utils/audio';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCRUBBER_TRACK_WIDTH = SCREEN_WIDTH - 48;

interface ProgressBarSectionProps {
  progressFraction: number; // 0.0 to 1.0
  currentTimeSeconds: number;
  totalDurationSeconds: number;
  isPlaying: boolean;
  onSeekChange: (fraction: number) => void;
  onSeekCommit: (fraction: number) => void;
}

export const ProgressBarSection: React.FC<ProgressBarSectionProps> = ({
  progressFraction,
  currentTimeSeconds,
  totalDurationSeconds,
  isPlaying,
  onSeekChange,
  onSeekCommit,
}) => {
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      <WavySliderExpressive
        progressFraction={progressFraction}
        isPlaying={isPlaying}
        onSeekChange={onSeekChange}
        onSeekCommit={onSeekCommit}
        activeTrackColor={tokens.primary}
        inactiveTrackColor="rgba(255, 255, 255, 0.18)"
        thumbColor={tokens.primary}
        trackWidth={SCRUBBER_TRACK_WIDTH}
      />

      <View style={styles.timeLabelRow}>
        <AppText variant="secondary" style={styles.timeText}>
          {formatDuration(currentTimeSeconds)}
        </AppText>
        <AppText variant="secondary" style={styles.timeText}>
          {formatDuration(totalDurationSeconds)}
        </AppText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 4,
  },
  timeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});