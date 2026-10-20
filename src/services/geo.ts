// Ogasela.Api/Controllers/Geo/GeoController.cs - GET routes only (mutations are staff-only, not relevant to the consumer app). Public reference data - no auth required.
import { api } from "@/lib/apiClient";
import type { NearestCity, NigeriaCity, NigeriaState } from "@/types/api";

export function getStates(): Promise<NigeriaState[]> {
  return api.get<NigeriaState[]>("/geo/states");
}

/**
 * The city closest to a position - 404 (Geo.NoCityNearby) when none is within reach. `state` is
 * the state the phone says it's in, so a city just across a border isn't picked instead.
 */
export function getNearestCity(latitude: number, longitude: number, state?: string | null): Promise<NearestCity> {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  if (state) query.set("state", state);
  return api.get<NearestCity>(`/geo/cities/nearest?${query}`);
}

export function getCitiesByState(stateId: string): Promise<NigeriaCity[]> {
  return api.get<NigeriaCity[]>(`/geo/states/${stateId}/cities`);
}
