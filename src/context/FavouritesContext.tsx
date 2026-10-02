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
      const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
      if (raw) setFavouriteIds(JSON.parse(raw) as string[]);
    })();
  }, []);

  const toggleFavourite = useCallback((listingId: string) => {
    setFavouriteIds((prev) => {
      const adding = !prev.includes(listingId);
      const next = adding
        ? [...prev, listingId]
        : prev.filter((id) => id !== listingId);
      // Saves feed the seller's analytics (favourites themselves live only on this device).
      if (adding) recordEngagement(listingId, "Save");
      AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next)).catch(
        () => {},
      );
      return next;
    });
  }, []);

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
