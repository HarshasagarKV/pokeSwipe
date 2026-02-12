import React, { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ThemeSwitchProps {
  isDark: boolean;
  onLight: () => void;
  onDark: () => void;
}

const TRACK_WIDTH = 88;
const TRACK_HEIGHT = 42;
const KNOB_SIZE = 34;
const PADDING = 4;
const TRAVEL_DISTANCE = TRACK_WIDTH - KNOB_SIZE - PADDING * 2;

export default function ThemeSwitch({ isDark, onLight, onDark }: ThemeSwitchProps) {
  const translateX = useRef(new Animated.Value(isDark ? TRAVEL_DISTANCE : 0)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isDark ? TRAVEL_DISTANCE : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isDark, translateX]);

  return (
    <Pressable
      onPress={isDark ? onLight : onDark}
      style={[styles.track, { backgroundColor: isDark ? '#0F172A' : '#E2E8F0' }]}
    >
      <View style={styles.iconWrapLeft}>
        <Ionicons name="sunny" size={16} color={isDark ? '#64748B' : '#F59E0B'} />
      </View>
      <View style={styles.iconWrapRight}>
        <Ionicons name="moon" size={16} color={isDark ? '#93C5FD' : '#94A3B8'} />
      </View>

      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#93C5FD' : '#F59E0B',
            transform: [{ translateX }],
          },
        ]}
      >
        <Ionicons
          name={isDark ? 'moon' : 'sunny'}
          size={16}
          color={isDark ? '#93C5FD' : '#F59E0B'}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 2,
    borderColor: '#0F172A',
    justifyContent: 'center',
  },
  iconWrapLeft: {
    position: 'absolute',
    left: 12,
    top: 11,
  },
  iconWrapRight: {
    position: 'absolute',
    right: 12,
    top: 11,
  },
  knob: {
    position: 'absolute',
    left: PADDING,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
});
