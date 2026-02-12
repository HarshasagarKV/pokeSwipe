import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ThemeMode = 'light' | 'dark';

interface UIState {
  themeMode: ThemeMode;
}

const initialState: UIState = {
  themeMode: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
    },
    toggleThemeMode: (state) => {
      state.themeMode = state.themeMode === 'dark' ? 'light' : 'dark';
    },
  },
});

export const { setThemeMode, toggleThemeMode } = uiSlice.actions;
export default uiSlice.reducer;
