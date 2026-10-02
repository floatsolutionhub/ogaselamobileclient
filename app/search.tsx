import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Search, SlidersHorizontal, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import {
  countActiveFilters,
  DEFAULT_SEARCH_FILTERS,
  SearchFilterSheet,
  type SearchFilterValues,
} from "@/components/SearchFilterSheet";
import { useLocation } from "@/context/LocationContext";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import * as searchService from "@/services/search";
import { colors } from "@/theme/colors";
import { SearchResultItem } from "@/types/api";
import { formatNaira } from "@/utils/currency";

const PAGE_SIZE = 20;
/** Wait for a pause in typing before searching, instead of one request per keystroke. */
const TYPING_DEBOUNCE_MS = 350;

const SORT_LABELS: Record<SearchFilterValues["sort"], string> = {
  relevance: "Best match",
  newest: "Newest",
  price_asc: "Lowest price",
  price_desc: "Highest price",
  distance: "Nearest",
};

export default function SearchScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { coords } = useLocation();
  const { tree } = useCategoryTree();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(category);
  const [activeSubcategory, setActiveSubcategory] = useState<
    string | undefined
  >();
  const [filters, setFilters] = useState<SearchFilterValues>(
    DEFAULT_SEARCH_FILTERS,
  );
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  // Bumped on every new search so a slow response for an older search can't overwrite newer results.
  const requestId = useRef(0);

  const hasLocation = !!coords;
  const activeFilterCount = countActiveFilters(filters);

  const categoryInfo = useMemo(
    () => tree.find((entry) => entry.id === activeCategory),
    [tree, activeCategory],
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(query.trim()),
      TYPING_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query]);

  const runSearch = useCallback(
    async (pageToLoad: number) => {
      const id = ++requestId.current;
      if (pageToLoad === 1) {
        setLoading(true);
        setError(false);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await searchService.search({
          query: debouncedQuery || undefined,
          categoryId: activeSubcategory ?? activeCategory,
          lat: coords?.latitude,
          lng: coords?.longitude,
          sort:
            filters.sort === "distance" && !coords ? "relevance" : filters.sort,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          condition: filters.condition,
          verifiedSellerOnly: filters.verifiedSellerOnly || undefined,
          radiusKm: coords ? filters.radiusKm : undefined,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });
        if (id !== requestId.current) return;
        setResults((prev) =>
          pageToLoad === 1 ? result.items : [...prev, ...result.items],
        );
        setTotalCount(result.totalCount);
        setPage(pageToLoad);
      } catch {
        if (id !== requestId.current) return;
        if (pageToLoad === 1) {
          setResults([]);
          setTotalCount(0);
          setError(true);
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedQuery, activeCategory, activeSubcategory, coords, filters],
  );

  useEffect(() => {
    runSearch(1);
  }, [runSearch]);

  const loadMore = () => {
    if (loading || loadingMore || results.length >= totalCount) return;
    runSearch(page + 1);
  };

  const clearCategory = () => {
    setActiveCategory(undefined);
    setActiveSubcategory(undefined);
  };

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.sort !== "relevance") {
      chips.push({
        key: "sort",
        label: SORT_LABELS[filters.sort],
        clear: () => setFilters((prev) => ({ ...prev, sort: "relevance" })),
      });
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const label =
        filters.minPrice !== undefined && filters.maxPrice !== undefined
          ? `${formatNaira(filters.minPrice)} – ${formatNaira(filters.maxPrice)}`
          : filters.minPrice !== undefined
            ? `From ${formatNaira(filters.minPrice)}`
            : `Up to ${formatNaira(filters.maxPrice!)}`;
      chips.push({
        key: "price",
        label,
        clear: () =>
          setFilters((prev) => ({
            ...prev,
            minPrice: undefined,
            maxPrice: undefined,
          })),
      });
    }
    if (filters.condition) {
      chips.push({
        key: "condition",
        label: filters.condition,
        clear: () => setFilters((prev) => ({ ...prev, condition: undefined })),
      });
    }
    if (filters.radiusKm !== undefined && hasLocation) {
      chips.push({
        key: "radius",
        label: `Within ${filters.radiusKm} km`,
        clear: () => setFilters((prev) => ({ ...prev, radiusKm: undefined })),
      });
    }
    if (filters.verifiedSellerOnly) {
      chips.push({
        key: "verified",
        label: "Verified sellers",
        clear: () =>
          setFilters((prev) => ({ ...prev, verifiedSellerOnly: false })),
      });
    }
    return chips;
  }, [filters, hasLocation]);

  const header = (
    <View>
      {categoryInfo ? (
        <View className="mt-4 flex-row px-6">
          <View className="flex-row items-center gap-2 rounded-full bg-brand-50 px-4 py-2">
            <Text className="font-poppins-medium text-xs text-brand-700">
              {categoryInfo.name}
            </Text>
            <Pressable onPress={clearCategory} hitSlop={8}>
              <X size={12} color={colors.brand700} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {categoryInfo && categoryInfo.children.length > 0 ? (
        // Spread out in wrapping rows (not a horizontal scroller) so every subcategory is visible at once.
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 24,
            marginTop: 12,
            gap: 8,
          }}
        >
          <Pill
            label="All"
            active={!activeSubcategory}
            onPress={() => setActiveSubcategory(undefined)}
          />
          {categoryInfo.children.map((subcategory) => (
            <Pill
              key={subcategory.id}
              label={subcategory.name}
              active={activeSubcategory === subcategory.id}
              onPress={() => setActiveSubcategory(subcategory.id)}
            />
          ))}
        </View>
      ) : null}

      {activeFilterChips.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 24,
            marginTop: 12,
            gap: 8,
          }}
        >
          {activeFilterChips.map((chip) => (
            <View
              key={chip.key}
              className="flex-row items-center gap-1.5 rounded-full border border-brand-100 bg-white px-3 py-1.5"
            >
              <Text className="font-poppins-medium text-xs text-ink-700">
                {chip.label}
              </Text>
              <Pressable onPress={chip.clear} hitSlop={8}>
                <X size={12} color={colors.ink500} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() => setFilters(DEFAULT_SEARCH_FILTERS)}
            className="justify-center px-1 py-1.5"
          >
            <Text className="font-poppins-medium text-xs text-brand-600">
              Clear all
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error ? (
        <Text className="mt-4 px-6 font-poppins text-xs text-ink-500">
          {totalCount === 1
            ? "1 result"
            : `${totalCount.toLocaleString("en-NG")} results`}
          {debouncedQuery ? ` for "${debouncedQuery}"` : ""}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center gap-3 px-6 pt-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeft size={20} color={colors.ink700} />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-brand-100 bg-surface px-4 py-3">
          <Search size={16} color={colors.ink500} />
          <TextInput
            // Opening a category is for browsing its subcategories - don't cover them with the keyboard.
            autoFocus={!category}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setDebouncedQuery(query.trim())}
            returnKeyType="search"
            autoCorrect={false}
            placeholder="Search Ogasela"
            placeholderTextColor={colors.ink300}
            className="flex-1 font-poppins text-sm text-ink-900"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={16} color={colors.ink500} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setShowFilters(true)}
          hitSlop={8}
          className={`h-11 w-11 items-center justify-center rounded-2xl border ${
            activeFilterCount > 0
              ? "border-brand-600 bg-brand-600"
              : "border-brand-100 bg-surface"
          }`}
        >
          <SlidersHorizontal
            size={18}
            color={activeFilterCount > 0 ? colors.white : colors.ink700}
          />
          {activeFilterCount > 0 ? (
            <View className="absolute -right-1.5 -top-1.5 h-5 min-w-[20px] items-center justify-center rounded-full bg-gold-500 px-1">
              <Text className="font-poppins-semibold text-[10px] text-ink-900">
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <FlatList
        data={loading ? [] : results}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
        contentInsetAdjustmentBehavior="never"
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 4 }}
        renderItem={({ item }) => <ListingCard listing={item} variant="grid" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={colors.brand600}
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={colors.brand600}
              style={{ marginTop: 32 }}
            />
          ) : error ? (
            <View className="mt-10 items-center px-8">
              <Text className="text-center font-poppins text-sm text-ink-500">
                Something went wrong while searching.
              </Text>
              <Pressable
                onPress={() => runSearch(1)}
                className="mt-3 rounded-full bg-brand-50 px-4 py-2"
              >
                <Text className="font-poppins-medium text-xs text-brand-700">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-10 items-center px-8">
              <Text className="text-center font-poppins-medium text-sm text-ink-700">
                No listings match your search.
              </Text>
              {activeFilterCount > 0 ? (
                <Pressable
                  onPress={() => setFilters(DEFAULT_SEARCH_FILTERS)}
                  className="mt-3 rounded-full bg-brand-50 px-4 py-2"
                >
                  <Text className="font-poppins-medium text-xs text-brand-700">
                    Clear filters
                  </Text>
                </Pressable>
              ) : (
                <Text className="mt-1 text-center font-poppins text-xs text-ink-500">
                  Try a different word or check the spelling.
                </Text>
              )}
            </View>
          )
        }
      />

      <SearchFilterSheet
        visible={showFilters}
        value={filters}
        hasLocation={hasLocation}
        onClose={() => setShowFilters(false)}
        onApply={(next) => {
          setFilters(next);
          setShowFilters(false);
        }}
      />
    </SafeAreaView>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-1.5 ${
        active ? "border-brand-600 bg-brand-600" : "border-brand-100 bg-white"
      }`}
    >
      <Text
        className={`font-poppins-medium text-xs ${active ? "text-white" : "text-ink-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
