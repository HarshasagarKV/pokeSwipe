import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  useColorScheme,
  Modal,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { RootState } from '../src/store';
import { Typography } from '../src/constants/typography';
import ThemeSwitch from '../src/components/ThemeSwitch';
import { setThemeMode } from '../src/store/uiSlice';
import PokeTexture from '../src/components/PokeTexture';
import { ABILITY_PALETTE, PALETTE, TYPE_COLORS } from '../src/constants/ui';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 56, 340);
const MODAL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.62, 500);
const MIN_HEADER_TOP_SPACE = 14;

type LikedPokemon = RootState['pokemon']['likedPokemon'][number];

export default function Liked() {
  const dispatch = useDispatch();
  const colorScheme = useColorScheme();
  const themeMode = useSelector((state: RootState) => state.ui.themeMode);
  const isDark = themeMode ? themeMode === 'dark' : colorScheme === 'dark';
  const theme = isDark ? PALETTE.dark : PALETTE.light;
  const liked = useSelector((state: RootState) => state.pokemon.likedPokemon);
  const insets = useSafeAreaInsets();
  const topSpacing = Math.max(insets.top, StatusBar.currentHeight ?? 0, MIN_HEADER_TOP_SPACE);

  const [selectedPokemon, setSelectedPokemon] = useState<LikedPokemon | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const startTranslateRef = useRef({ x: 0, y: 0 });
  const startScaleRef = useRef(0.5);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacityAnim = useRef(new Animated.Value(0)).current;

  const cardRefs = useRef<Record<string, View | null>>({});

  const selectedAccentColor = useMemo(() => {
    if (!selectedPokemon) return isDark ? '#93C5FD' : '#1D4ED8';
    const key = selectedPokemon.types?.[0]?.toLowerCase() || 'normal';
    const palette = TYPE_COLORS[key] || TYPE_COLORS.normal;
    return isDark ? palette.light : palette.dark;
  }, [selectedPokemon, isDark]);

  const selectedAbilityColor = useMemo(() => {
    const seed = selectedPokemon?.abilities?.join('-') || selectedPokemon?.name || 'pokemon';
    const idx = seed.length % ABILITY_PALETTE.length;
    return ABILITY_PALETTE[idx];
  }, [selectedPokemon]);

  const modalGradientUri = useMemo(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='${selectedAccentColor}'/><stop offset='100%' stop-color='${selectedAbilityColor}'/></linearGradient></defs><rect width='100' height='100' fill='url(#g)'/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [selectedAccentColor, selectedAbilityColor]);

  const getImageUri = (pokemon: LikedPokemon) => pokemon.imageFallback || pokemon.image;

  const openPokemonModal = (pokemon: LikedPokemon, key: string) => {
    const cardRef = cardRefs.current[key];

    if (!cardRef) {
      scaleAnim.setValue(1);
      translateXAnim.setValue(0);
      translateYAnim.setValue(0);
      overlayOpacityAnim.setValue(1);
      setSelectedPokemon(pokemon);
      setIsModalVisible(true);
      return;
    }

    cardRef.measureInWindow((x, y, width, height) => {
      const cardCenterX = x + width / 2;
      const cardCenterY = y + height / 2;
      const screenCenterX = SCREEN_WIDTH / 2;
      const screenCenterY = SCREEN_HEIGHT / 2;

      startTranslateRef.current = {
        x: cardCenterX - screenCenterX,
        y: cardCenterY - screenCenterY,
      };
      const xScale = width / MODAL_WIDTH;
      const yScale = height / MODAL_HEIGHT;
      startScaleRef.current = Math.min(xScale, yScale);

      scaleAnim.setValue(startScaleRef.current);
      translateXAnim.setValue(startTranslateRef.current.x);
      translateYAnim.setValue(startTranslateRef.current.y);
      overlayOpacityAnim.setValue(0);
      setSelectedPokemon(pokemon);
      setIsModalVisible(true);

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateXAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacityAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: startScaleRef.current,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateXAnim, {
        toValue: startTranslateRef.current.x,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: startTranslateRef.current.y,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacityAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsModalVisible(false);
      setSelectedPokemon(null);
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#E5E7EB' }]}>
      <PokeTexture isDark={isDark} />
      <View style={[styles.topRow, { marginTop: topSpacing + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { borderColor: isDark ? '#E5E7EB' : '#111827' }]}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#F8FAFC' : '#111827'} />
        </Pressable>

        <ThemeSwitch
          isDark={isDark}
          onLight={() => dispatch(setThemeMode('light'))}
          onDark={() => dispatch(setThemeMode('dark'))}
        />
      </View>

      <Text style={[styles.logo, { color: isDark ? '#FDE047' : '#1E40AF' }]}>PokéApi</Text>
      <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#111827' }]}>Pokémon you have liked</Text>

      {liked.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
            No liked Pokémon yet. Swipe right to add some.
          </Text>
        </View>
      ) : (
        <FlatList
          data={liked}
          numColumns={2}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const key = `${item.id}-${index}`;
            return (
              <Pressable
                ref={(ref) => {
                  cardRefs.current[key] = ref;
                }}
                onPress={() => openPokemonModal(item, key)}
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? '#1F2937' : '#D1D5DB',
                    borderColor: isDark ? '#E2E8F0' : '#1F2937',
                  },
                ]}
              >
                <ExpoImage
                  source={{ uri: getImageUri(item) }}
                  style={styles.image}
                  contentFit="contain"
                />
                <Text style={[styles.name, { color: isDark ? '#F8FAFC' : '#1F2937' }]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={isModalVisible} transparent onRequestClose={closeModal} animationType="none">
        <Animated.View style={[styles.modalBackdrop, { opacity: overlayOpacityAnim }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModal} />
          <Animated.View
            style={[
              styles.modalCard,
              {
                borderColor: selectedAccentColor,
                width: MODAL_WIDTH,
                height: MODAL_HEIGHT,
              },
              {
                transform: [
                  { translateX: translateXAnim },
                  { translateY: translateYAnim },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <ExpoImage
              source={{ uri: modalGradientUri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
            <View style={[styles.modalMask, { backgroundColor: theme.cardMask }]} />
            <View style={[styles.modalTopAccent, { backgroundColor: selectedAccentColor }]} />
            {selectedPokemon ? (
              <>
                <Text style={[styles.modalName, { color: isDark ? '#F8FAFC' : '#111827' }]}>
                  {selectedPokemon.name}
                </Text>

                <View style={styles.modalImageWrap}>
                  <ExpoImage
                    source={{ uri: getImageUri(selectedPokemon) }}
                    style={styles.modalImage}
                    contentFit="contain"
                  />
                </View>

                <View style={styles.detailWrap}>
                  {selectedPokemon.types?.map((type) => (
                    <View
                      key={`modal-${selectedPokemon.id}-${type}`}
                      style={[
                        styles.detailBadge,
                        {
                          backgroundColor: theme.badgeTypeBg,
                          borderColor: selectedAccentColor,
                        },
                      ]}
                    >
                      <Text style={[styles.detailText, { color: theme.badgeText }]}>
                        {type.toUpperCase()}
                      </Text>
                    </View>
                  ))}

                  {selectedPokemon.abilities?.map((ability) => (
                    <View
                      key={`modal-${selectedPokemon.id}-${ability}`}
                      style={[
                        styles.detailBadge,
                        {
                          backgroundColor: theme.badgeAbilityBg,
                          borderColor: selectedAccentColor,
                        },
                      ]}
                    >
                      <Text style={[styles.detailText, { color: theme.badgeText }]}>
                        {ability.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: Typography.logo,
  },
  title: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 30,
    fontWeight: '900',
    fontFamily: Typography.heading,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Typography.body,
  },
  list: {
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    flex: 1,
    margin: 8,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 210,
  },
  image: {
    width: 160,
    height: 160,
    marginBottom: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontFamily: Typography.heading,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 4,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalMask: {
    ...StyleSheet.absoluteFillObject,
  },
  modalTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
  },
  modalImage: {
    width: 250,
    height: 250,
  },
  modalImageWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalName: {
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontFamily: Typography.logo,
  },
  detailWrap: {
    marginTop: 'auto',
    marginBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  detailBadge: {
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detailText: {
    fontSize: 13,
    fontFamily: Typography.body,
    fontWeight: '700',
  },
});
