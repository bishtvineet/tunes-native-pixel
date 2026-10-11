import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../../components/common/Icon';
import {
  fetchVideoInfo,
  downloadAudioStream,
} from '../../api/youtubeService';
import type { VideoInfo, Track, ProgressCallbackData } from '../../types';

interface SearchScreenProps {
  onTrackSaved: (track: Track) => Promise<void>;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ onTrackSaved }) => {
  const { tokens, shapes } = useTheme();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<ProgressCallbackData | null>(null);
  const [preview, setPreview] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetchInfo = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const info = await fetchVideoInfo(url.trim());
      setPreview(info);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch video information';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!url.trim()) return;
    setDownloading(true);
    setDownloadProgress({
      percent: 0,
      receivedBytes: 0,
      totalBytes: 0,
      statusText: 'Connecting to audio stream...',
    });
    setError(null);

    try {
      const track = await downloadAudioStream(
        url.trim(),
        preview,
        (progressData) => {
          setDownloadProgress(progressData);
        },
        3,
        2000
      );

      await onTrackSaved(track);
      setUrl('');
      setPreview(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setError(msg);
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.headerTitle, { color: tokens.onSurface }]}>Search & Download</Text>
      <Text style={[styles.headerSubtitle, { color: tokens.onSurfaceVariant }]}>
        Paste any YouTube or Music URL to save directly for offline playback.
      </Text>

      {/* Input Card Container */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: tokens.surfaceVariant,
            borderRadius: shapes.lg,
          },
        ]}
      >
        <View style={styles.inputRow}>
          <View style={styles.searchIconBox}>
            <Icon name="search" size={20} color={tokens.outline} />
          </View>

          <TextInput
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              setError(null);
            }}
            placeholder="Paste YouTube audio link..."
            placeholderTextColor={tokens.onSurfaceVariant}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[
              styles.textInput,
              {
                backgroundColor: tokens.surface,
                color: tokens.onSurface,
                borderRadius: shapes.md,
                borderColor: tokens.outline,
              },
            ]}
          />
        </View>

        {!preview && (
          <TouchableOpacity
            onPress={handleFetchInfo}
            disabled={loading || !url.trim()}
            activeOpacity={0.8}
            style={[
              styles.actionButton,
              {
                backgroundColor: tokens.primary,
                borderRadius: shapes.pill,
                opacity: loading || !url.trim() ? 0.5 : 1,
              },
            ]}
          >
            {loading ? (
              <View style={styles.btnContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.btnText}>Fetching Audio Info...</Text>
              </View>
            ) : (
              <View style={styles.btnContent}>
                <Icon name="search" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>Preview Track</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {error && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                borderRadius: shapes.sm,
              },
            ]}
          >
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Preview Card */}
      {preview && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: tokens.surfaceVariant,
              borderRadius: shapes.lg,
              marginTop: 16,
            },
          ]}
        >
          <View style={styles.previewMetaRow}>
            <Image
              source={{ uri: preview.thumbnail }}
              style={[styles.thumbnail, { borderRadius: shapes.md }]}
            />
            <View style={styles.previewMeta}>
              <Text numberOfLines={1} style={[styles.trackTitle, { color: tokens.onSurface }]}>
                {preview.title}
              </Text>
              <Text numberOfLines={1} style={[styles.channelTitle, { color: tokens.onSurfaceVariant }]}>
                {preview.channel}
              </Text>
              <View
                style={[
                  styles.durationBadge,
                  {
                    backgroundColor: tokens.primaryContainer,
                    borderRadius: shapes.sm,
                  },
                ]}
              >
                <Text style={[styles.durationBadgeText, { color: tokens.primary }]}>
                  {preview.durationFormatted}
                </Text>
              </View>
            </View>
          </View>

          {/* Download Progress Bar */}
          {downloading && downloadProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTextRow}>
                <Text style={[styles.progressStatus, { color: tokens.onSurfaceVariant }]}>
                  {downloadProgress.statusText}
                </Text>
                {downloadProgress.percent >= 0 && (
                  <Text style={[styles.progressPercent, { color: tokens.primary }]}>
                    {downloadProgress.percent}%
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: tokens.surface, borderRadius: shapes.sm },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: downloadProgress.percent >= 0 ? `${downloadProgress.percent}%` : '40%',
                      backgroundColor: tokens.primary,
                      borderRadius: shapes.sm,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.8}
            style={[
              styles.actionButton,
              {
                backgroundColor: tokens.primary,
                borderRadius: shapes.pill,
                opacity: downloading ? 0.6 : 1,
                marginTop: 12,
              },
            ]}
          >
            {downloading ? (
              <View style={styles.btnContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.btnText}>Downloading & Writing Disk...</Text>
              </View>
            ) : (
              <View style={styles.btnContent}>
                <Icon name="download" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>Download Offline</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 160,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchIconBox: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingLeft: 42,
    paddingRight: 16,
    fontSize: 13,
    borderWidth: 1,
  },
  actionButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    marginTop: 10,
    padding: 10,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 64,
    height: 64,
  },
  previewMeta: {
    flex: 1,
    marginLeft: 14,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  channelTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  durationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 14,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressStatus: {
    fontSize: 11,
    flex: 1,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});