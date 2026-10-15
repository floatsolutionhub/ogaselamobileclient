import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Coordinates } from "@/utils/geo";

const STORAGE_KEY = "ogasela_location_v1";

type StoredLocation = {
  city: string;
  state: string;
  coords: Coordinates | null;
  onboarded: boolean;
};

const DEFAULT_LOCATION: StoredLocation = {
  city: "Ikeja",
  state: "Lagos",
  coords: null,
  onboarded: false,
};

/** Shown in the location pill when the user picked "All States In Nigeria". */
export const NATIONWIDE_LABEL = "All of Nigeria";

type LocationContextValue = {
  /** Empty when browsing nationwide. */
  selectedCity: string;
  /** Empty when browsing nationwide. */
  selectedState: string;
  /** True after picking "All States In Nigeria": no city/state filter anywhere. */
  isNationwide: boolean;
  locationLabel: string;
  coords: Coordinates | null;
  isReady: boolean;
  hasOnboarded: boolean;
  setLocation: (
    city: string,
    state: string,
    coords?: Coordinates | null,
  ) => void;
  /** Browse ads from every state - clears the city/state. */
  setNationwide: () => void;
  markOnboardingComplete: () => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(
  undefined,
);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredLocation>(DEFAULT_LOCATION);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw)
          setState({
            ...DEFAULT_LOCATION,
            ...(JSON.parse(raw) as StoredLocation),
          });
      } catch {
        // Unreadable storage - keep the default location rather than crash on launch.
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: StoredLocation) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setLocation = useCallback(
    (
      city: string,
      locationState: string,
      coords: Coordinates | null = null,
    ) => {
      persist({
        city,
        state: locationState,
        coords,
        onboarded: true,
      });
    },
    [persist],
  );

  const setNationwide = useCallback(() => {
    persist({ city: "", state: "", coords: null, onboarded: true });
  }, [persist]);

  const markOnboardingComplete = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, onboarded: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      selectedCity: state.city,
      selectedState: state.state,
      isNationwide: !state.city && !state.state,
      locationLabel:
        !state.city && !state.state
          ? NATIONWIDE_LABEL
          : `${state.city}, ${state.state}`,
      coords: state.coords,
      isReady,
      hasOnboarded: state.onboarded,
      setLocation,
      setNationwide,
      markOnboardingComplete,
    }),
    [state, isReady, setLocation, setNationwide, markOnboardingComplete],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx)
    throw new Error("useLocation must be used within a LocationProvider");
  return ctx;
}
