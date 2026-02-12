import { Stack } from 'expo-router';
import SwipeScreen from '../src/screens/SwipeScreen';

export default function Swipe() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SwipeScreen />
    </>
  );
}
