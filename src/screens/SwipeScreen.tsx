import { Audio } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export default function SwipeScreen() {
  const dispatch = useDispatch();
  const colorScheme = useColorScheme();
  const themeMode = useSelector((state: RootState) => state.ui.themeMode);
  const isDark = themeMode ? themeMode === 'dark' : colorScheme === 'dark';
  const theme = isDark ? PALETTE.dark : PALETTE.light;
  const likedCount = useSelector((state: RootState) => state.pokemon.likedPokemon.length);

  const initialQueueRef = useRef<QueuedPokemon[]>(takePreloadedPokemonQueue(MIN_QUEUE_SIZE));
  const [pokemonQueue, setPokemonQueue] = useState<QueuedPokemon[]>(initialQueueRef.current);
  const [isLoading, setIsLoading] = useState(initialQueueRef.current.length === 0);
  const queueRef = useRef<QueuedPokemon[]>(initialQueueRef.current);
  const isRefillingRef = useRef(false);

  const [showSuperLikeFx, setShowSuperLikeFx] = useState(false);
  const superLikeAnimRef = useRef(
    Array.from({ length: SUPERLIKE_BALLS }, () => new Animated.Value(0))
  );
  const superLikeSoundRef = useRef<Audio.Sound | null>(null);

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
    Vibration.vibrate(24);
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

  const handleSwipe = async (
    pokemon: QueuedPokemon,
    action: typeof likePokemon | typeof dislikePokemon,
    isSuperLike = false
  ) => {
    dispatch(action(pokemon));

    if (action === likePokemon && !isSuperLike) {
      playLikeFeedback();
    }
    if (isSuperLike) {
      playSuperLikeFeedback();
      triggerSuperLikeFx();
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
        <Text style={[styles.likedButtonText, { color: theme.textPrimary }]}>Liked {likedCount}</Text>
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
  likedButtonText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Typography.body,
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
