import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * expo-secure-store has no web implementation (there's no OS keychain in a browser) - calling it
 * on web throws ("deleteValueWithKeyAsync is not a function" and similar, depending on which
 * internal method the polyfill happens to hit). This app's own package.json lists
 * `"web": "expo start --web"` as a supported target, so rather than letting every auth action
 * crash there, fall back to localStorage on web and the real secure keychain everywhere else.
 * Native platforms are unaffected - this only changes behavior on Platform.OS === "web".
 */
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private browsing/storage disabled - the session just won't survive a reload.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Ignore, same as above.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
