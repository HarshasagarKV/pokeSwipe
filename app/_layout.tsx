import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { store } from '../src/store';
import { useFonts } from 'expo-font';
import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Bangers_400Regular,
    PatrickHand_400Regular,
  });

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
