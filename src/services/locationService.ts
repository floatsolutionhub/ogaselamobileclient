import * as Location from "expo-location";
import { Platform } from "react-native";

import { nigeriaLocations } from "@/data/locations";
import { Coordinates } from "@/utils/geo";

export type ResolvedLocation = {
  city: string;
  state: string;
  coords: Coordinates;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function fuzzyEquals(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na.length > 0 && nb.length > 0 && (na === nb || na.includes(nb) || nb.includes(na));
}

function matchNigeriaLocation(
  address: Location.LocationGeocodedAddress | undefined
): { city: string; state: string } | null {
  if (!address) return null;

  const cityCandidates = [address.city, address.subregion, address.district].filter(
    (value): value is string => !!value
  );

  const stateEntry =
    (address.region &&
      nigeriaLocations.find((entry) => fuzzyEquals(entry.state, address.region!))) ||
    nigeriaLocations.find((entry) =>
      entry.cities.some((city) => cityCandidates.some((candidate) => fuzzyEquals(city, candidate)))
    );

  if (!stateEntry) return null;

  const cityMatch = stateEntry.cities.find((city) =>
    cityCandidates.some((candidate) => fuzzyEquals(city, candidate))
  );

  return { state: stateEntry.state, city: cityMatch ?? stateEntry.cities[0] };
}

/** Why the device's location couldn't be used - each needs a different way out for the user. */
export type LocationFailure =
  /** They said no this time - asking again is still possible. */
  | "denied"
  /** Denied before and the OS won't show the prompt again - only the app's Settings page can change it. */
  | "blocked"
  /** Permission is fine but Location/GPS is switched off on the phone. */
  | "servicesOff"
  /** Location is on, but no position came back in time (indoors, no recent fix). */
  | "unavailable";

export type LocationResult = { ok: true; location: ResolvedLocation } | { ok: false; reason: LocationFailure };

export type CoordinatesResult = { ok: true; coords: Coordinates } | { ok: false; reason: LocationFailure };

/** What to tell the user for each failure. */
export const LOCATION_FAILURE_MESSAGE: Record<LocationFailure, { title: string; body: string }> = {
  denied: {
    title: "Location access not granted",
    body: "Tap Allow when asked, or choose your area manually.",
  },
  blocked: {
    title: "Location access is turned off for Ogasela",
    body: "Open Settings, allow Location for Ogasela, then come back and try again.",
  },
  servicesOff: {
    title: "Your phone's location is switched off",
    body:
      Platform.OS === "ios"
        ? "Turn on Settings > Privacy & Security > Location Services, then try again."
        : "Turn on Location from your quick settings (swipe down from the top), then try again.",
  },
  unavailable: {
    title: "Couldn't find your location",
    body: "We couldn't get a signal. Move near a window or try again, or choose your area manually.",
  },
};

/** How long to wait for a fresh position before falling back to the last known one. */
const POSITION_TIMEOUT_MS = 15_000;
/** A last known position up to this old is still good enough to pick the user's area. */
const LAST_KNOWN_MAX_AGE_MS = 30 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Location request timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function ensurePermission(): Promise<LocationFailure | null> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status === Location.PermissionStatus.GRANTED) return null;
  return permission.canAskAgain ? "denied" : "blocked";
}

async function ensureServicesEnabled(): Promise<boolean> {
  if (await Location.hasServicesEnabledAsync()) return true;
  if (Platform.OS === "android") {
    // Shows Google's "Turn on location" dialog - rejects if the user says no.
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      return false;
    }
    return Location.hasServicesEnabledAsync();
  }
  return false;
}

/** A fresh fix if one comes back in time, otherwise a recent cached one. */
async function currentPosition(): Promise<Location.LocationObject | null> {
  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      POSITION_TIMEOUT_MS
    );
  } catch {
    return Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
  }
}

/**
 * Asks for foreground location permission (only if the OS will still show the prompt), makes sure
 * location is switched on (offering Android's turn-on dialog), and gets a position.
 */
export async function requestDeviceCoordinates(): Promise<CoordinatesResult> {
  const permissionFailure = await ensurePermission();
  if (permissionFailure) return { ok: false, reason: permissionFailure };

  if (!(await ensureServicesEnabled())) return { ok: false, reason: "servicesOff" };

  const position = await currentPosition();
  if (!position) return { ok: false, reason: "unavailable" };

  return { ok: true, coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
}

/** The state the phone's own geocoder puts a position in (e.g. "Lagos"), or null if it can't say. */
export async function deviceRegion(coords: Coordinates): Promise<string | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync(coords);
    return address?.region ?? null;
  } catch {
    return null;
  }
}

/**
 * The device's position (see requestDeviceCoordinates), best-effort matched to a state/city in our
 * Nigeria location list.
 */
export async function requestAndResolveLocation(): Promise<LocationResult> {
  const device = await requestDeviceCoordinates();
  if (!device.ok) return device;
  const { coords } = device;

  let address: Location.LocationGeocodedAddress | undefined;
  try {
    [address] = await Location.reverseGeocodeAsync(coords);
  } catch {
    address = undefined;
  }

  const matched = matchNigeriaLocation(address);

  return {
    ok: true,
    location: {
      coords,
      state: matched?.state ?? address?.region ?? nigeriaLocations[0].state,
      city: matched?.city ?? address?.city ?? address?.subregion ?? nigeriaLocations[0].cities[0],
    },
  };
}
