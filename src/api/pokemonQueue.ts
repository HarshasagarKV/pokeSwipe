import { Image as ExpoImage } from 'expo-image';
import { getRandomPokemon } from './pokeapi';

export interface QueuedPokemon {
  id: number;
  name: string;
  image: string;
  imageFallback?: string;
  types?: string[];
  abilities?: string[];
  queueId: number;
}

let queue: QueuedPokemon[] = [];
let sequence = 0;
let isWarming = false;
let waitingResolvers: (() => void)[] = [];
const DEFAULT_QUEUE_TARGET = 8;

const flushWaiters = () => {
  waitingResolvers.forEach((resolve) => resolve());
  waitingResolvers = [];
};

const createPokemonCard = async (): Promise<QueuedPokemon | null> => {
  try {
    const data = await getRandomPokemon();
    if (!data) return null;

    if (data.image) {
      ExpoImage.prefetch(data.image);
    }
    if (data.imageFallback) {
      ExpoImage.prefetch(data.imageFallback);
    }

    return {
      ...data,
      queueId: sequence++,
    };
  } catch (error) {
    console.error('Error creating preloaded pokemon card:', error);
    return null;
  }
};

export const warmupPokemonQueue = async (targetSize = DEFAULT_QUEUE_TARGET) => {
  if (queue.length >= targetSize) return;

  if (isWarming) {
    await new Promise<void>((resolve) => waitingResolvers.push(resolve));
    if (queue.length >= targetSize) return;
  }

  isWarming = true;
  try {
    while (queue.length < targetSize) {
      const next = await createPokemonCard();
      if (!next) break;
      queue = [...queue, next];
    }
  } finally {
    isWarming = false;
    flushWaiters();
  }
};

export const takePreloadedPokemonQueue = (count: number) => {
  const taken = queue.splice(0, count);
  void warmupPokemonQueue(Math.max(DEFAULT_QUEUE_TARGET, count + 2));
  return taken;
};

export const dequeuePokemonCard = async () => {
  if (queue.length === 0) {
    await warmupPokemonQueue(1);
  }

  const next = queue.shift() || null;
  void warmupPokemonQueue(DEFAULT_QUEUE_TARGET);
  return next;
};
