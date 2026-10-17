import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronLeft, Globe, MapPin, Search } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocation } from "@/context/LocationContext";
import * as geoService from "@/services/geo";
import { colors } from "@/theme/colors";
import { NigeriaCity, NigeriaState } from "@/types/api";
import { ICON } from "@/theme/typography";

export default function LocationPickerSheet() {
  // Keep the last rows clear of Android's navigation buttons (see SheetScreen).
  const { bottom } = useSafeAreaInsets();
  const bottomInset = Platform.OS === "android" ? bottom : 0;
  const {
    selectedCity,
    selectedState,
    isNationwide,
    setLocation,
    setNationwide,
  } = useLocation();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const [query, setQuery] = useState("");

  const [states, setStates] = useState<NigeriaState[]>([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [cities, setCities] = useState<NigeriaCity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  useEffect(() => {
    setQuery("");
  }, [state]);

  useEffect(() => {
    let active = true;
    geoService
      .getStates()
      .then((data) => {
        if (active) setStates(data);
      })
      .catch(() => {
        if (active) setStates([]);
      })
      .finally(() => {
        if (active) setStatesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeState = useMemo(
    () => states.find((entry) => entry.name === state),
    [states, state],
  );

  useEffect(() => {
    if (!activeState) {
      setCities([]);
      return;
    }
    let active = true;
    setCitiesLoading(true);
    geoService
      .getCitiesByState(activeState.id)
      .then((data) => {
        if (active) setCities(data);
      })
      .catch(() => {
        if (active) setCities([]);
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeState]);

  const stateResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return states;
    return states.filter((entry) =>
      entry.name.toLowerCase().includes(normalized),
    );
  }, [states, query]);

  const cityResults = useMemo(() => {
    if (!activeState) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cities;
    return cities.filter((city) =>
      city.name.toLowerCase().includes(normalized),
    );
  }, [activeState, cities, query]);

  return (
    <ScrollView
      className="flex-1 bg-white px-6"
      contentContainerStyle={{ paddingBottom: 24 + bottomInset }}
      // Lets the Android form sheet hand drags to this list (see SheetScreen).
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={false}
    >
      <View className="bg-white pb-3 pt-4">
        <View className="flex-row items-center gap-2">
          {activeState ? (
            <Pressable
              onPress={() => router.replace("/(modals)/location-picker")}
              hitSlop={12}
              className="h-8 w-8 items-center justify-center rounded-full bg-surface"
            >
              <ChevronLeft size={ICON.md} color={colors.ink700} />
            </Pressable>
          ) : null}
          <Text className="font-poppins-bold text-title text-ink-900">
            {activeState
              ? `Choose a city in ${activeState.name}`
              : "Choose a state"}
          </Text>
        </View>

        <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-brand-100 bg-surface px-4 py-3">
          <Search size={ICON.sm} color={colors.ink500} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={activeState ? "Search city" : "Search state"}
            placeholderTextColor={colors.ink300}
            className="flex-1 font-poppins text-body text-ink-900"
          />
        </View>
      </View>

      {(activeState ? citiesLoading : statesLoading) ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 24 }} />
      ) : (
        <>
          {activeState
            ? cityResults.length === 0 && (
                <Text className="mt-8 text-center font-poppins text-body text-ink-500">
                  No cities match “{query}”
                </Text>
              )
            : stateResults.length === 0 &&
              !"all states in nigeria".includes(query.trim().toLowerCase()) && (
                <Text className="mt-8 text-center font-poppins text-body text-ink-500">
                  No states match “{query}”
                </Text>
              )}

          {activeState
            ? cityResults.map((city) => {
                const active =
                  city.name === selectedCity &&
                  activeState.name === selectedState;
                return (
                  <Pressable
                    key={city.id}
                    onPress={() => {
                      setLocation(city.name, activeState.name);
                      router.back();
                    }}
                    className="flex-row items-center justify-between border-b border-brand-50 py-4"
                  >
                    <View className="flex-row items-center gap-3">
                      <MapPin
                        size={ICON.sm}
                        color={active ? colors.brand600 : colors.ink300}
                      />
                      <Text
                        className={`font-poppins-medium text-body ${
                          active ? "text-brand-600" : "text-ink-900"
                        }`}
                      >
                        {city.name}
                      </Text>
                    </View>
                    {active ? (
                      <Check size={ICON.sm} color={colors.brand600} />
                    ) : null}
                  </Pressable>
                );
              })
            : null}

          {!activeState &&
          (!query.trim() ||
            "all states in nigeria".includes(query.trim().toLowerCase())) ? (
            <Pressable
              onPress={() => {
                setNationwide();
                router.back();
              }}
              accessibilityRole="button"
              className="flex-row items-center justify-between border-b border-brand-50 py-4"
            >
              <View className="flex-row items-center gap-3">
                <Globe
                  size={ICON.sm}
                  color={isNationwide ? colors.brand600 : colors.ink300}
                />
                <View>
                  <Text
                    className={`font-poppins-semibold text-body ${isNationwide ? "text-brand-600" : "text-ink-900"}`}
                  >
                    All States In Nigeria
                  </Text>
                  <Text className="font-poppins text-caption text-ink-500">
                    See ads from across the country
                  </Text>
                </View>
              </View>
              {isNationwide ? (
                <Check size={ICON.sm} color={colors.brand600} />
              ) : null}
            </Pressable>
          ) : null}

          {!activeState
            ? stateResults.map((entry) => {
                const active = entry.name === selectedState;
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() =>
                      router.replace({
                        pathname: "/(modals)/location-picker",
                        params: { state: entry.name },
                      })
                    }
                    className="flex-row items-center justify-between border-b border-brand-50 py-4"
                  >
                    <View className="flex-row items-center gap-3">
                      <MapPin
                        size={ICON.sm}
                        color={active ? colors.brand600 : colors.ink300}
                      />
                      <Text
                        className={`font-poppins-medium text-body ${
                          active ? "text-brand-600" : "text-ink-900"
                        }`}
                      >
                        {entry.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            : null}
        </>
      )}
    </ScrollView>
  );
}
