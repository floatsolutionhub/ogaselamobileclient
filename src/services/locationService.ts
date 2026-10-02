import * as Location from "expo-location";

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

/**
 * Requests foreground location permission, fetches the current position, and
 * best-effort matches it to a state/city in our Nigeria location list.
 * Returns null if permission is denied.
 */
export async function requestAndResolveLocation(): Promise<ResolvedLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const coords: Coordinates = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };

  let address: Location.LocationGeocodedAddress | undefined;
  try {
    [address] = await Location.reverseGeocodeAsync(coords);
  } catch {
    address = undefined;
  }

  const matched = matchNigeriaLocation(address);

  return {
    coords,
    state: matched?.state ?? address?.region ?? nigeriaLocations[0].state,
    city: matched?.city ?? address?.city ?? address?.subregion ?? nigeriaLocations[0].cities[0],
  };
}
