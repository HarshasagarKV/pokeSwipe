import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Text, TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { store } from '../src/store';
import { useFonts } from 'expo-font';
import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { Typography } from '../src/constants/typography';

export default function RootLayout() {
  const defaultsApplied = useRef(false);
  const [fontsLoaded] = useFonts({
    Bangers_400Regular,
    PatrickHand_400Regular,
  });

  useEffect(() => {
    if (!fontsLoaded || defaultsApplied.current) return;

    const baseTextStyle = { fontFamily: Typography.body };
    const currentTextStyle = Text.defaultProps?.style;
    const currentInputStyle = TextInput.defaultProps?.style;

    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = [baseTextStyle, currentTextStyle];

    TextInput.defaultProps = TextInput.defaultProps || {};
    TextInput.defaultProps.style = [baseTextStyle, currentInputStyle];

    defaultsApplied.current = true;
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </Provider>
    </GestureHandlerRootView>
  );
}
