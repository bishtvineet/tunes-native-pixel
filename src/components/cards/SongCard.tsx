import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../common/Icon';
import { M3Pressable } from '../common/M3Pressable';
import { formatDuration } from '../../utils/audio';
import type { Track } from '../../types';

interface SongCardProps {
  song: Track;
  isPlaying?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  isPlaying = false,
  onPress,
  onToggleFavorite,
  onDelete,
}) => {
  const { tokens, shapes } = useTheme();

  // Robust duration calculation: if durationFormatted is '--:--' or missing, compute from duration
  const displayDuration = React.useMemo(() => {
    if (song.durationFormatted && song.durationFormatted !== '--:--') {
      return song.durationFormatted;
    }
    if (song.duration && song.duration > 0) {
      return formatDuration(song.duration);
    }
    return '--:--';
  }, [song.duration, song.durationFormatted]);

  return (
    <M3Pressable
      onPress={onPress}
      pressedScale={0.98}
      style={[
        styles.cardContainer,
        {
          backgroundColor: isPlaying ? tokens.surfaceVariant : tokens.surface,
          borderRadius: shapes.md,
          borderColor: isPlaying ? tokens.primary : 'rgba(255, 255, 255, 0.05)',
        },
      ]}
    >
      <View
        style={[
          styles.artWrapper,
          {
            borderRadius: shapes.sm,
            backgroundColor: tokens.surfaceVariant,
          },
        ]}
      >
        {song.thumbnailUrl ? (
          <Image source={{ uri: song.thumbnailUrl }} style={styles.artImage} />
        ) : (
          <View style={styles.artFallback}>
            <Icon name="library" size={20} color={tokens.primary} />
          </View>
        )}
      </View>

      <View style={styles.metaContainer}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: isPlaying ? tokens.primary : tokens.onSurface }]}
        >
          {song.title}
        </Text>
        <Text numberOfLines={1} style={[styles.artist, { color: tokens.onSurfaceVariant }]}>
          {song.artist} • {displayDuration}
        </Text>
      </View>

      <View style={styles.actionRow}>
        {onToggleFavorite && (
          <M3Pressable onPress={onToggleFavorite} style={styles.iconBtn}>
            <Icon
              name={song.isFavorite ? 'heart-filled' : 'heart-outline'}
              size={18}
              color={song.isFavorite ? tokens.accentPink : tokens.onSurfaceVariant}
            />
          </M3Pressable>
        )}

        {onDelete && (
          <M3Pressable onPress={onDelete} style={styles.iconBtn}>
            <Icon name="close" size={16} color={tokens.onSurfaceVariant} />
          </M3Pressable>
        )}
      </View>
    </M3Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderWidth: 1.5,
  },
  artWrapper: {
    width: 48,
    height: 48,
    overflow: 'hidden',
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  artFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  artist: {
    fontSize: 12,
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 8,
  },
});