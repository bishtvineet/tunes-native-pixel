import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Icon, IconName } from '../common/Icon';
import * as Haptics from 'expo-haptics';

export type RootTab = 'Home' | 'Download' | 'Library';

interface BottomNavBarProps {
  currentRoute: RootTab;
  onNavigate?: (route: RootTab) => void;
  onSelectRoute?: (route: RootTab) => void;
  onOpenSettings?: () => void;
}

interface NavItemConfig {
  id: RootTab;
  iconName: IconName;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'Home', iconName: 'home' },
  { id: 'Download', iconName: 'download' },
  { id: 'Library', iconName: 'library' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentRoute,
  onNavigate,
  onSelectRoute,
  onOpenSettings,
}) => {
  const { tokens, shapes } = useTheme();
  const insets = useSafeAreaInsets();
  const settingsBounceAnim = useRef(new Animated.Value(1)).current;

  const handleTabPress = (route: RootTab) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (onNavigate) {
      onNavigate(route);
    } else if (onSelectRoute) {
      onSelectRoute(route);
    }
  };

  const handleSettingsPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    settingsBounceAnim.stopAnimation();
    settingsBounceAnim.setValue(1);
    Animated.sequence([
      Animated.timing(settingsBounceAnim, {
        toValue: 1.28,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(settingsBounceAnim, {
        toValue: 1.0,
        tension: 260,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  return (
    <View
      style={[
        styles.outerWrapper,
        {
          bottom: insets.bottom > 0 ? insets.bottom + 6 : 14,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.navRow}>
        {/* Main 3-Tab Floating Pill */}
        <View
          style={[
            styles.floatingBar,
            {
              backgroundColor: tokens.surface + 'F2',
              borderColor: tokens.outline + '24',
              borderRadius: shapes.pill,
            },
          ]}
        >
          {NAV_ITEMS.map((item) => {
            const isSelected = item.id === currentRoute;
            return (
              <NavBarItem
                key={item.id}
                item={item}
                isSelected={isSelected}
                onPress={() => handleTabPress(item.id)}
              />
            );
          })}
        </View>

        {/* Adjacent Circular Settings Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSettingsPress}
          style={[
            styles.settingsCircleButton,
            {
              backgroundColor: tokens.surface + 'F2',
              borderColor: tokens.outline + '24',
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: settingsBounceAnim }] }}>
            <Icon name="settings" size={24} color={tokens.onSurfaceVariant} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface NavBarItemProps {
  item: NavItemConfig;
  isSelected: boolean;
  onPress: () => void;
}

const NavBarItem: React.FC<NavBarItemProps> = ({ item, isSelected, onPress }) => {
  const { tokens } = useTheme();

  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: isSelected ? 1 : 0,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [isSelected, selectAnim]);

  const triggerBounce = () => {
    bounceAnim.stopAnimation();
    bounceAnim.setValue(1);
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 1.26,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1.0,
        tension: 260,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    triggerBounce();
    onPress();
  };

  const indicatorScaleX = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1.0],
  });

  const indicatorOpacity = selectAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.7, 1],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={styles.itemContainer}
    >
      <View style={styles.indicatorContainer}>
        <Animated.View
          style={[
            styles.activeIndicatorPill,
            {
              backgroundColor: tokens.primaryContainer,
              opacity: indicatorOpacity,
              transform: [{ scaleX: indicatorScaleX }],
            },
          ]}
        />

        <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
          <Icon
            name={item.iconName}
            size={25}
            color={isSelected ? tokens.primary : tokens.onSurfaceVariant}
          />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // Gap between the main pill and the settings button
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 236,
    height: 60,
    paddingHorizontal: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  settingsCircleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  itemContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  indicatorContainer: {
    width: 58,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicatorPill: {
    position: 'absolute',
    width: 58,
    height: 36,
    borderRadius: 18,
  },
});