import React from 'react';
import { View, StyleSheet } from 'react-native';

interface PokeTextureProps {
  isDark: boolean;
}

const BALLS = [
  { top: '10%', left: '8%', size: 92 },
  { top: '20%', right: '10%', size: 74 },
  { top: '46%', left: '4%', size: 62 },
  { top: '68%', right: '8%', size: 84 },
  { bottom: '10%', left: '30%', size: 70 },
];

export default function PokeTexture({ isDark }: PokeTextureProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View
        style={[
          styles.baseNoise,
          { backgroundColor: isDark ? 'rgba(148,163,184,0.05)' : 'rgba(15,23,42,0.04)' },
        ]}
      />
      {BALLS.map((ball, index) => (
        <View
          key={index}
          style={[
            styles.ball,
            ball,
            {
              width: ball.size,
              height: ball.size,
              borderColor: isDark ? 'rgba(226,232,240,0.14)' : 'rgba(15,23,42,0.12)',
            },
          ]}
        >
          <View
            style={[
              styles.ballLine,
              { backgroundColor: isDark ? 'rgba(226,232,240,0.12)' : 'rgba(15,23,42,0.12)' },
            ]}
          />
          <View
            style={[
              styles.ballDot,
              {
                borderColor: isDark ? 'rgba(226,232,240,0.18)' : 'rgba(15,23,42,0.16)',
                backgroundColor: isDark ? 'rgba(226,232,240,0.08)' : 'rgba(255,255,255,0.65)',
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  baseNoise: {
    ...StyleSheet.absoluteFillObject,
  },
  ball: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
  },
  ballDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
});
