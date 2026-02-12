import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import ThemeSwitch from '../src/components/ThemeSwitch';
import { Typography } from '../src/constants/typography';
import { setThemeMode } from '../src/store/uiSlice';
import { RootState } from '../src/store';
import PokeTexture from '../src/components/PokeTexture';
import { warmupPokemonQueue } from '../src/api/pokemonQueue';
import { useEffect, useState } from 'react';

export default function Welcome() {
  const dispatch = useDispatch();
  const colorScheme = useColorScheme();
  const themeMode = useSelector((state: RootState) => state.ui.themeMode);
  const isDark = themeMode ? themeMode === 'dark' : colorScheme === 'dark';
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    void warmupPokemonQueue(8);
  }, []);

  const handleStart = async () => {
    setIsPreparing(true);
    await warmupPokemonQueue(8);
    router.push('/swipe');
    setIsPreparing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111318' : '#E5E7EB' }]}>
      <PokeTexture isDark={isDark} />
      <View style={styles.themeSwitchWrap}>
        <ThemeSwitch
          isDark={isDark}
          onLight={() => dispatch(setThemeMode('light'))}
          onDark={() => dispatch(setThemeMode('dark'))}
        />
      </View>

      <Text style={[styles.logo, { color: isDark ? '#FACC15' : '#1D4ED8' }]}>PokéApi</Text>

      <View style={[styles.card, { backgroundColor: isDark ? '#1A1E26' : '#D1D5DB', borderColor: isDark ? '#D1D5DB' : '#1F2937' }]}>
        <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#111827' }]}>How to Play PokéSwipe</Text>

        <View style={styles.stepsWrap}>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Pokémon appear one at a time</Text>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Swipe right for ♥, left for ✕</Text>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Swipe up for Super Like</Text>
          <Text style={[styles.step, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Build your favorite team</Text>
        </View>


        <Pressable
          style={[styles.button, { backgroundColor: isDark ? '#047857' : '#65D97B' }, isPreparing && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={isPreparing}
        >
          <Text style={styles.buttonText}>{isPreparing ? 'Preparing...' : "Let's Go!"}</Text>
        </Pressable>
      </View>
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
  // stackShadow: {
  //   position: 'absolute',
  //   width: '86%',
  //   height: '66%',
  //   borderRadius: 34,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 4 },
  //   shadowOpacity: 0.18,
  //   shadowRadius: 10,
  //   elevation: 4,
  // },
  shadowTwo: {
    bottom: 48,
  },
  shadowThree: {
    bottom: 34,
  },
  card: {
    width: '90%',
    maxWidth: 460,
    minHeight: 450,
    borderRadius: 34,
    borderWidth: 4,
    padding: 24,
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
  tipBox: {
    borderWidth: 2,
    borderColor: '#94A3B8',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  tipText: {
    fontSize: 16,
    fontFamily: Typography.body,
  },
  button: {
    marginTop: 'auto',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 24,
    color: '#0B1A13',
    fontFamily: Typography.button,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
