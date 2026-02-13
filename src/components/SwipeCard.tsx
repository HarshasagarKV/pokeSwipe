import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withRepeat,
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
  const superSwipeLift = useSharedValue(0);
  const likeButtonScale = useSharedValue(1);
  const dislikeButtonScale = useSharedValue(1);
  const likeButtonRotate = useSharedValue(0);
  const dislikeButtonRotate = useSharedValue(0);
  const likeButtonFloat = useSharedValue(0);
  const dislikeButtonFloat = useSharedValue(0);

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
    superSwipeLift.value = withTiming(1, { duration: 140 });
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
        superSwipeLift.value = 0;
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
        superSwipeLift.value = withSpring(0, { damping: 14, stiffness: 170 });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const liftScale = interpolate(superSwipeLift.value, [0, 1], [1, 1.06], Extrapolate.CLAMP);
    const liftY = interpolate(superSwipeLift.value, [0, 1], [0, -18], Extrapolate.CLAMP);

    return {
      zIndex: superSwipeLift.value > 0.05 ? 60 : 1,
      elevation: interpolate(superSwipeLift.value, [0, 1], [10, 22], Extrapolate.CLAMP),
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + liftY },
        { rotate: `${rotate.value}deg` },
        { scale: liftScale },
      ],
    };
  });

  const animateSwipe = (direction: 'left' | 'right') => {
    runOnUI(runSwipeAnimation)(direction);
  };

  useEffect(() => {
    if (!isInteractive) return;

    likeButtonFloat.value = withRepeat(
      withSequence(withTiming(-3, { duration: 760 }), withTiming(0, { duration: 760 })),
      -1,
      false
    );

    dislikeButtonFloat.value = withRepeat(
      withSequence(withTiming(-3, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1,
      false
    );
  }, [dislikeButtonFloat, isInteractive, likeButtonFloat]);

  const handleLikePressIn = () => {
    likeButtonScale.value = withTiming(0.9, { duration: 90 });
    likeButtonRotate.value = withTiming(8, { duration: 90 });
  };

  const handleLikePressOut = () => {
    likeButtonScale.value = withSpring(1, { damping: 10, stiffness: 180 });
    likeButtonRotate.value = withSpring(0, { damping: 10, stiffness: 180 });
  };

  const handleDislikePressIn = () => {
    dislikeButtonScale.value = withTiming(0.9, { duration: 90 });
    dislikeButtonRotate.value = withTiming(-8, { duration: 90 });
  };

  const handleDislikePressOut = () => {
    dislikeButtonScale.value = withSpring(1, { damping: 10, stiffness: 180 });
    dislikeButtonRotate.value = withSpring(0, { damping: 10, stiffness: 180 });
  };

  const triggerLikeButtonCelebration = () => {
    likeButtonScale.value = withSequence(
      withTiming(1.12, { duration: 110 }),
      withSpring(1, { damping: 11, stiffness: 210 })
    );
  };

  const triggerDislikeButtonCelebration = () => {
    dislikeButtonScale.value = withSequence(
      withTiming(1.1, { duration: 110 }),
      withSpring(1, { damping: 11, stiffness: 210 })
    );
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

  const likeButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: likeButtonFloat.value },
      { scale: likeButtonScale.value },
      { rotate: `${likeButtonRotate.value}deg` },
    ],
  }));

  const dislikeButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dislikeButtonFloat.value },
      { scale: dislikeButtonScale.value },
      { rotate: `${dislikeButtonRotate.value}deg` },
    ],
  }));

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
            <Text style={styles.likeText}>❤️</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.dislikeOverlay, dislikeOverlayStyle]}>
          <View style={styles.dislikeBox}>
            <Text style={styles.dislikeText}>❌</Text>
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
          <Animated.View style={dislikeButtonAnimatedStyle}>
            <Pressable
              disabled={!isInteractive}
              onPressIn={handleDislikePressIn}
              onPressOut={handleDislikePressOut}
              onPress={() => {
                triggerDislikeButtonCelebration();
                animateSwipe('left');
              }}
              style={[
                styles.actionButton,
                styles.dislikeActionButton,
                { borderColor: typeAccentColor },
                !isInteractive && styles.disabledButton,
              ]}
            >
              <View style={[styles.iconFillCircle, styles.dislikeFillCircle]}>
                <MaterialCommunityIcons name="close-thick" size={34} color="#FFFFFF" />
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View style={likeButtonAnimatedStyle}>
            <Pressable
              disabled={!isInteractive}
              onPressIn={handleLikePressIn}
              onPressOut={handleLikePressOut}
              onPress={() => {
                triggerLikeButtonCelebration();
                animateSwipe('right');
              }}
              style={[
                styles.actionButton,
                styles.likeActionButton,
                { borderColor: typeAccentColor },
                !isInteractive && styles.disabledButton,
              ]}
            >
              <View style={[styles.iconFillCircle, styles.likeFillCircle]}>
                <MaterialCommunityIcons name="heart" size={32} color="#FFFFFF" />
              </View>
            </Pressable>
          </Animated.View>
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
    fontSize: 34,
    color: '#15803D',
    fontFamily: Typography.logo,
    lineHeight: 36,
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
    fontSize: 32,
    color: '#B91C1C',
    fontFamily: Typography.logo,
    lineHeight: 34,
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
    width: 78,
    height: 78,
    borderWidth: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 7,
  },
  dislikeActionButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EF4444',
  },
  likeActionButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  iconFillCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeFillCircle: {
    backgroundColor: '#10B981',
  },
  dislikeFillCircle: {
    backgroundColor: '#EF4444',
  },
  disabledButton: {
    opacity: 0.35,
  },
});
