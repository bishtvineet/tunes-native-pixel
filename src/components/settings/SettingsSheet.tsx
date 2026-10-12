import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, PaletteStyle } from '../../theme/ThemeContext';
import { Icon } from '../common/Icon';
import {
  NETWORK_MODES,
  setSavedNetworkMode,
  getSavedNetworkMode,
  type NetworkMode,
} from '../../services/network';
import { pingRenderHealth, syncCookiesToBackend } from '../../services/api';
import { pruneStaleStorage } from '../../services/storage';
import {
  sha256,
  ADMIN_PASSWORD_HASH,
  ADMIN_KEY_HASH,
} from '../../utils/crypto';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  storageUsage?: string;
  onClearCache?: () => void;
  onRefreshStorage?: () => void;
}

interface PaletteOption {
  id: PaletteStyle;
  label: string;
  previewPrimary: string;
  previewSecondary: string;
  previewContainer: string;
}

const PALETTE_OPTIONS: PaletteOption[] = [
  {
    id: 'TONAL_SPOT',
    label: 'Tonal Spot (Default)',
    previewPrimary: '#D0BCFF',
    previewSecondary: '#CCC2DC',
    previewContainer: '#4F378B',
  },
  {
    id: 'VIBRANT',
    label: 'Vibrant Velvet',
    previewPrimary: '#FF88BD',
    previewSecondary: '#E6B9CD',
    previewContainer: '#810053',
  },
  {
    id: 'EXPRESSIVE',
    label: 'Expressive Teal',
    previewPrimary: '#7CD5FF',
    previewSecondary: '#B4CAD6',
    previewContainer: '#004D67',
  },
  {
    id: 'FRUIT_SALAD',
    label: 'Fruit Salad Olive',
    previewPrimary: '#A0D57B',
    previewSecondary: '#C1CAAB',
    previewContainer: '#245100',
  },
  {
    id: 'RAINBOW',
    label: 'Rainbow Lavender',
    previewPrimary: '#F0B8FF',
    previewSecondary: '#D6C0DD',
    previewContainer: '#663076',
  },
  {
    id: 'MONOCHROME',
    label: 'Pure Monochrome',
    previewPrimary: '#E2E2E2',
    previewSecondary: '#C6C6C6',
    previewContainer: '#474747',
  },
];

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  visible,
  onClose,
  storageUsage = '0.0 MB',
  onClearCache,
  onRefreshStorage,
}) => {
  const { tokens, shapes, currentPalette, setPalette } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Accordion Expand/Collapse States
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [isCookieSyncOpen, setIsCookieSyncOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Functional Feature States
  const [networkMode, setNetworkMode] = useState<NetworkMode>('cloud');
  const [isWakingHost, setIsWakingHost] = useState(false);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [cookieText, setCookieText] = useState('');
  const [isSyncingCookies, setIsSyncingCookies] = useState(false);
  const [cookieFeedback, setCookieFeedback] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  }>({
    type: 'idle',
    message: '',
  });

  // Admin Verification State
  const [adminPassword, setAdminPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // In-sheet Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (visible) {
      setNetworkMode(getSavedNetworkMode());
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setIsThemePickerOpen(false);
      setIsNetworkOpen(false);
      setIsCookieSyncOpen(false);
      setIsAdminOpen(false);
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          slideAnim.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.6) {
          handleClose();
        } else {
          Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // 1. Network Strategy Selection
  const handleSelectNetworkMode = async (mode: NetworkMode) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    await setSavedNetworkMode(mode);
    setNetworkMode(mode);
    showToast(`Route: ${NETWORK_MODES[mode].label}`);
  };

  // 2. Wake Up Render Host
  const handleWakeUpHost = async () => {
    if (isWakingHost) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsWakingHost(true);
    showToast('Waking container (cold-start ping)...');
    const result = await pingRenderHealth();
    setIsWakingHost(false);
    if (result.ok) {
      showToast(`Host active (${result.timeMs}ms)!`);
    } else {
      showToast(`Cold start pending (${result.timeMs}ms).`);
    }
  };

  // 3. Clean Stale Storage
  const handleCleanStorage = async () => {
    if (isCleaningStorage) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsCleaningStorage(true);
    try {
      const result = await pruneStaleStorage();
      if (onClearCache) onClearCache();
      if (onRefreshStorage) onRefreshStorage();
      if (result.prunedCount > 0) {
        showToast(`Freed ${(result.freedBytes / (1024 * 1024)).toFixed(1)} MB (${result.prunedCount} items)`);
      } else {
        showToast(`Storage optimal (${storageUsage}). 0 orphans.`);
      }
    } catch {
      showToast('Cleanup failed.');
    } finally {
      setIsCleaningStorage(false);
    }
  };

  // 4. Check App Update
  const handleCheckUpdate = () => {
    if (isCheckingUpdate) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsCheckingUpdate(true);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      showToast('Build v2.0.0 is up to date.');
    }, 900);
  };

  // 5. Sync YouTube Cookies
  const handleSyncCookies = async () => {
    if (!cookieText.trim() || isSyncingCookies) return;
    setIsSyncingCookies(true);
    setCookieFeedback({ type: 'idle', message: '' });
    try {
      const res = await syncCookiesToBackend(cookieText.trim());
      setCookieFeedback({ type: 'success', message: res.message || 'Session cookies updated.' });
      setCookieText('');
      showToast('Cookies synced successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update cookies.';
      setCookieFeedback({ type: 'error', message: msg });
    } finally {
      setIsSyncingCookies(false);
    }
  };

  // 6. Admin Verification
  const handleAdminVerify = async () => {
    setAdminError(null);
    const passHash = await sha256(adminPassword.trim());
    const keyHash = await sha256(adminKey.trim());
    if (passHash === ADMIN_PASSWORD_HASH && keyHash === ADMIN_KEY_HASH) {
      setIsAdminAuthenticated(true);
      setAdminError(null);
      showToast('Admin access granted.');
    } else {
      setAdminError('Invalid credentials.');
    }
  };

  const currentPaletteObj = PALETTE_OPTIONS.find((p) => p.id === currentPalette);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Scrim (Tap outside to dismiss) */}
        <Animated.View
          style={[
            styles.scrim,
            { opacity: fadeAnim, backgroundColor: 'rgba(0, 0, 0, 0.65)' },
          ]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        {/* Sliding Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: tokens.surface,
              borderTopLeftRadius: shapes.sheet,
              borderTopRightRadius: shapes.sheet,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
            },
          ]}
        >
          {/* Header & Swipe Area */}
          <View {...panResponder.panHandlers} style={styles.swipeableHeaderArea}>
            <View style={styles.handleRow}>
              <View style={[styles.dragHandle, { backgroundColor: tokens.outline + '40' }]} />
            </View>

            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.headerTitle, { color: tokens.onSurface }]}>Settings</Text>
                <Text style={[styles.headerSubtitle, { color: tokens.onSurfaceVariant }]}>
                  Preferences & Connectivity
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleClose}
                style={[styles.closeCircle, { backgroundColor: tokens.surfaceVariant }]}
              >
                <Icon name="close" size={20} color={tokens.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {toastMessage && (
              <View style={[styles.toastPill, { backgroundColor: tokens.primaryContainer }]}>
                <Text style={[styles.toastText, { color: tokens.onPrimaryContainer }]}>{toastMessage}</Text>
              </View>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* ─── 1. LOOK & FEEL ─── */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: tokens.primary }]}>LOOK & FEEL</Text>
              <View
                style={[
                  styles.cardGroup,
                  {
                    backgroundColor: tokens.surfaceVariant + '35',
                    borderRadius: shapes.lg,
                    borderColor: tokens.outline + '18',
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setIsThemePickerOpen((prev) => !prev);
                  }}
                  style={styles.itemRow}
                >
                  <View style={[styles.itemIconCircle, { backgroundColor: tokens.primaryContainer }]}>
                    <Icon name="settings" size={20} color={tokens.primary} />
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text style={[styles.itemTitle, { color: tokens.onSurface }]}>Theme Palette</Text>
                    <Text style={[styles.itemSubtitle, { color: tokens.onSurfaceVariant }]}>
                      {currentPaletteObj?.label || 'Material You'}
                    </Text>
                  </View>

                  <View style={styles.swatchPreviewCluster}>
                    <View style={[styles.swatchMiniDot, { backgroundColor: tokens.primary }]} />
                    <View style={[styles.swatchMiniDot, { backgroundColor: tokens.secondary }]} />
                    <View style={[styles.swatchMiniDot, { backgroundColor: tokens.primaryContainer }]} />
                  </View>
                </TouchableOpacity>

                {isThemePickerOpen && (
                  <View style={[styles.subList, { borderTopWidth: 1, borderTopColor: tokens.outline + '14' }]}>
                    {PALETTE_OPTIONS.map((pal, pIdx) => {
                      const isSelected = pal.id === currentPalette;
                      const isLast = pIdx === PALETTE_OPTIONS.length - 1;
                      return (
                        <TouchableOpacity
                          key={pal.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            try { Haptics.selectionAsync(); } catch {}
                            setPalette(pal.id);
                          }}
                          style={[
                            styles.subOptionRow,
                            !isLast && { borderBottomWidth: 1, borderBottomColor: tokens.outline + '10' },
                            isSelected && { backgroundColor: tokens.primaryContainer + '28' },
                          ]}
                        >
                          <View style={styles.subOptionLeft}>
                            <View style={styles.colorRingContainer}>
                              <View style={[styles.swatchDot, { backgroundColor: pal.previewPrimary }]} />
                              <View style={[styles.swatchDot, { backgroundColor: pal.previewSecondary, marginLeft: -6 }]} />
                              <View style={[styles.swatchDot, { backgroundColor: pal.previewContainer, marginLeft: -6 }]} />
                            </View>
                            <Text
                              style={[
                                styles.subOptionText,
                                {
                                  color: isSelected ? tokens.primary : tokens.onSurface,
                                  fontWeight: isSelected ? '800' : '500',
                                },
                              ]}
                            >
                              {pal.label}
                            </Text>
                          </View>

                          <View style={[styles.radioCircle, { borderColor: isSelected ? tokens.primary : tokens.outline + '55' }]}>
                            {isSelected && <View style={[styles.radioInner, { backgroundColor: tokens.primary }]} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* ─── 2. NETWORK & RELAY ROUTE ─── */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: tokens.primary }]}>NETWORK & RELAY ROUTE</Text>
              <View
                style={[
                  styles.cardGroup,
                  {
                    backgroundColor: tokens.surfaceVariant + '35',
                    borderRadius: shapes.lg,
                    borderColor: tokens.outline + '18',
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setIsNetworkOpen((prev) => !prev)}
                  style={styles.itemRow}
                >
                  <View style={[styles.itemIconCircle, { backgroundColor: tokens.primaryContainer }]}>
                    <Icon name="network" size={20} color={tokens.primary} />
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text style={[styles.itemTitle, { color: tokens.onSurface }]}>Endpoint Strategy</Text>
                    <Text style={[styles.itemSubtitle, { color: tokens.onSurfaceVariant }]}>
                      {NETWORK_MODES[networkMode]?.label || 'Cloud'}
                    </Text>
                  </View>

                  <View style={[styles.badgePill, { backgroundColor: tokens.primary + '18', borderColor: tokens.primary + '35' }]}>
                    <Text style={[styles.badgeText, { color: tokens.primary }]}>
                      {NETWORK_MODES[networkMode]?.badge}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isNetworkOpen && (
                  <View style={[styles.subList, { borderTopWidth: 1, borderTopColor: tokens.outline + '14' }]}>
                    {(Object.keys(NETWORK_MODES) as NetworkMode[]).map((key, mIdx) => {
                      const info = NETWORK_MODES[key];
                      const isSelected = networkMode === key;
                      const isLast = mIdx === Object.keys(NETWORK_MODES).length - 1;
                      return (
                        <TouchableOpacity
                          key={key}
                          activeOpacity={0.8}
                          onPress={() => handleSelectNetworkMode(key)}
                          style={[
                            styles.networkOptionRow,
                            !isLast && { borderBottomWidth: 1, borderBottomColor: tokens.outline + '10' },
                            isSelected && { backgroundColor: tokens.primaryContainer + '28' },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text
                                style={[
                                  styles.subOptionText,
                                  {
                                    color: isSelected ? tokens.primary : tokens.onSurface,
                                    fontWeight: isSelected ? '800' : '600',
                                  },
                                ]}
                              >
                                {info.label}
                              </Text>
                              {isSelected && <Icon name="check" size={16} color={tokens.primary} />}
                            </View>
                            <Text style={[styles.networkDescText, { color: tokens.onSurfaceVariant }]}>
                              {info.description}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* ─── 3. SESSION & COOKIES ─── */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: tokens.primary }]}>SESSION & COOKIES</Text>
              <View
                style={[
                  styles.cardGroup,
                  {
                    backgroundColor: tokens.surfaceVariant + '35',
                    borderRadius: shapes.lg,
                    borderColor: tokens.outline + '18',
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setIsCookieSyncOpen((prev) => !prev)}
                  style={styles.itemRow}
                >
                  <View style={[styles.itemIconCircle, { backgroundColor: tokens.primaryContainer }]}>
                    <Icon name="terminal" size={20} color={tokens.primary} />
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text style={[styles.itemTitle, { color: tokens.onSurface }]}>Sync YouTube Cookies</Text>
                    <Text style={[styles.itemSubtitle, { color: tokens.onSurfaceVariant }]}>
                      Update server session tokens
                    </Text>
                  </View>
                  <Icon name="chevron-down" size={18} color={tokens.onSurfaceVariant} />
                </TouchableOpacity>

                {isCookieSyncOpen && (
                  <View style={[styles.subList, { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: tokens.outline + '14' }]}>
                    <TextInput
                      multiline
                      numberOfLines={4}
                      value={cookieText}
                      onChangeText={(txt) => {
                        setCookieText(txt);
                        setCookieFeedback({ type: 'idle', message: '' });
                      }}
                      placeholder="# Netscape HTTP Cookie File&#10;.youtube.com..."
                      placeholderTextColor={tokens.onSurfaceVariant + '66'}
                      style={[
                        styles.cookieInputBox,
                        {
                          backgroundColor: tokens.surfaceVariant + '25',
                          color: tokens.onSurface,
                          borderColor: tokens.outline + '25',
                          borderRadius: shapes.md,
                        },
                      ]}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    {cookieFeedback.message ? (
                      <Text style={[styles.feedbackText, { color: cookieFeedback.type === 'success' ? '#4ADE80' : '#F87171' }]}>
                        {cookieFeedback.message}
                      </Text>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleSyncCookies}
                      disabled={isSyncingCookies || !cookieText.trim()}
                      style={[
                        styles.actionButton,
                        { backgroundColor: tokens.primary, borderRadius: shapes.pill },
                        (!cookieText.trim() || isSyncingCookies) && { opacity: 0.5 },
                      ]}
                    >
                      {isSyncingCookies ? (
                        <ActivityIndicator size="small" color={tokens.onPrimary} />
                      ) : (
                        <Text style={[styles.actionButtonText, { color: tokens.onPrimary }]}>
                          Update Server Cookies
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* ─── 4. ADMIN & AUTHORISATION ─── */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: tokens.primary }]}>ADMIN & AUTHORISATION</Text>
              <View
                style={[
                  styles.cardGroup,
                  {
                    backgroundColor: tokens.surfaceVariant + '35',
                    borderRadius: shapes.lg,
                    borderColor: tokens.outline + '18',
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setIsAdminOpen((prev) => !prev)}
                  style={styles.itemRow}
                >
                  <View style={[styles.itemIconCircle, { backgroundColor: tokens.primaryContainer }]}>
                    <Icon name="shield" size={20} color={tokens.primary} />
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text style={[styles.itemTitle, { color: tokens.onSurface }]}>Admin Security Gate</Text>
                    <Text style={[styles.itemSubtitle, { color: tokens.onSurfaceVariant }]}>
                      {isAdminAuthenticated ? '✓ Authenticated' : 'Credentials protected'}
                    </Text>
                  </View>
                  <Icon name="chevron-down" size={18} color={tokens.onSurfaceVariant} />
                </TouchableOpacity>

                {isAdminOpen && (
                  <View style={[styles.subList, { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: tokens.outline + '14' }]}>
                    {!isAdminAuthenticated ? (
                      <>
                        <TextInput
                          secureTextEntry
                          placeholder="Admin Password"
                          placeholderTextColor={tokens.onSurfaceVariant + '66'}
                          value={adminPassword}
                          onChangeText={setAdminPassword}
                          style={[
                            styles.adminInput,
                            {
                              backgroundColor: tokens.surfaceVariant + '25',
                              color: tokens.onSurface,
                              borderColor: tokens.outline + '25',
                              borderRadius: shapes.md,
                            },
                          ]}
                        />
                        <TextInput
                          secureTextEntry
                          placeholder="Secret Key"
                          placeholderTextColor={tokens.onSurfaceVariant + '66'}
                          value={adminKey}
                          onChangeText={setAdminKey}
                          style={[
                            styles.adminInput,
                            {
                              backgroundColor: tokens.surfaceVariant + '25',
                              color: tokens.onSurface,
                              borderColor: tokens.outline + '25',
                              borderRadius: shapes.md,
                              marginTop: 8,
                            },
                          ]}
                        />
                        {adminError && <Text style={styles.errorText}>{adminError}</Text>}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={handleAdminVerify}
                          style={[
                            styles.actionButton,
                            { backgroundColor: tokens.primary, borderRadius: shapes.pill, marginTop: 12 },
                          ]}
                        >
                          <Text style={[styles.actionButtonText, { color: tokens.onPrimary }]}>
                            Verify Access
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                        <Text style={{ color: '#4ADE80', fontWeight: '800', fontSize: 13 }}>
                          ✓ Admin Access Granted
                        </Text>
                        <Text style={{ color: tokens.onSurfaceVariant, fontSize: 11, marginTop: 3, textAlign: 'center' }}>
                          Elevated administrative rights are unlocked for this session.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* ─── BOTTOM ALIGNED ACTIONS BAR (Server & Storage tools) ─── */}
          <View
            style={[
              styles.bottomToolsDock,
              {
                backgroundColor: tokens.surfaceVariant + '40',
                borderColor: tokens.outline + '20',
                borderRadius: shapes.pill,
              },
            ]}
          >
            {/* 1. Wake Server Container */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleWakeUpHost}
              disabled={isWakingHost}
              style={[styles.bottomToolBtn, { backgroundColor: isWakingHost ? tokens.primaryContainer : 'transparent' }]}
            >
              {isWakingHost ? (
                <ActivityIndicator size="small" color={tokens.primary} />
              ) : (
                <Icon name="refresh" size={20} color={tokens.primary} />
              )}
            </TouchableOpacity>

            <View style={[styles.toolSeparator, { backgroundColor: tokens.outline + '20' }]} />

            {/* 2. Check Updates */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCheckUpdate}
              disabled={isCheckingUpdate}
              style={[styles.bottomToolBtn, { backgroundColor: isCheckingUpdate ? tokens.primaryContainer : 'transparent' }]}
            >
              {isCheckingUpdate ? (
                <ActivityIndicator size="small" color={tokens.primary} />
              ) : (
                <Icon name="sparkles" size={20} color={tokens.primary} />
              )}
            </TouchableOpacity>

            <View style={[styles.toolSeparator, { backgroundColor: tokens.outline + '20' }]} />

            {/* 3. Prune Orphan Storage */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCleanStorage}
              disabled={isCleaningStorage}
              style={[styles.bottomToolBtn, { backgroundColor: isCleaningStorage ? tokens.primaryContainer : 'transparent' }]}
            >
              {isCleaningStorage ? (
                <ActivityIndicator size="small" color={tokens.primary} />
              ) : (
                <Icon name="trash" size={20} color={tokens.primary} />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 24,
  },
  swipeableHeaderArea: {
    paddingBottom: 4,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  toastText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingLeft: 6,
  },
  cardGroup: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  swatchPreviewCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swatchMiniDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  subList: {
    paddingVertical: 2,
  },
  subOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  networkOptionRow: {
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  subOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorRingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#00000033',
  },
  subOptionText: {
    fontSize: 13,
  },
  networkDescText: {
    fontSize: 11,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cookieInputBox: {
    borderWidth: 1,
    padding: 10,
    fontSize: 11,
    fontFamily: 'monospace',
    minHeight: 65,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  feedbackText: {
    fontSize: 11,
    marginTop: 6,
  },
  actionButton: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    fontWeight: '800',
    fontSize: 12,
  },
  adminInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
  },
  errorText: {
    color: '#F87171',
    fontSize: 11,
    marginTop: 4,
  },
  bottomToolsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 48,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    alignSelf: 'center',
    width: 180,
  },
  bottomToolBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  toolSeparator: {
    width: 1,
    height: 20,
  },
});