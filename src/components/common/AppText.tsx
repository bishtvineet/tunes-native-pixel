import React from 'react';
import { Text, TextProps, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface AppTextProps extends TextProps {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
}

export const AppText: React.FC<AppTextProps> = ({
  style,
  variant = 'primary',
  children,
  ...rest
}) => {
  const { tokens } = useTheme();

  const getVariantColor = () => {
    switch (variant) {
      case 'secondary':
        return tokens.onSurfaceVariant;
      case 'accent':
        return tokens.primary;
      case 'danger':
        return '#F87171';
      default:
        return tokens.onSurface;
    }
  };

  return (
    <Text
      {...rest}
      style={[
        styles.base,
        { color: getVariantColor() },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    includeFontPadding: false, // Prevents Android vertical text drift
  },
});