import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { recordEngagement } from "@/services/analytics";

const FAVOURITES_KEY = "ogasela_favourites_v1";

type FavouritesContextValue = {
  favouriteIds: string[];
  isFavourite: (listingId: string) => boolean;
  toggleFavourite: (listingId: string) => void;
};

const FavouritesContext = createContext<FavouritesContextValue | undefined>(
  undefined,
);

export function FavouritesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) setFavouriteIds(parsed as string[]);
      } catch {
        // Unreadable storage - start with no favourites rather than crash on launch.
      }
    })();
  }, []);

  const toggleFavourite = useCallback(
    (listingId: string) => {
      const adding = !favouriteIds.includes(listingId);
      const next = adding
        ? [...favouriteIds, listingId]
        : favouriteIds.filter((id) => id !== listingId);
      setFavouriteIds(next);
      AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next)).catch(
        () => {},
      );
      // Saves feed the seller's analytics (favourites themselves live only on this device).
      // Outside the state update: React may run an updater twice, which would record it twice.
      if (adding) recordEngagement(listingId, "Save");
    },
    [favouriteIds],
  );

  const isFavourite = useCallback(
    (listingId: string) => favouriteIds.includes(listingId),
    [favouriteIds],
  );

  const value = useMemo<FavouritesContextValue>(
    () => ({ favouriteIds, isFavourite, toggleFavourite }),
    [favouriteIds, isFavourite, toggleFavourite],
  );

  return (
    <FavouritesContext.Provider value={value}>
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites(): FavouritesContextValue {
  const ctx = useContext(FavouritesContext);
  if (!ctx)
    throw new Error("useFavourites must be used within a FavouritesProvider");
  return ctx;
}
