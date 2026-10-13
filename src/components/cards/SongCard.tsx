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
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onAddToLibrary?: () => void;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  isPlaying = false,
  isSelectionMode = false,
  isSelected = false,
  onPress,
  onLongPress,
  onToggleFavorite,
  onDelete,
  onAddToLibrary,
}) => {
  const { tokens, shapes } = useTheme();

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
      onLongPress={onLongPress}
      pressedScale={0.98}
      style={[
        styles.cardContainer,
        {
          backgroundColor: isSelected
            ? tokens.primaryContainer + '30'
            : isPlaying
            ? tokens.surfaceVariant
            : tokens.surface,
          borderRadius: shapes.md,
          borderColor: isSelected
            ? tokens.primary
            : isPlaying
            ? tokens.primary
            : 'rgba(255, 255, 255, 0.05)',
        },
      ]}
    >
      {/* Leading Checkbox when in Multi-Select Mode */}
      {isSelectionMode ? (
        <View
          style={[
            styles.selectionCheckbox,
            {
              borderColor: isSelected ? tokens.primary : tokens.outline + '55',
              backgroundColor: isSelected ? tokens.primary : 'transparent',
              borderRadius: shapes.sm,
            },
          ]}
        >
          {isSelected && <Icon name="check" size={13} color="#FFFFFF" />}
        </View>
      ) : null}

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
          style={[
            styles.title,
            {
              color: isSelected
                ? tokens.primary
                : isPlaying
                ? tokens.primary
                : tokens.onSurface,
            },
          ]}
        >
          {song.title}
        </Text>
        <Text numberOfLines={1} style={[styles.artist, { color: tokens.onSurfaceVariant }]}>
          {song.artist} • {displayDuration}
        </Text>
      </View>

      {/* Show Standard Row Actions only when NOT in Selection Mode */}
      {!isSelectionMode ? (
        <View style={styles.actionRow}>
          {onAddToLibrary && (
            <M3Pressable onPress={onAddToLibrary} style={styles.iconBtn}>
              <Icon name="queue" size={17} color={tokens.onSurfaceVariant} />
            </M3Pressable>
          )}

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
      ) : null}
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
  selectionCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
});