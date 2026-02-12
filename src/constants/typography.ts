import { Platform } from 'react-native';

export const Typography = Platform.select({
  ios: {
    logo: 'Bangers_400Regular',
    heading: 'PatrickHand_400Regular',
    body: 'PatrickHand_400Regular',
    button: 'PatrickHand_400Regular',
  },
  android: {
    logo: 'Bangers_400Regular',
    heading: 'PatrickHand_400Regular',
    body: 'PatrickHand_400Regular',
    button: 'PatrickHand_400Regular',
  },
  default: {
    logo: 'Bangers_400Regular',
    heading: 'PatrickHand_400Regular',
    body: 'PatrickHand_400Regular',
    button: 'PatrickHand_400Regular',
  },
});
