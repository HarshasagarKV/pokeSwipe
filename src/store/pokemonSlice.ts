// src/store/pokemonSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Pokemon {
  id: number;
  name: string;
  image: string;
  types?: string[];
  abilities?: string[];
}

interface PokemonHistory extends Pokemon {
  liked: boolean;
  timestamp: number;
}

interface PokemonState {
  likedPokemon: Pokemon[];
  dislikedPokemon: Pokemon[];
  history: PokemonHistory[];
}

const initialState: PokemonState = {
  likedPokemon: [],
  dislikedPokemon: [],
  history: [],
};

const pokemonSlice = createSlice({
  name: 'pokemon',
  initialState,
  reducers: {
    likePokemon: (state, action: PayloadAction<Pokemon>) => {
      const pokemon = action.payload;
      state.likedPokemon.push(pokemon);
      state.history.push({ ...pokemon, liked: true, timestamp: Date.now() });
    },
    dislikePokemon: (state, action: PayloadAction<Pokemon>) => {
      const pokemon = action.payload;
      state.dislikedPokemon.push(pokemon);
      state.history.push({ ...pokemon, liked: false, timestamp: Date.now() });
    },
    removeLikedPokemon: (state, action: PayloadAction<number>) => {
      const pokemonId = action.payload;
      state.likedPokemon = state.likedPokemon.filter(p => p.id !== pokemonId);
    },
    clearHistory: (state) => {
      state.likedPokemon = [];
      state.dislikedPokemon = [];
      state.history = [];
    },
  },
});

export const { likePokemon, dislikePokemon, removeLikedPokemon, clearHistory } = pokemonSlice.actions;
export default pokemonSlice.reducer;