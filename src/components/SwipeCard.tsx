import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  runOnUI,
  interpolate,
  Extrapolate,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '../constants/typography';
import { ABILITY_PALETTE, PALETTE, TYPE_COLORS, UI } from '../constants/ui';

interface Pokemon {
  id: number;
  name: string;
  image: string;
  imageFallback?: string;
  types?: string[];
  abilities?: string[];
}

interface SwipeCardProps {
  pokemon: Pokemon;
  onSwipeLeft: (pokemon: Pokemon) => void;
  onSwipeRight: (pokemon: Pokemon) => void;
  onSuperLike?: (pokemon: Pokemon) => void;
  isInteractive?: boolean;
  isDark?: boolean;
}

const hashWord = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const createGradientSvgUri = (topColor: string, bottomColor: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='${topColor}'/><stop offset='100%' stop-color='${bottomColor}'/></linearGradient></defs><rect width='100' height='100' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export default function SwipeCard({
  pokemon,
  onSwipeLeft,
  onSwipeRight,
  onSuperLike,
  isInteractive = true,
  isDark = false,
}: SwipeCardProps) {
  const theme = isDark ? PALETTE.dark : PALETTE.light;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const isSwiping = useSharedValue(false);

  const gradientColors = useMemo(() => {
    const primaryType = pokemon.types?.[0]?.toLowerCase() || 'normal';
    const typeColor = isDark
      ? TYPE_COLORS[primaryType]?.dark || TYPE_COLORS.normal.dark
      : TYPE_COLORS[primaryType]?.light || TYPE_COLORS.normal.light;

    const abilitySeed = pokemon.abilities?.join('-') || pokemon.name;
    const abilityColor = ABILITY_PALETTE[hashWord(abilitySeed) % ABILITY_PALETTE.length];
    return [typeColor, abilityColor] as const;
  }, [pokemon.abilities, pokemon.name, pokemon.types, isDark]);

  const gradientUri = useMemo(
    () => createGradientSvgUri(gradientColors[0], gradientColors[1]),
    [gradientColors]
  );
  const imageUri = pokemon.image || pokemon.imageFallback;

  const typeAccentColor = useMemo(() => {
    const primaryType = pokemon.types?.[0]?.toLowerCase() || 'normal';
    const palette = TYPE_COLORS[primaryType] || TYPE_COLORS.normal;
    return isDark ? palette.light : palette.dark;
  }, [pokemon.types, isDark]);

  const completeSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      onSwipeRight(pokemon);
    } else {
      onSwipeLeft(pokemon);
    }
  };

  const completeSuperLike = () => {
    if (onSuperLike) {
      onSuperLike(pokemon);
      return;
    }
    onSwipeRight(pokemon);
  };

  const runSwipeAnimation = (direction: 'left' | 'right') => {
    'worklet';
    if (!isInteractive || isSwiping.value) return;

    isSwiping.value = true;
    const targetX = direction === 'right' ? UI.screen.width : -UI.screen.width;
    const targetRotation = direction === 'right' ? 14 : -14;

    rotate.value = withTiming(targetRotation, { duration: 110 });
    translateX.value = withTiming(
      targetX,
      { duration: UI.swipe.swipeDuration },
      (finished) => {
        if (finished) {
          runOnJS(completeSwipe)(direction);
        }

        translateX.value = 0;
        translateY.value = 0;
        rotate.value = 0;
        isSwiping.value = false;
      }
    );
  };

  const runSuperLikeAnimation = () => {
    'worklet';
    if (!isInteractive || isSwiping.value) return;

    isSwiping.value = true;
    rotate.value = withTiming(0, { duration: 120 });
    translateY.value = withTiming(
      -UI.screen.height,
      { duration: UI.swipe.swipeDuration },
      (finished) => {
        if (finished) {
          runOnJS(completeSuperLike)();
        }

        translateX.value = 0;
        translateY.value = 0;
        rotate.value = 0;
        isSwiping.value = false;
      }
    );
  };

  const panGesture = Gesture.Pan()
    .enabled(isInteractive)
    .onUpdate((event) => {
      if (isSwiping.value) return;

      translateX.value = event.translationX;
      translateY.value = event.translationY;
      rotate.value = interpolate(
        event.translationX,
        [-UI.screen.width / 2, 0, UI.screen.width / 2],
        [-15, 0, 15],
        Extrapolate.CLAMP
      );
    })
    .onEnd((event) => {
      if (isSwiping.value) return;

      if (
        event.translationY < -UI.swipe.superLikeThreshold &&
        Math.abs(event.translationX) < UI.swipe.threshold
      ) {
        runSuperLikeAnimation();
      } else if (event.translationX > UI.swipe.threshold) {
        runSwipeAnimation('right');
      } else if (event.translationX < -UI.swipe.threshold) {
        runSwipeAnimation('left');
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
        rotate.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const animateSwipe = (direction: 'left' | 'right') => {
    runOnUI(runSwipeAnimation)(direction);
  };

  const likeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, UI.swipe.threshold / 2],
      [0, 1],
      Extrapolate.CLAMP
    );
    const scale = interpolate(
      translateX.value,
      [0, UI.swipe.threshold * 0.8],
      [0.75, 1.15],
      Extrapolate.CLAMP
    );

    return { opacity, transform: [{ scale }] };
  });

  const dislikeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-UI.swipe.threshold / 2, 0],
      [1, 0],
      Extrapolate.CLAMP
    );
    const scale = interpolate(
      translateX.value,
      [-UI.swipe.threshold * 0.8, 0],
      [1.15, 0.75],
      Extrapolate.CLAMP
    );

    return { opacity, transform: [{ scale }] };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[
          styles.card,
          {
            width: UI.swipe.cardWidth,
            height: UI.swipe.cardHeight,
            borderColor: typeAccentColor,
          },
          animatedCardStyle,
        ]}
      >
        <ExpoImage
          source={{ uri: gradientUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        <View style={[styles.topAccent, { backgroundColor: typeAccentColor }]} />
        <View style={[styles.contentMask, { backgroundColor: theme.cardMask }]} />

        <Animated.View style={[styles.likeOverlay, likeOverlayStyle]}>
          <View style={styles.likeBox}>
            <Text style={styles.likeText}>LIKE</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.dislikeOverlay, dislikeOverlayStyle]}>
          <View style={styles.dislikeBox}>
            <Text style={styles.dislikeText}>NOPE</Text>
          </View>
        </Animated.View>

        <Text style={[styles.pokemonName, { color: theme.textPrimary }]}>{pokemon.name}</Text>

        <View style={styles.imageContainer}>
          <ExpoImage
            source={imageUri ? { uri: imageUri } : undefined}
            style={styles.pokemonImage}
            contentFit="contain"
            transition={0}
            cachePolicy="memory-disk"
          />
        </View>

        <View style={styles.tagsContainer}>
          {pokemon.types?.map((type) => (
            <View
              key={`${pokemon.id}-${type}`}
              style={[
                styles.typeBadge,
                {
                  backgroundColor: theme.badgeTypeBg,
                  borderColor: typeAccentColor,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: theme.badgeText }]}>{type.toUpperCase()}</Text>
            </View>
          ))}
          {pokemon.abilities?.map((ability) => (
            <View
              key={`${pokemon.id}-${ability}`}
              style={[
                styles.abilityBadge,
                {
                  backgroundColor: theme.badgeAbilityBg,
                  borderColor: typeAccentColor,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: theme.badgeText }]}>
                {ability.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.buttonsContainer}>
          <Pressable
            disabled={!isInteractive}
            onPress={() => animateSwipe('left')}
            style={[
              styles.actionButton,
              { backgroundColor: theme.dislikeBg, borderColor: typeAccentColor },
              !isInteractive && styles.disabledButton,
            ]}
          >
            <Ionicons name="close" size={30} color={theme.textPrimary} />
          </Pressable>

          <Pressable
            disabled={!isInteractive}
            onPress={() => animateSwipe('right')}
            style={[
              styles.actionButton,
              { backgroundColor: theme.likeBg, borderColor: typeAccentColor },
              !isInteractive && styles.disabledButton,
            ]}
          >
            <Ionicons name="heart" size={26} color={theme.textPrimary} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 14,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  contentMask: {
    ...StyleSheet.absoluteFillObject,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
  },
  likeOverlay: {
    position: 'absolute',
    top: 20,
    right: 16,
    transform: [{ rotate: '14deg' }],
    zIndex: 30,
  },
  likeBox: {
    borderWidth: 4,
    borderColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#DCFCE7',
  },
  likeText: {
    fontSize: 22,
    color: '#15803D',
    letterSpacing: 1,
    fontFamily: Typography.logo,
  },
  dislikeOverlay: {
    position: 'absolute',
    top: 20,
    left: 16,
    transform: [{ rotate: '-14deg' }],
    zIndex: 30,
  },
  dislikeBox: {
    borderWidth: 4,
    borderColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
  },
  dislikeText: {
    fontSize: 22,
    color: '#B91C1C',
    letterSpacing: 1,
    fontFamily: Typography.logo,
  },
  pokemonName: {
    fontSize: 40,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: Typography.logo,
    marginTop: 12,
  },
  imageContainer: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  pokemonImage: {
    width: '90%',
    height: '90%',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 7,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 48,
  },
  typeBadge: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  abilityBadge: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 14,
    fontFamily: Typography.body,
  },
  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 2,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderWidth: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.35,
  },
});
