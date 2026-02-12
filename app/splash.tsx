import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../src/store';
import { Typography } from '../src/constants/typography';
import PokeTexture from '../src/components/PokeTexture';
import { warmupPokemonQueue } from '../src/api/pokemonQueue';

export default function Splash() {
  const colorScheme = useColorScheme();
  const themeMode = useSelector((state: RootState) => state.ui.themeMode);
  const isDark = themeMode ? themeMode === 'dark' : colorScheme === 'dark';

  const scale = useRef(new Animated.Value(0.92)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void warmupPokemonQueue(8);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.04,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const rotate = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulse.start();
    rotate.start();

    const timer = setTimeout(() => {
      router.replace('/welcome');
    }, 2200);

    return () => {
      clearTimeout(timer);
      pulse.stop();
      rotate.stop();
    };
  }, [scale, spin]);

  const rotateInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#E5E7EB' }]}>
      <PokeTexture isDark={isDark} />
      <Animated.View style={[styles.pokeball, { transform: [{ scale }, { rotate: rotateInterpolate }] }]}> 
        <View style={[styles.pokeballTop, { backgroundColor: isDark ? '#DC2626' : '#EF4444' }]} />
        <View style={[styles.pokeballBottom, { backgroundColor: isDark ? '#E2E8F0' : '#FFFFFF' }]} />
        <View style={[styles.pokeballBand, { backgroundColor: isDark ? '#94A3B8' : '#111827' }]} />
        <View style={[styles.pokeballCenter, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#CBD5E1' : '#111827' }]} />
      </Animated.View>

      <Text style={[styles.logo, { color: isDark ? '#FDE047' : '#1D4ED8' }]}>PokéSwipe</Text>
      <Text style={[styles.tag, { color: isDark ? '#CBD5E1' : '#334155' }]}>Swipe. Build. Catch Favorites.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pokeball: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
    borderColor: '#111827',
    overflow: 'hidden',
    marginBottom: 22,
  },
  pokeballTop: {
    flex: 1,
  },
  pokeballBottom: {
    flex: 1,
  },
  pokeballBand: {
    position: 'absolute',
    top: '47%',
    left: 0,
    right: 0,
    height: 8,
  },
  pokeballCenter: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    top: '39%',
    left: '39%',
  },
  logo: {
    fontSize: 56,
    fontFamily: Typography.logo,
    letterSpacing: 1,
    textShadowColor: 'rgba(15,23,42,0.35)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 2,
  },
  tag: {
    marginTop: 10,
    fontSize: 24,
    fontFamily: Typography.body,
  },
});
