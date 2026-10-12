import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../../components/common/Icon';
import { M3Pressable } from '../../components/common/M3Pressable';
import { fetchVideoInfo } from '../../services/api';
import { findDuplicateTrack } from '../../services/storage';
import { queueService, QueueItem } from '../../services/queueService';
import type { VideoInfo, Track } from '../../types';
import * as Haptics from 'expo-haptics';

interface SearchScreenProps {
  onTrackSaved: (track: Track) => Promise<void>;
}

interface QueueSongItemProps {
  item: QueueItem;
  tokens: any;
  shapes: any;
  onCancel: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  onCompleteFadeOut: (id: string) => void;
}

// Strict YouTube URL validator helper
export const isValidYouTubeUrl = (testUrl: string): boolean => {
  if (!testUrl || typeof testUrl !== 'string') return false;
  const trimmed = testUrl.trim();
  const ytRegex =
    /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com\/(watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}/i;
  return ytRegex.test(trimmed);
};

const QueueSongItem: React.FC<QueueSongItemProps> = ({
  item,
  tokens,
  shapes,
  onCancel,
  onResume,
  onRemove,
  onCompleteFadeOut,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isDownloading = item.status === 'downloading';
  const isResolving = item.status === 'fetching_info';

  useEffect(() => {
    if (item.status === 'completed') {
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }).start(() => {
          onCompleteFadeOut(item.id);
        });
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [item.status, item.id, fadeAnim, onCompleteFadeOut]);

  return (
    <Animated.View
      style={[
        styles.songCardContainer,
        {
          opacity: fadeAnim,
          transform: [
            {
              scale: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
          backgroundColor: isDownloading ? tokens.surfaceVariant : tokens.surface,
          borderRadius: shapes.md,
          borderColor: isDownloading ? tokens.primary : 'rgba(255, 255, 255, 0.05)',
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
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.artImage} />
        ) : isResolving ? (
          <ActivityIndicator size="small" color={tokens.primary} />
        ) : (
          <View style={styles.artFallback}>
            <Icon name="library" size={20} color={tokens.primary} />
          </View>
        )}
      </View>

      <View style={styles.metaContainer}>
        <Text
          numberOfLines={1}
          style={[styles.queueTrackTitle, { color: isDownloading ? tokens.primary : tokens.onSurface }]}
        >
          {item.title || item.url}
        </Text>

        <Text numberOfLines={1} style={[styles.artistSubtitle, { color: tokens.onSurfaceVariant }]}>
          {isResolving ? (
            'Fetching song details...'
          ) : isDownloading ? (
            `Downloading • ${item.progressPercent}%`
          ) : item.status === 'completed' ? (
            `Downloaded • ${item.durationFormatted && item.durationFormatted !== '--:--' ? item.durationFormatted : 'Saved'}`
          ) : item.status === 'paused' ? (
            'Paused • Tap to resume'
          ) : item.status === 'error' ? (
            item.statusText
          ) : item.channel ? (
            `${item.channel} • In Queue`
          ) : (
            'Queued'
          )}
        </Text>
      </View>

      <View style={styles.actionRow}>
        {isDownloading ? (
          <TouchableOpacity onPress={() => onCancel(item.id)} style={styles.iconBtn}>
            <Icon name="pause" size={17} color="#F87171" />
          </TouchableOpacity>
        ) : item.status === 'paused' || item.status === 'error' ? (
          <TouchableOpacity onPress={() => onResume(item.id)} style={styles.iconBtn}>
            <Icon name="play" size={17} color={tokens.primary} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.iconBtn}>
          <Icon name="close" size={16} color={tokens.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {isDownloading ? (
        <View style={styles.flushProgressTrack}>
          <View
            style={[
              styles.flushProgressFill,
              {
                width: `${item.progressPercent}%`,
                backgroundColor: tokens.primary,
              },
            ]}
          />
        </View>
      ) : null}
    </Animated.View>
  );
};

export const SearchScreen: React.FC<SearchScreenProps> = ({ onTrackSaved }) => {
  const { tokens, shapes } = useTheme();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Duplicate checks
  const [existingDuplicate, setExistingDuplicate] = useState<Track | null>(null);
  const [isDuplicateInQueue, setIsDuplicateInQueue] = useState(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    queueService.registerTrackSavedCallback(onTrackSaved);
    const unsubscribe = queueService.subscribe((updatedQueue) => {
      setQueue(updatedQueue);
    });
    return () => unsubscribe();
  }, [onTrackSaved]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const handlePasteFromClipboard = async () => {
    try {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      const text = await Clipboard.getStringAsync();
      const clean = text ? text.trim() : '';

      if (!clean) {
        setError('Clipboard is empty.');
        return;
      }

      setUrl(clean);
      setPreview(null);
      setExistingDuplicate(null);
      setIsDuplicateInQueue(false);

      if (!isValidYouTubeUrl(clean)) {
        setError('Pasted content is not a valid YouTube URL.');
      } else {
        setError(null);
      }
    } catch {
      setError('Could not access clipboard.');
    }
  };

  const handleFetchInfo = async () => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    if (!isValidYouTubeUrl(cleanUrl)) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      setError('Invalid YouTube link. Please paste a valid youtube.com or youtu.be URL.');
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);
    setExistingDuplicate(null);
    setIsDuplicateInQueue(false);

    try {
      const info = await fetchVideoInfo(cleanUrl);
      setPreview(info);

      const duplicateInDb = await findDuplicateTrack({
        id: info.id,
        title: info.title,
        channel: info.channel,
        thumbnail: info.thumbnail,
      });

      const currentQueue = queueService.getQueue();
      const inQueue = currentQueue.some(
        (q) =>
          q.url === info.originalUrl ||
          (info.id && q.id?.includes(info.id)) ||
          (q.title && info.title && q.title.trim().toLowerCase() === info.title.trim().toLowerCase())
      );

      if (duplicateInDb) {
        setExistingDuplicate(duplicateInDb);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      } else if (inQueue) {
        setIsDuplicateInQueue(true);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch video information';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = (videoData?: VideoInfo) => {
    const targetUrl = videoData?.originalUrl || url.trim();
    if (!targetUrl) return;

    if (!isValidYouTubeUrl(targetUrl)) {
      setError('Cannot queue: invalid YouTube URL.');
      return;
    }

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    queueService.addToQueue(targetUrl, videoData || null);

    setUrl('');
    setPreview(null);
    setExistingDuplicate(null);
    setIsDuplicateInQueue(false);
  };

  const handleItemCompletedFadeOut = (id: string) => {
    queueService.removeItem(id);
  };

  const handleCancelItem = (id: string) => {
    triggerHaptic();
    queueService.cancelItem(id);
  };

  const handleResumeItem = (id: string) => {
    triggerHaptic();
    queueService.resumeItem(id);
  };

  const handleRemoveItem = (id: string) => {
    triggerHaptic();
    queueService.removeItem(id);
    setSelectedIds((prev) => prev.filter((selId) => selId !== id));
  };

  const handleBulkResume = () => {
    triggerHaptic();
    queueService.bulkResume(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkRemove = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    queueService.bulkRemove(selectedIds);
    setSelectedIds([]);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─── 1. Header (OFFLINE ENGINE / Download Queue) ─── */}
      <View style={styles.headerBox}>
        <View style={styles.headerBadge}>
          <Icon name="sparkles" size={14} color={tokens.primary} />
          <Text style={[styles.headerBadgeText, { color: tokens.primary }]}>
            OFFLINE ENGINE
          </Text>
        </View>
        <Text style={[styles.headerTitle, { color: tokens.onSurface }]}>
          Download Queue
        </Text>
        <Text style={[styles.headerSubtitle, { color: tokens.onSurfaceVariant }]}>
          Paste links to queue multiple downloads. Tracks download sequentially in background.
        </Text>
      </View>

      {/* ─── 2. Input Card Panel with Enhanced Paste Button ─── */}
      <View
        style={[
          styles.cardPanel,
          {
            backgroundColor: tokens.surface,
            borderRadius: shapes.sheet,
            borderColor: error ? '#F87171' : tokens.outline + '40',
          },
        ]}
      >
        <View style={styles.inputRow}>
          <View style={styles.searchIconBox}>
            <Icon name="search" size={20} color={tokens.onSurfaceVariant} />
          </View>

          <TextInput
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              if (error) setError(null);
              setExistingDuplicate(null);
              setIsDuplicateInQueue(false);
            }}
            placeholder="Paste YouTube audio link..."
            placeholderTextColor={tokens.onSurfaceVariant + '75'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleFetchInfo}
            style={[
              styles.textInput,
              {
                backgroundColor: tokens.surfaceVariant + '35',
                color: tokens.onSurface,
                borderRadius: shapes.pill,
                borderColor: error ? '#F87171' : tokens.outline + '20',
              },
            ]}
          />

          {/* Right Action: Cross button if input is filled, otherwise Expressive Paste Chip */}
          {url.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setUrl('');
                setPreview(null);
                setError(null);
                setExistingDuplicate(null);
                setIsDuplicateInQueue(false);
              }}
              style={styles.clearBtnAction}
            >
              <Icon name="close" size={16} color={tokens.onSurfaceVariant} />
            </TouchableOpacity>
          ) : (
            <M3Pressable
              onPress={handlePasteFromClipboard}
              pressedScale={0.92}
              style={[
                styles.expressivePasteBtn,
                {
                  backgroundColor: tokens.primaryContainer,
                  borderColor: tokens.primary + '38',
                  borderRadius: shapes.pill,
                },
              ]}
            >
              <View style={styles.pasteBtnInner}>
                <Icon name="bookmark" size={13} color={tokens.primary} />
                <Text style={[styles.expressivePasteText, { color: tokens.primary }]}>
                  PASTE
                </Text>
              </View>
            </M3Pressable>
          )}
        </View>

        {!preview && (
          <TouchableOpacity
            onPress={handleFetchInfo}
            disabled={loading || !url.trim()}
            activeOpacity={0.85}
            style={[
              styles.actionPillBtn,
              {
                backgroundColor: tokens.primary,
                borderRadius: shapes.pill,
                opacity: loading || !url.trim() ? 0.45 : 1,
              },
            ]}
          >
            {loading ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.btnText}>Fetching Audio Info...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
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

      {/* ─── 3. Preview Card Panel (With Duplicate Banner) ─── */}
      {preview && (
        <View
          style={[
            styles.cardPanel,
            {
              backgroundColor: tokens.surface,
              borderRadius: shapes.sheet,
              borderColor: existingDuplicate
                ? '#F59E0B'
                : isDuplicateInQueue
                ? tokens.primary
                : tokens.primary,
              marginTop: 14,
            },
          ]}
        >
          {existingDuplicate && (
            <View style={styles.duplicateNoticeBox}>
              <Icon name="shield" size={16} color="#F59E0B" />
              <Text style={styles.duplicateNoticeText}>
                This song already exists in your offline library!
              </Text>
            </View>
          )}

          {isDuplicateInQueue && !existingDuplicate && (
            <View
              style={[
                styles.duplicateNoticeBox,
                { backgroundColor: 'rgba(124, 213, 255, 0.15)', borderColor: 'rgba(124, 213, 255, 0.3)' },
              ]}
            >
              <Icon name="sparkles" size={16} color={tokens.primary} />
              <Text style={[styles.duplicateNoticeText, { color: tokens.primary }]}>
                This song is already waiting in your active queue!
              </Text>
            </View>
          )}

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
                    backgroundColor: existingDuplicate ? 'rgba(245, 158, 11, 0.2)' : tokens.primaryContainer,
                    borderRadius: shapes.pill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.durationBadgeText,
                    { color: existingDuplicate ? '#F59E0B' : tokens.primary },
                  ]}
                >
                  {existingDuplicate ? 'Already Downloaded' : 'HQ Audio'}
                </Text>
              </View>
            </View>
          </View>

          {existingDuplicate || isDuplicateInQueue ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              <View
                style={[
                  styles.actionPillBtn,
                  {
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    borderRadius: shapes.pill,
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                  },
                ]}
              >
                <View style={styles.btnRow}>
                  <Icon name="check" size={18} color="#F59E0B" />
                  <Text style={[styles.btnText, { color: '#F59E0B' }]}>
                    {existingDuplicate ? 'Saved in Library' : 'Currently in Queue'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleAddToQueue(preview)}
                activeOpacity={0.8}
                style={[
                  styles.reDownloadBtn,
                  { borderRadius: shapes.pill, borderColor: tokens.outline + '40' },
                ]}
              >
                <Text style={[styles.reDownloadBtnText, { color: tokens.onSurfaceVariant }]}>
                  Download Again Anyway
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <M3Pressable
              onPress={() => handleAddToQueue(preview)}
              style={[
                styles.actionPillBtn,
                {
                  backgroundColor: tokens.primary,
                  borderRadius: shapes.pill,
                  marginTop: 14,
                },
              ]}
            >
              <View style={styles.btnRow}>
                <Icon name="download" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>Add to Download Queue</Text>
              </View>
            </M3Pressable>
          )}
        </View>
      )}

      {/* ─── 4. Active Queue Section ─── */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.headingBadgeGroup}>
          <Text style={[styles.sectionHeading, { color: tokens.onSurface }]}>
            Active Queue
          </Text>
          <View style={[styles.countBadge, { backgroundColor: tokens.primaryContainer }]}>
            <Text style={[styles.countBadgeText, { color: tokens.primary }]}>
              {queue.length}
            </Text>
          </View>
        </View>

        {selectedIds.length > 0 && (
          <View style={styles.bulkActionGroup}>
            <TouchableOpacity onPress={handleBulkResume} style={styles.bulkBtn}>
              <Text style={[styles.bulkBtnText, { color: tokens.primary }]}>
                Resume ({selectedIds.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkRemove} style={styles.bulkBtn}>
              <Text style={[styles.bulkBtnText, { color: '#F87171' }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {queue.length === 0 ? (
        <View
          style={[
            styles.emptyStateBox,
            {
              backgroundColor: tokens.surface,
              borderRadius: shapes.md,
              borderColor: 'rgba(255, 255, 255, 0.05)',
            },
          ]}
        >
          <Icon name="library" size={32} color={tokens.outline} />
          <Text style={[styles.emptyStateTitle, { color: tokens.onSurface }]}>
            No active downloads
          </Text>
          <Text style={[styles.emptyStateSub, { color: tokens.onSurfaceVariant }]}>
            Preview and add songs to queue them for download.
          </Text>
        </View>
      ) : (
        <View style={styles.listCluster}>
          {queue.map((item) => (
            <QueueSongItem
              key={item.id}
              item={item}
              tokens={tokens}
              shapes={shapes}
              onCancel={handleCancelItem}
              onResume={handleResumeItem}
              onRemove={handleRemoveItem}
              onCompleteFadeOut={handleItemCompletedFadeOut}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },
  headerBox: {
    marginBottom: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  cardPanel: {
    padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  duplicateNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  duplicateNoticeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  reDownloadBtn: {
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  reDownloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  searchIconBox: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  clearBtnAction: {
    position: 'absolute',
    right: 12,
    padding: 6,
    zIndex: 2,
  },
  expressivePasteBtn: {
    position: 'absolute',
    right: 6,
    zIndex: 2,
    borderWidth: 1.2,
    paddingHorizontal: 11,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pasteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expressivePasteText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingLeft: 44,
    paddingRight: 88,
    fontSize: 13,
    borderWidth: 1.2,
    fontWeight: '500',
  },
  actionPillBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorCard: {
    marginTop: 10,
    padding: 10,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '700',
  },
  channelTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  durationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  headingBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bulkActionGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkBtn: {
    paddingVertical: 2,
  },
  bulkBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginTop: 4,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyStateSub: {
    fontSize: 12,
    marginTop: 3,
    textAlign: 'center',
  },
  listCluster: {
    gap: 4,
  },
  songCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 3,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
  },
  artWrapper: {
    width: 48,
    height: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  queueTrackTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  artistSubtitle: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },
  flushProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  flushProgressFill: {
    height: '100%',
  },
});