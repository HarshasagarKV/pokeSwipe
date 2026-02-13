import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import ThemeSwitch from '../src/components/ThemeSwitch';
import { Typography } from '../src/constants/typography';
import { setThemeMode } from '../src/store/uiSlice';
import { RootState } from '../src/store';
import PokeTexture from '../src/components/PokeTexture';
import { warmupPokemonQueue } from '../src/api/pokemonQueue';

export default function Welcome() {
  const dispatch = useDispatch();
  const colorScheme = useColorScheme();
  const themeMode = useSelector((state: RootState) => state.ui.themeMode);
  const isDark = themeMode ? themeMode === 'dark' : colorScheme === 'dark';
  const [isPreparing, setIsPreparing] = useState(false);
  const cardEntryY = useRef(new Animated.Value(28)).current;
  const cardEntryScale = useRef(new Animated.Value(0.94)).current;
  const buttonPulse = useRef(new Animated.Value(0)).current;
  const buttonShine = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const ballRain = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    void warmupPokemonQueue(8);

    Animated.parallel([
      Animated.spring(cardEntryY, {
        toValue: 0,
        damping: 12,
        stiffness: 150,
        mass: 0.72,
        useNativeDriver: true,
      }),
      Animated.spring(cardEntryScale, {
        toValue: 1,
        damping: 11,
        stiffness: 155,
        mass: 0.68,
        useNativeDriver: true,
      }),
    ]).start();

    const logoLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(buttonShine, {
          toValue: 1,
          duration: 980,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonShine, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const rainLoops = ballRain.map((value, index) =>
      Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: 2200 + index * 250,
          delay: index * 220,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    );

    logoLoop.start();
    pulseLoop.start();
    shineLoop.start();
    rainLoops.forEach((loop) => loop.start());

    return () => {
      logoLoop.stop();
      pulseLoop.stop();
      shineLoop.stop();
      rainLoops.forEach((loop) => loop.stop());
    };
  }, [ballRain, buttonPulse, buttonShine, cardEntryScale, cardEntryY, logoFloat]);

  const handleStart = async () => {
    setIsPreparing(true);
    await warmupPokemonQueue(8);
    router.push('/swipe');
    setIsPreparing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111318' : '#E5E7EB' }]}>
      <PokeTexture isDark={isDark} />
      {ballRain.map((value, index) => {
        const lane = (index + 1) / (ballRain.length + 1);
        const left = `${lane * 100}%` as const;
        const translateY = value.interpolate({
          inputRange: [0, 1],
          outputRange: [-90 - index * 30, 720],
        });
        const opacity = value.interpolate({
          inputRange: [0, 0.12, 0.9, 1],
          outputRange: [0, 0.9, 0.9, 0],
        });

        return (
          <Animated.View
            key={`welcome-ball-${index}`}
            pointerEvents="none"
            style={[
              styles.rainBall,
              {
                left,
                opacity,
                transform: [{ translateX: -12 }, { translateY }],
              },
            ]}
          >
            <View style={styles.rainBallTop} />
            <View style={styles.rainBallBottom} />
            <View style={styles.rainBallBand} />
            <View style={styles.rainBallCenter} />
          </Animated.View>
        );
      })}

      <View style={styles.themeSwitchWrap}>
        <ThemeSwitch
          isDark={isDark}
          onLight={() => dispatch(setThemeMode('light'))}
          onDark={() => dispatch(setThemeMode('dark'))}
        />
      </View>

      <Animated.Text
        style={[
          styles.logo,
          { color: isDark ? '#FACC15' : '#1D4ED8' },
          {
            transform: [
              {
                translateY: logoFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -7],
                }),
              },
            ],
          },
        ]}
      >
        PokéApi
      </Animated.Text>

      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1A1E26' : '#D1D5DB',
            borderColor: isDark ? '#D1D5DB' : '#1F2937',
            transform: [{ translateY: cardEntryY }, { scale: cardEntryScale }],
          },
        ]}
      >
        <View style={[styles.cardBand, { backgroundColor: isDark ? '#1D4ED8' : '#F59E0B' }]} />
        <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#111827' }]}>How to Play PokéSwipe</Text>

        <View style={styles.stepsWrap}>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Pokémon appear one at a time</Text>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Swipe right for ♥, left for ✕</Text>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Swipe up for Super Like</Text>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Build your favorite team</Text>
        </View>

        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: isDark ? '#047857' : '#65D97B',
              borderColor: isDark ? '#BBF7D0' : '#14532D',
            },
            isPreparing && styles.buttonDisabled,
          ]}
          onPress={handleStart}
          disabled={isPreparing}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.buttonPulse,
              {
                opacity: buttonPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.25, 0],
                }),
                transform: [
                  {
                    scale: buttonPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.14],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.buttonShine,
              {
                opacity: buttonShine.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 0.34, 0.34, 0],
                }),
                transform: [
                  {
                    translateX: buttonShine.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-220, 240],
                    }),
                  },
                  { rotate: '-18deg' },
                ],
              },
            ]}
          />
          <Text style={styles.buttonText}>{isPreparing ? 'Preparing...' : "Let's Go!"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  logo: {
    fontSize: 52,
    marginBottom: 18,
    fontFamily: Typography.logo,
    letterSpacing: 1,
    textShadowColor: 'rgba(15,23,42,0.35)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 1,
  },
  themeSwitchWrap: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
  },
  rainBall: {
    position: 'absolute',
    top: -40,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0F172A',
    overflow: 'hidden',
  },
  rainBallTop: {
    flex: 1,
    backgroundColor: '#EF4444',
  },
  rainBallBottom: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  rainBallBand: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#111827',
  },
  rainBallCenter: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#FFFFFF',
  },
  card: {
    width: '90%',
    maxWidth: 460,
    minHeight: 450,
    borderRadius: 34,
    borderWidth: 4,
    padding: 24,
    overflow: 'hidden',
  },
  cardBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 9,
  },
  title: {
    fontSize: 26,
    marginBottom: 22,
    fontFamily: Typography.heading,
  },
  stepsWrap: {
    gap: 10,
    marginBottom: 22,
  },
  step: {
    fontSize: 20,
    fontFamily: Typography.body,
  },
  button: {
    marginTop: 'auto',
    borderRadius: 20,
    borderWidth: 3,
    paddingVertical: 15,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#052E16',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 7,
  },
  buttonPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#DCFCE7',
  },
  buttonText: {
    fontSize: 28,
    color: '#ECFDF5',
    fontFamily: Typography.button,
    letterSpacing: 0.8,
    textShadowColor: 'rgba(2,44,34,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  buttonShine: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: 56,
    backgroundColor: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
