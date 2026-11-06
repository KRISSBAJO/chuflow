import * as SecureStore from 'expo-secure-store';

/** Keychain (iOS) / Keystore (Android) storage for the sign-in token. */
export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
