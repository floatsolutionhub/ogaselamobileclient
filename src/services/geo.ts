// Ogasela.Api/Controllers/Geo/GeoController.cs - GET routes only (mutations are staff-only, not relevant to the consumer app). Public reference data - no auth required.
import { api } from "@/lib/apiClient";
import type { NigeriaCity, NigeriaState } from "@/types/api";

export function getStates(): Promise<NigeriaState[]> {
  return api.get<NigeriaState[]>("/geo/states");
}

export function getCitiesByState(stateId: string): Promise<NigeriaCity[]> {
  return api.get<NigeriaCity[]>(`/geo/states/${stateId}/cities`);
}
