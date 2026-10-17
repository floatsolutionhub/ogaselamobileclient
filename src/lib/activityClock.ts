import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The auto-logout clock: when the user last touched the app. Kept outside AuthContext so screens
 * that render outside the root view (React Native Modals) and flows that leave the app (the
 * payment page) can report activity without needing the context.
 */
const STORAGE_KEY = "ogasela_last_activity_v1";

let lastActivityAt = Date.now();
let holds = 0;

export function markActivity(): void {
  lastActivityAt = Date.now();
}

/** How long the user has been idle. Always 0 while a hold is active. */
export function idleMs(): number {
  return holds > 0 ? 0 : Date.now() - lastActivityAt;
}

/**
 * Pauses the clock while the user is busy outside the app on our behalf (e.g. paying on the
 * Paystack page), so they aren't signed out the moment they come back. Call the returned function
 * when they're back; it counts as activity.
 */
export function holdActivity(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    markActivity();
  };
}

/** Saved when the app goes to the background, so a cold start can tell how long it sat unused. */
export async function persistLastActivity(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, String(holds > 0 ? Date.now() : lastActivityAt)).catch(() => {});
}

/** The last activity saved before the app was closed, or null if none was saved. */
export async function readPersistedLastActivity(): Promise<number | null> {
  const value = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function clearPersistedLastActivity(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
