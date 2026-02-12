import { Audio } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  Vibration,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  dequeuePokemonCard,
  QueuedPokemon,
  takePreloadedPokemonQueue,
} from '../api/pokemonQueue';
import PokeTexture from '../components/PokeTexture';
import SwipeCard from '../components/SwipeCard';
import ThemeSwitch from '../components/ThemeSwitch';
import { Typography } from '../constants/typography';
import { PALETTE, UI } from '../constants/ui';
import { RootState } from '../store';
import { dislikePokemon, likePokemon } from '../store/pokemonSlice';
import { setThemeMode } from '../store/uiSlice';

const MIN_QUEUE_SIZE = 4;
const SUPERLIKE_BALLS = 10;
const ICONIC_POKEMON = new Set(['PIKACHU', 'CHARIZARD', 'MEWTWO', 'EEVEE', 'SNORLAX']);
const SPEED_HINTS = ['speed', 'quick', 'swift', 'agility', 'dash', 'motor', 'surge'];
const AGGRESSIVE_TYPES = new Set(['fire', 'fighting', 'electric', 'dragon', 'dark', 'poison']);
const AGGRESSIVE_HINTS = ['blaze', 'rage', 'power', 'attack', 'intimidate', 'fury', 'claw', 'rough', 'moxie'];

type SwipeInsight = {
  line1: string;
  line2: string;
};

const titleCase = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getPreferenceInsight = (
  history: { liked: boolean; types?: string[]; abilities?: string[] }[]
): SwipeInsight | null => {
  if (history.length < 5) return null;

  const likedOnly = history.filter((item) => item.liked);
  const source = likedOnly.length >= 3 ? likedOnly : history;

  const typeCount = new Map<string, number>();
  let speedScore = 0;
  let aggressiveScore = 0;

  source.forEach((item) => {
    item.types?.forEach((type) => {
      const key = type.toLowerCase();
      typeCount.set(key, (typeCount.get(key) ?? 0) + 1);

      if (AGGRESSIVE_TYPES.has(key)) {
        aggressiveScore += 1;
      }
      if (key === 'electric' || key === 'flying') {
        speedScore += 1;
      }
    });

    item.abilities?.forEach((ability) => {
      const lower = ability.toLowerCase();
      if (SPEED_HINTS.some((hint) => lower.includes(hint))) {
        speedScore += 1;
      }
      if (AGGRESSIVE_HINTS.some((hint) => lower.includes(hint))) {
        aggressiveScore += 1;
      }
    });
  });

  const sortedTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]);
  const primaryType = titleCase(sortedTypes[0]?.[0] ?? 'mixed');
  const secondaryType = sortedTypes[1]?.[0];
  const secondAffinity =
    speedScore >= Math.max(2, Math.floor(source.length / 2))
      ? 'Speed'
      : titleCase(secondaryType ?? 'Balanced');

  const isAggressive = aggressiveScore >= Math.max(2, Math.floor(source.length / 2));

  return {
    line1: `You prefer ${primaryType} & ${secondAffinity} types`,
    line2: `You like ${isAggressive ? 'aggressive' : 'balanced'} Pokémon`,
  };
};

