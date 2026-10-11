import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../common/Icon';
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

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: isPlaying ? tokens.surfaceVariant : 'transparent',
          borderRadius: shapes.md,
        },
      ]}
    >
      {/* Thumbnail artwork / fallback placeholder */}
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
          <Image source={{ uri: song.thumbnailUrl }} style={styles.artwork} />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="library" size={20} color={tokens.outline} />
          </View>
        )}
      </View>

      {/* Track Title and Artist details */}
      <View style={styles.metaContainer}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            { color: isPlaying ? tokens.primary : tokens.onSurface },
          ]}
        >
          {song.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.artist, { color: tokens.onSurfaceVariant }]}
        >
          {song.artist} • {song.durationFormatted}
        </Text>
      </View>

      {/* Row action buttons */}
      <View style={styles.actions}>
        {onToggleFavorite && (
          <TouchableOpacity onPress={onToggleFavorite} style={styles.iconBtn}>
            <Icon
              name={song.isFavorite ? 'heart-filled' : 'heart-outline'}
              size={20}
              color={song.isFavorite ? tokens.accentPink : tokens.outline}
            />
          </TouchableOpacity>
        )}

        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
            <Icon name="close" size={18} color={tokens.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  artWrapper: {
    width: 48,
    height: 48,
    overflow: 'hidden',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
});