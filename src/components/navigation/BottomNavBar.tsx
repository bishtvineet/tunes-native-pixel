import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Icon, IconName } from '../common/Icon';

export type RootTab = 'Home' | 'Search' | 'Library';

interface BottomNavBarProps {
  currentRoute: RootTab;
  onNavigate: (route: RootTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentRoute, onNavigate }) => {
  const { tokens, shapes } = useTheme();
  const insets = useSafeAreaInsets();

  const tabs: { route: RootTab; icon: IconName }[] = [
    { route: 'Home', icon: 'home' },
    { route: 'Search', icon: 'search' },
    { route: 'Library', icon: 'library' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.surfaceVariant,
          borderRadius: shapes.pill, // 60px[cite: 1]
          bottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isFocused = currentRoute === tab.route;
        return (
          <TouchableOpacity
            key={tab.route}
            onPress={() => onNavigate(tab.route)}
            activeOpacity={0.7}
            style={[
              styles.tabItem,
              isFocused && {
                backgroundColor: tokens.primaryContainer,
                borderRadius: shapes.pill,
              },
            ]}
          >
            <Icon
              name={tab.icon}
              size={24}
              color={isFocused ? tokens.primary : tokens.onSurfaceVariant}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});