export default function SwipeScreen() {
  const dispatch = useDispatch();
  const colorScheme = useColorScheme();
  const themeMode = useSelector((state: RootState) => state.ui.themeMode);
  const isDark = themeMode ? themeMode === 'dark' : colorScheme === 'dark';
  const theme = isDark ? PALETTE.dark : PALETTE.light;
  const likedCount = useSelector((state: RootState) => state.pokemon.likedPokemon.length);
  const swipeHistory = useSelector((state: RootState) => state.pokemon.history);

  const initialQueueRef = useRef<QueuedPokemon[]>(takePreloadedPokemonQueue(MIN_QUEUE_SIZE));
  const [pokemonQueue, setPokemonQueue] = useState<QueuedPokemon[]>(initialQueueRef.current);
  const [isLoading, setIsLoading] = useState(initialQueueRef.current.length === 0);
  const queueRef = useRef<QueuedPokemon[]>(initialQueueRef.current);
  const isRefillingRef = useRef(false);

  const [showSuperLikeFx, setShowSuperLikeFx] = useState(false);
  const [showIconicFx, setShowIconicFx] = useState(false);
  const superLikeAnimRef = useRef(
    Array.from({ length: SUPERLIKE_BALLS }, () => new Animated.Value(0))
  );
  const superLikeSoundRef = useRef<Audio.Sound | null>(null);
  const iconicFxAnim = useRef(new Animated.Value(0)).current;
  const insightAnim = useRef(new Animated.Value(0)).current;
  const pokeballSpinAnim = useRef(new Animated.Value(0)).current;
  const likedCountScaleAnim = useRef(new Animated.Value(1)).current;
  const previousLikedCountRef = useRef(likedCount);

  const preferenceInsight = useMemo(() => getPreferenceInsight(swipeHistory), [swipeHistory]);
  const pokeballSpin = pokeballSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const setQueue = (nextQueue: QueuedPokemon[]) => {
    queueRef.current = nextQueue;
    setPokemonQueue(nextQueue);
  };

  const preloadUpcomingImages = useCallback(async () => {
    const urls = pokemonQueue
      .slice(0, 3)
      .flatMap((pokemon) => [pokemon.image, pokemon.imageFallback])
      .filter((value): value is string => Boolean(value));

    if (urls.length === 0) return;
    const uniqueUrls = Array.from(new Set(urls));
    await ExpoImage.prefetch(uniqueUrls, 'memory-disk');
  }, [pokemonQueue]);

  // Keep a small in-memory queue ready so swipe transitions never wait on network.
  const refillQueue = useCallback(async () => {
    if (isRefillingRef.current) return;
    isRefillingRef.current = true;

    try {
      let workingQueue = [...queueRef.current];
      while (workingQueue.length < MIN_QUEUE_SIZE) {
        const pokemon = await dequeuePokemonCard();
        if (!pokemon) break;
        workingQueue = [...workingQueue, pokemon];
        setQueue(workingQueue);
      }
    } finally {
      isRefillingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refillQueue();
  }, [refillQueue]);

  useEffect(() => {
    void preloadUpcomingImages();
  }, [preloadUpcomingImages]);

  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/super-like.wav'),
          { volume: 0.8 }
        );
        superLikeSoundRef.current = sound;
      } catch (error) {
        console.error('Error loading super like sound:', error);
      }
    };

    loadSound();

    return () => {
      if (superLikeSoundRef.current) {
        void superLikeSoundRef.current.unloadAsync();
      }
    };
  }, []);

  const playLikeFeedback = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Vibration.vibrate(20);
  }, []);

  const playDislikeFeedback = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Vibration.vibrate(16);
  }, []);

  const playSuperLikeFeedback = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Vibration.vibrate([0, 40, 30, 70, 30, 120]);

    if (superLikeSoundRef.current) {
      void superLikeSoundRef.current.replayAsync();
    }
  }, []);

  const triggerSuperLikeFx = useCallback(() => {
    const animatedValues = superLikeAnimRef.current;
    animatedValues.forEach((value) => value.setValue(0));
    setShowSuperLikeFx(true);

    Animated.parallel(
      animatedValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 850,
          delay: index * 45,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start(() => {
      setShowSuperLikeFx(false);
    });
  }, []);

  const triggerIconicFx = useCallback(() => {
    iconicFxAnim.setValue(0);
    setShowIconicFx(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(iconicFxAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(260),
      Animated.timing(iconicFxAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setShowIconicFx(false));
  }, [iconicFxAnim]);

  useEffect(() => {
    if (!preferenceInsight) return;

    Animated.timing(insightAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [insightAnim, preferenceInsight]);

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(pokeballSpinAnim, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    spinLoop.start();
    return () => spinLoop.stop();
  }, [pokeballSpinAnim]);

  useEffect(() => {
    const previousLikedCount = previousLikedCountRef.current;
    if (likedCount > previousLikedCount) {
      Animated.sequence([
        Animated.timing(likedCountScaleAnim, {
          toValue: 1.26,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(likedCountScaleAnim, {
          toValue: 1,
          duration: 170,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    previousLikedCountRef.current = likedCount;
  }, [likedCount, likedCountScaleAnim]);

  const handleSwipe = async (
    pokemon: QueuedPokemon,
    action: typeof likePokemon | typeof dislikePokemon,
    isSuperLike = false
  ) => {
    dispatch(action(pokemon));

    if (action === likePokemon && !isSuperLike) {
      playLikeFeedback();
    }
    if (action === dislikePokemon) {
      playDislikeFeedback();
    }
    if (isSuperLike) {
      playSuperLikeFeedback();
      triggerSuperLikeFx();
    }
    if (ICONIC_POKEMON.has(pokemon.name)) {
      triggerIconicFx();
    }

    const workingQueue = [...queueRef.current];
    workingQueue.shift();

    if (workingQueue.length === 0) {
      const emergencyNext = await dequeuePokemonCard();
      if (emergencyNext) {
        workingQueue.push(emergencyNext);
      }
    }

    setQueue(workingQueue);
    void refillQueue();
  };

  const currentPokemon = pokemonQueue[0];

  if (isLoading || !currentPokemon) {
    return (
      <View style={[styles.container, { backgroundColor: theme.screenBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <PokeTexture isDark={isDark} />

      <View
        style={[
          styles.bgOrb,
          styles.bgOrbTop,
          { backgroundColor: isDark ? '#1D4ED8' : '#93C5FD' },
        ]}
      />
      <View
        style={[
          styles.bgOrb,
          styles.bgOrbBottom,
          { backgroundColor: isDark ? '#0F766E' : '#5EEAD4' },
        ]}
      />

      <View style={styles.themeSwitchWrap}>
        <ThemeSwitch
          isDark={isDark}
          onLight={() => dispatch(setThemeMode('light'))}
          onDark={() => dispatch(setThemeMode('dark'))}
        />
      </View>

      <Pressable
        onPress={() => router.push('/liked')}
        style={[
          styles.likedButton,
          {
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#D1D5DB',
          },
        ]}
      >
        <View style={styles.likedButtonContent}>
          <Animated.View style={[styles.miniPokeball, { transform: [{ rotate: pokeballSpin }] }]}>
            <View style={styles.miniPokeballTop} />
            <View style={styles.miniPokeballBottom} />
            <View style={styles.miniPokeballBand} />
            <View style={styles.miniPokeballCenter} />
          </Animated.View>
          <Animated.Text
            style={[
              styles.likedCountText,
              {
                color: theme.textPrimary,
                transform: [{ scale: likedCountScaleAnim }],
              },
            ]}
          >
            {likedCount}
          </Animated.Text>
        </View>
      </Pressable>

      <View style={styles.cardStack}>
        <View style={styles.stackShadowCard} />
        <View style={styles.cardLayer} pointerEvents="auto">
          <SwipeCard
            key={`card-${currentPokemon.id}-${currentPokemon.name}`}
            pokemon={currentPokemon}
            isDark={isDark}
            isInteractive
            onSwipeRight={(p) => handleSwipe(p as QueuedPokemon, likePokemon)}
            onSwipeLeft={(p) => handleSwipe(p as QueuedPokemon, dislikePokemon)}
            onSuperLike={(p) => handleSwipe(p as QueuedPokemon, likePokemon, true)}
          />
        </View>
      </View>

      {preferenceInsight ? (
        <Animated.View
          style={[
            styles.insightCard,
            {
              opacity: insightAnim,
              transform: [
                {
                  translateY: insightAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
              backgroundColor: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)',
              borderColor: isDark ? '#475569' : '#CBD5E1',
            },
          ]}
        >
          <Text style={[styles.insightText, { color: theme.textPrimary }]}>
            {preferenceInsight.line1}
          </Text>
          <Text style={[styles.insightText, { color: theme.textPrimary }]}>
            {preferenceInsight.line2}
          </Text>
        </Animated.View>
      ) : null}

      {showIconicFx ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.iconicWrap,
            {
              opacity: iconicFxAnim,
              transform: [
                {
                  scale: iconicFxAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.08],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.iconicText}>ICONIC MOMENT</Text>
        </Animated.View>
      ) : null}

      {showSuperLikeFx ? (
        <View pointerEvents="none" style={styles.superLikeFxWrap}>
          <Animated.Text
            style={[
              styles.superLikeText,
              {
                opacity: superLikeAnimRef.current[0].interpolate({
                  inputRange: [0, 0.15, 0.85, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    scale: superLikeAnimRef.current[0].interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0.65, 1.16, 1.02],
                    }),
                  },
                ],
              },
            ]}
          >
            SUPER SWIPED!
          </Animated.Text>
          {superLikeAnimRef.current.map((progress, index) => {
            const direction = index % 2 === 0 ? -1 : 1;
            const spread = 20 + (index % 4) * 24;
            const translateX = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, direction * spread],
            });
            const translateY = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -UI.screen.height * 0.9],
            });
            const scale = progress.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.6, 1, 0.72],
            });
            const opacity = progress.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [0, 1, 0],
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.superBall,
                  {
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}
              >
                <View style={styles.superBallTop} />
                <View style={styles.superBallBottom} />
                <View style={styles.superBallBand} />
                <View style={styles.superBallCenter} />
              </Animated.View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.16,
  },
  bgOrbTop: {
    top: -70,
    right: -90,
  },
  bgOrbBottom: {
    bottom: -120,
    left: -100,
  },
  cardStack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLayer: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
  },
  stackShadowCard: {
    position: 'absolute',
    width: UI.swipe.cardWidth,
    height: UI.swipe.cardHeight,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(100,116,139,0.3)',
    transform: [{ scale: 0.97 }, { translateY: 10 }],
    opacity: 0.45,
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
  themeSwitchWrap: {
    position: 'absolute',
    top: 54,
    left: 16,
    zIndex: 20,
  },
  likedButton: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 20,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  likedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniPokeball: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0F172A',
    overflow: 'hidden',
  },
  miniPokeballTop: {
    flex: 1,
    backgroundColor: '#EF4444',
  },
  miniPokeballBottom: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  miniPokeballBand: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#111827',
  },
  miniPokeballCenter: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#FFFFFF',
    top: 7,
    left: 7,
  },
  likedCountText: {
    fontSize: 18,
    lineHeight: 20,
    minWidth: 18,
    textAlign: 'center',
    fontFamily: Typography.logo,
  },
  insightCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 108,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 15,
    gap: 2,
  },
  insightText: {
    fontSize: 18,
    fontFamily: Typography.body,
  },
  iconicWrap: {
    position: 'absolute',
    top: UI.screen.height * 0.18,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(250,204,21,0.9)',
    borderWidth: 2,
    borderColor: '#78350F',
    zIndex: 40,
  },
  iconicText: {
    fontSize: 24,
    color: '#111827',
    letterSpacing: 0.6,
    fontFamily: Typography.logo,
  },
  superLikeFxWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 120,
  },
  superLikeText: {
    position: 'absolute',
    top: UI.screen.height * 0.22,
    textAlign: 'center',
    fontSize: 52,
    letterSpacing: 1.4,
    color: '#FACC15',
    textShadowColor: 'rgba(15,23,42,0.8)',
    textShadowOffset: { width: 3, height: 4 },
    textShadowRadius: 2,
    fontFamily: Typography.logo,
    zIndex: 60,
  },
  superBall: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#0F172A',
    overflow: 'hidden',
  },
  superBallTop: {
    flex: 1,
    backgroundColor: '#EF4444',
  },
  superBallBottom: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  superBallBand: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#111827',
  },
  superBallCenter: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#FFFFFF',
  },
});
