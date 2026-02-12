import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const UI = {
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  swipe: {
    threshold: 120,
    superLikeThreshold: 120,
    cardWidth: Math.min(SCREEN_WIDTH * 0.94, 420),
    cardHeight: Math.min(SCREEN_HEIGHT * 0.70, 760),
    swipeDuration: 260,
  },
};

export const PALETTE = {
  light: {
    screenBg: '#F3F4F6',
    cardMask: 'rgba(248,250,252,0.98)',
    textPrimary: '#111827',
    textSecondary: '#334155',
    dislikeBg: '#FCA5A5',
    likeBg: '#86EFAC',
    badgeTypeBg: '#FDE047',
    badgeAbilityBg: '#67E8F9',
    badgeText: '#0F172A',
    border: '#1F2937',
  },
  dark: {
    screenBg: '#111827',
    cardMask: 'rgba(15,23,42,0.97)',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    dislikeBg: '#7F1D1D',
    likeBg: '#14532D',
    badgeTypeBg: '#334155',
    badgeAbilityBg: '#164E63',
    badgeText: '#F8FAFC',
    border: '#E2E8F0',
  },
};

export const TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  fire: { light: '#FCD34D', dark: '#F59E0B' },
  water: { light: '#67E8F9', dark: '#06B6D4' },
  grass: { light: '#86EFAC', dark: '#22C55E' },
  electric: { light: '#FDE047', dark: '#EAB308' },
  psychic: { light: '#F9A8D4', dark: '#EC4899' },
  ice: { light: '#A5F3FC', dark: '#22D3EE' },
  dragon: { light: '#C084FC', dark: '#A855F7' },
  dark: { light: '#A1A1AA', dark: '#71717A' },
  fairy: { light: '#FBCFE8', dark: '#F472B6' },
  normal: { light: '#D4D4D8', dark: '#A1A1AA' },
  fighting: { light: '#FCA5A5', dark: '#EF4444' },
  flying: { light: '#BAE6FD', dark: '#38BDF8' },
  poison: { light: '#DDD6FE', dark: '#A78BFA' },
  ground: { light: '#FED7AA', dark: '#FB923C' },
  rock: { light: '#D6D3D1', dark: '#A8A29E' },
  bug: { light: '#BEF264', dark: '#84CC16' },
  ghost: { light: '#DDD6FE', dark: '#A78BFA' },
  steel: { light: '#CBD5E1', dark: '#94A3B8' },
};

export const ABILITY_PALETTE = [
  '#FCA5A5',
  '#FCD34D',
  '#86EFAC',
  '#67E8F9',
  '#C4B5FD',
  '#FDA4AF',
  '#93C5FD',
  '#A7F3D0',
];
