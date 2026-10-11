import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface MarqueeTextProps {
  text: string;
  style?: TextStyle;
  speed?: number;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({ text, style, speed = 4000 }) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (text.length > 25) {
      translateX.value = withRepeat(
        withTiming(-120, { duration: speed, easing: Easing.linear }),
        -1,
        true
      );
    } else {
      translateX.value = 0;
    }
  }, [text, speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inner, animatedStyle]}>
        <Text style={[styles.text, style]} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
  },
  text: {
    flexShrink: 0,
  },
});