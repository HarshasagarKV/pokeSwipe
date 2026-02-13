import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
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
const SUPERLIKE_BALLS = 34;
const RARE_BALLS = 14;
const ICONIC_POKEMON = new Set(['PIKACHU', 'CHARIZARD', 'MEWTWO', 'EEVEE', 'SNORLAX']);
const RARE_POKEMON_IDS = new Set([144, 145, 146, 150, 151]);
const SPEED_HINTS = ['speed', 'quick', 'swift', 'agility', 'dash', 'motor', 'surge'];
const AGGRESSIVE_TYPES = new Set(['fire', 'fighting', 'electric', 'dragon', 'dark', 'poison']);
const AGGRESSIVE_HINTS = ['blaze', 'rage', 'power', 'attack', 'intimidate', 'fury', 'claw', 'rough', 'moxie'];
const FEEDBACK_VISIBLE_MS = 1500;
const SUPERLIKE_FX_DURATION_MS = 1450;

type SwipeInsight = {
  line1: string;
  line2: string;
};

type CenterPopup = {
  title: string;
  subtitle?: string;
  emoji?: string;
  accentColor: string;
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
  const [isProcessingSwipe, setIsProcessingSwipe] = useState(false);
  const isProcessingSwipeRef = useRef(false);
  const queueRef = useRef<QueuedPokemon[]>(initialQueueRef.current);
  const isRefillingRef = useRef(false);

  const [showSuperLikeFx, setShowSuperLikeFx] = useState(false);
  const [showRareFx, setShowRareFx] = useState(false);
  const [centerPopup, setCenterPopup] = useState<CenterPopup | null>(null);
  const superLikeAnimRef = useRef(
    Array.from({ length: SUPERLIKE_BALLS }, () => new Animated.Value(0))
  );
  const rareAnimRef = useRef(Array.from({ length: RARE_BALLS }, () => new Animated.Value(0)));
  const superLikeSoundRef = useRef<Audio.Sound | null>(null);
  const pokeballSpinAnim = useRef(new Animated.Value(0)).current;
  const likedCountScaleAnim = useRef(new Animated.Value(1)).current;
  const likedPlusOneAnim = useRef(new Animated.Value(0)).current;
  const likedPulseAnim = useRef(new Animated.Value(0)).current;
  const previousLikedCountRef = useRef(likedCount);
  const popupScaleAnim = useRef(new Animated.Value(0.82)).current;
  const popupOpacityAnim = useRef(new Animated.Value(0)).current;
  const popupTiltAnim = useRef(new Animated.Value(0)).current;
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInsightShownAtRef = useRef(0);

  const preferenceInsight = useMemo(() => getPreferenceInsight(swipeHistory), [swipeHistory]);
  const pokeballSpin = pokeballSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const popupTilt = popupTiltAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-2.8deg', '0deg', '2.8deg'],
  });
  const likedPlusOneTranslateY = likedPlusOneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -16],
  });
  const likedPulseScale = likedPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1.32],
  });

  const setQueue = (nextQueue: QueuedPokemon[]) => {
    queueRef.current = nextQueue;
    setPokemonQueue(nextQueue);
  };

  const prefetchFromQueue = useCallback((cards: QueuedPokemon[], count = 2) => {
    const urls = cards
      .slice(0, count)
      .flatMap((pokemon) => [pokemon.image, pokemon.imageFallback])
      .filter((value): value is string => Boolean(value));

    if (urls.length === 0) return;
    void ExpoImage.prefetch(Array.from(new Set(urls)), 'memory-disk');
  }, []);

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
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/super-like.wav'),
          {
            volume: 0.9,
            shouldPlay: false,
            isLooping: false,
          }
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

  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
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

  const playSuperLikeFeedback = useCallback(async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Vibration.vibrate([0, 40, 30, 70, 30, 120]);

    try {
      let sound = superLikeSoundRef.current;
      if (!sound) {
        const created = await Audio.Sound.createAsync(
          require('../../assets/sounds/super-like.wav'),
          {
            shouldPlay: false,
            volume: 0.9,
            isLooping: false,
          }
        );
        sound = created.sound;
        superLikeSoundRef.current = sound;
      }

      const replayStatus = await sound.replayAsync();
      if (replayStatus.isLoaded) {
        const remainingMs = Math.max(
          650,
          Math.min(2200, (replayStatus.durationMillis ?? 900) - (replayStatus.positionMillis ?? 0))
        );
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }
    } catch (error) {
      console.error('Error playing super like sound:', error);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }, []);

  const triggerSuperLikeFx = useCallback(async () => {
    const animatedValues = superLikeAnimRef.current;
    animatedValues.forEach((value) => value.setValue(0));
    setShowSuperLikeFx(true);

    await new Promise<void>((resolve) => {
      Animated.parallel(
        animatedValues.map((value, index) =>
          Animated.timing(value, {
            toValue: 1,
            duration: SUPERLIKE_FX_DURATION_MS,
            delay: index * 45,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start(() => {
        setShowSuperLikeFx(false);
        resolve();
      });
    });
  }, []);

  const triggerRarePokemonFx = useCallback(() => {
    const animatedValues = rareAnimRef.current;
    animatedValues.forEach((value) => value.setValue(0));
    setShowRareFx(true);

    Animated.parallel(
      animatedValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 920,
          delay: index * 32,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start(() => {
      setShowRareFx(false);
    });
  }, []);

  const showCenterPopup = useCallback(
    (popup: CenterPopup) => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }

      setCenterPopup(popup);
      popupScaleAnim.setValue(0.82);
      popupOpacityAnim.setValue(0);
      popupTiltAnim.setValue(0);

      Animated.parallel([
        Animated.timing(popupOpacityAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(popupScaleAnim, {
          toValue: 1,
          damping: 11,
          stiffness: 160,
          mass: 0.75,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(popupTiltAnim, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(popupTiltAnim, {
            toValue: -1,
            duration: 140,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(popupTiltAnim, {
            toValue: 0,
            duration: 120,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      popupTimeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(popupOpacityAnim, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(popupScaleAnim, {
            toValue: 0.9,
            duration: 180,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => setCenterPopup(null));
      }, FEEDBACK_VISIBLE_MS);
    },
    [popupOpacityAnim, popupScaleAnim, popupTiltAnim]
  );

  useEffect(() => {
    if (!preferenceInsight || swipeHistory.length < 10 || swipeHistory.length % 10 !== 0) return;
    if (lastInsightShownAtRef.current === swipeHistory.length) return;

    lastInsightShownAtRef.current = swipeHistory.length;
    showCenterPopup({
      title: preferenceInsight.line1,
      subtitle: preferenceInsight.line2,
      emoji: '🔥',
      accentColor: '#F97316',
    });
  }, [preferenceInsight, showCenterPopup, swipeHistory.length]);

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
      likedPlusOneAnim.setValue(0);
      likedPulseAnim.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(likedCountScaleAnim, {
            toValue: 1.34,
            duration: 130,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(likedCountScaleAnim, {
            toValue: 1,
            duration: 180,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(likedPlusOneAnim, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(likedPlusOneAnim, {
            toValue: 0,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(likedPulseAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(likedPulseAnim, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
    previousLikedCountRef.current = likedCount;
  }, [likedCount, likedCountScaleAnim, likedPlusOneAnim, likedPulseAnim]);

  const handleSwipe = async (
    pokemon: QueuedPokemon,
    action: typeof likePokemon | typeof dislikePokemon,
    isSuperLike = false
  ) => {
    if (isProcessingSwipeRef.current) return;
    isProcessingSwipeRef.current = true;
    setIsProcessingSwipe(true);

    try {
      dispatch(action(pokemon));

      if (action === likePokemon && !isSuperLike) {
        playLikeFeedback();
      }
      if (action === dislikePokemon) {
        playDislikeFeedback();
      }
      if (isSuperLike) {
        await Promise.all([playSuperLikeFeedback(), triggerSuperLikeFx()]);
      }
      const isRarePokemon = RARE_POKEMON_IDS.has(pokemon.id);
      if (isRarePokemon) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        triggerRarePokemonFx();
        showCenterPopup({
          title: `Rare sighting: ${pokemon.name}`,
          subtitle: 'Legendary energy detected',
          emoji: '🌟',
          accentColor: '#38BDF8',
        });
      } else if ((action === likePokemon || isSuperLike) && ICONIC_POKEMON.has(pokemon.name)) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showCenterPopup({
          title: `Favorite vibe: ${pokemon.name}`,
          subtitle: 'Iconic Pokémon unlocked',
          emoji: '⚡',
          accentColor: '#EAB308',
        });
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
      prefetchFromQueue(workingQueue, 2);
      void refillQueue();
    } finally {
      isProcessingSwipeRef.current = false;
      setIsProcessingSwipe(false);
    }
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
          <Animated.View
            pointerEvents="none"
            style={[
              styles.likedPulseRing,
              {
                opacity: likedPulseAnim,
                transform: [{ scale: likedPulseScale }],
              },
            ]}
          />
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
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.plusOneText,
              {
                opacity: likedPlusOneAnim,
                transform: [{ translateY: likedPlusOneTranslateY }, { scale: likedCountScaleAnim }],
              },
            ]}
          >
            +1
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
            isInteractive={!isProcessingSwipe}
            onSwipeRight={(p) => handleSwipe(p as QueuedPokemon, likePokemon)}
            onSwipeLeft={(p) => handleSwipe(p as QueuedPokemon, dislikePokemon)}
            onSuperLike={(p) => handleSwipe(p as QueuedPokemon, likePokemon, true)}
          />
        </View>
      </View>

      {centerPopup ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.popupBackdrop,
              {
                opacity: popupOpacityAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                backgroundColor: isDark ? 'rgba(2,6,23,0.46)' : 'rgba(15,23,42,0.26)',
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.centerPopupWrap,
              {
                opacity: popupOpacityAnim,
                transform: [{ scale: popupScaleAnim }, { rotate: popupTilt }],
                backgroundColor: isDark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.96)',
                borderColor: centerPopup.accentColor,
              },
            ]}
          >
            {centerPopup.emoji ? <Text style={styles.centerPopupEmoji}>{centerPopup.emoji}</Text> : null}
            <Text style={[styles.centerPopupTitle, { color: theme.textPrimary }]}>{centerPopup.title}</Text>
            {centerPopup.subtitle ? (
              <Text style={[styles.centerPopupSubtitle, { color: theme.textSecondary }]}>
                {centerPopup.subtitle}
              </Text>
            ) : null}
          </Animated.View>
        </>
      ) : null}

      {showSuperLikeFx ? (
        <View pointerEvents="none" style={styles.superLikeFxWrap}>
          <Animated.Text
            style={[
              styles.superLikeText,
              {
                opacity: superLikeAnimRef.current[0].interpolate({
                  inputRange: [0, 0.08, 0.94, 1],
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
            const lane = (index + 1) / (SUPERLIKE_BALLS + 1);
            const left = UI.screen.width * lane - 14;
            const sideJitter = (index % 2 === 0 ? -1 : 1) * (8 + (index % 4) * 6);
            const translateX = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, sideJitter],
            });
            const translateY = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-120 - (index % 7) * 24, UI.screen.height * 1.08],
            });
            const scale = progress.interpolate({
              inputRange: [0, 0.18, 1],
              outputRange: [0.45, 0.95, 0.88],
            });
            const opacity = progress.interpolate({
              inputRange: [0, 0.12, 0.92, 1],
              outputRange: [0, 1, 1, 0],
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.superBall,
                  {
                    top: 0,
                    left,
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

      {showRareFx ? (
        <View pointerEvents="none" style={styles.rareFxWrap}>
          {rareAnimRef.current.map((progress, index) => {
            const angle = (index / RARE_BALLS) * Math.PI * 2;
            const distance = 36 + (index % 4) * 18;
            const translateX = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, Math.cos(angle) * distance],
            });
            const translateY = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -140 + Math.sin(angle) * 26],
            });
            const scale = progress.interpolate({
              inputRange: [0, 0.35, 1],
              outputRange: [0.5, 1.08, 0.7],
            });
            const opacity = progress.interpolate({
              inputRange: [0, 0.75, 1],
              outputRange: [0, 1, 0],
            });

            return (
              <Animated.View
                key={`rare-ball-${index}`}
                style={[
                  styles.rareBall,
                  {
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}
              >
                <View style={styles.rareBallTop} />
                <View style={styles.rareBallBottom} />
                <View style={styles.rareBallBand} />
                <View style={styles.rareBallCenter} />
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
    position: 'relative',
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
  likedPulseRing: {
    position: 'absolute',
    right: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#F97316',
  },
  plusOneText: {
    position: 'absolute',
    right: -18,
    top: -16,
    fontSize: 18,
    color: '#F97316',
    fontFamily: Typography.logo,
  },
  centerPopupWrap: {
    position: 'absolute',
    top: UI.screen.height * 0.36,
    maxWidth: UI.screen.width * 0.86,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 3,
    zIndex: 45,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },
  popupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 42,
  },
  centerPopupEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  centerPopupTitle: {
    fontSize: 26,
    textAlign: 'center',
    fontFamily: Typography.logo,
  },
  centerPopupSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    fontFamily: Typography.logo,
  },
  superLikeFxWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 140,
    elevation: 140,
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
    zIndex: 160,
    elevation: 160,
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
  rareFxWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 62,
  },
  rareBall: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0F172A',
    overflow: 'hidden',
  },
  rareBallTop: {
    flex: 1,
    backgroundColor: '#38BDF8',
  },
  rareBallBottom: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  rareBallBand: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#0F172A',
  },
  rareBallCenter: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
});
