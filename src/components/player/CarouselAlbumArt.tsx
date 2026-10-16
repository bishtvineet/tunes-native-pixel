import React, { useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../common/Icon';
import { getElevation } from '../../theme/elevation';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_WIDTH = Math.min(SCREEN_WIDTH - 44, 340);
const ARTWORK_HEIGHT = Math.round(ARTWORK_WIDTH * 0.68);
const SWIPE_THRESHOLD = 60;

interface CarouselAlbumArtProps {
  thumbnailUrl?: string;
  onNext: () => void;
  onPrev: () => void;
}

export const CarouselAlbumArt: React.FC<CarouselAlbumArtProps> = ({
  thumbnailUrl,
  onNext,
  onPrev,
}) => {
  const { tokens, shapes } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  // Dedicated horizontal swipe responder — ignores vertical dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return (
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5
        );
      },
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_THRESHOLD || gesture.vx < -0.45) {
          triggerHaptic();
          Animated.timing(translateX, {
            toValue: -ARTWORK_WIDTH,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            onNext();
            translateX.setValue(0);
          });
        } else if (gesture.dx > SWIPE_THRESHOLD || gesture.vx > 0.45) {
          triggerHaptic();
          Animated.timing(translateX, {
            toValue: ARTWORK_WIDTH,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            onPrev();
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            tension: 200,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          tension: 200,
          friction: 12,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.outerShadowContainer,
          getElevation(5),
          {
            width: ARTWORK_WIDTH,
            height: ARTWORK_HEIGHT,
            borderRadius: shapes.sheet,
            transform: [{ translateX }],
          },
        ]}
      >
        <View
          style={[
            styles.artworkBox,
            {
              borderRadius: shapes.sheet,
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
          ]}
        >
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.artworkImage}
              resizeMode="cover"
            />
          ) : (
            <Icon name="library" size={88} color={tokens.primary} />
          )}

          {/* 3D Inner Bevel & Top-Light Specular Glaze */}
          <View
            style={[styles.innerBevelGleam, { borderRadius: shapes.sheet }]}
            pointerEvents="none"
          />
          <View
            style={[styles.innerBottomShadow, { borderRadius: shapes.sheet }]}
            pointerEvents="none"
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  outerShadowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkBox: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
    borderRightColor: 'rgba(0, 0, 0, 0.45)',
    borderBottomColor: 'rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    position: 'relative',
  },
  artworkImage: {
    width: '100%',
    height: '135%',
  },
  innerBevelGleam: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: 2.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.65)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  innerBottomShadow: {
    ...StyleSheet.absoluteFill,
    borderBottomWidth: 3,
    borderRightWidth: 1.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.65)',
    borderRightColor: 'rgba(0, 0, 0, 0.45)',
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
});