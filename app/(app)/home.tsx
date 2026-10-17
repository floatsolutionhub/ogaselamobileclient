import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowDownWideNarrow,
  ChevronDown,
  MapPin,
  PackageOpen,
  Search,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AnnouncementModal } from "@/components/AnnouncementModal";
import { CategoryCard } from "@/components/CategoryCard";
import { CategoryFilterSheet } from "@/components/CategoryFilterSheet";
import { GradientScreen } from "@/components/GradientScreen";
import { ListingCard } from "@/components/ListingCard";
import { NotificationBell } from "@/components/NotificationBell";
import { SupportFab } from "@/components/SupportFab";
import { VerificationBadge } from "@/components/VerificationBadge";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import { useVerificationOverview } from "@/hooks/useVerificationOverview";
import * as listingsService from "@/services/listings";
import { colors, gradients } from "@/theme/colors";
import type { SearchResultItem } from "@/types/api";
import { ICON } from "@/theme/typography";

const HOT_PICKS_PAGE_SIZE = 10;
const LOAD_MORE_THRESHOLD = 600;

const newSeed = () => Math.floor(Math.random() * 1_000_000_000);

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

const CATEGORY_COLUMNS = 4;
const CATEGORY_GAP = 14;
const SCREEN_GUTTER = 24;

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const categoryCardWidth = Math.floor(
    (screenWidth - SCREEN_GUTTER * 2 - CATEGORY_GAP * (CATEGORY_COLUMNS - 1)) /
      CATEGORY_COLUMNS,
  );
  const { locationLabel, selectedCity, isReady, hasOnboarded } = useLocation();
  const { isAuthenticated } = useAuth();
  const { overview: verification, refresh: refreshVerification } =
    useVerificationOverview();
  const showPersonalBadge =
    !!verification && verification.personal.status !== "Verified";
  const showBusinessBadge =
    !!verification?.business && verification.business.status !== "Verified";

  // The compact top bar fades in once the hero (location pill + green search card) has scrolled
  // fully out of view, and out again when it's back.
  const [heroBottom, setHeroBottom] = useState(0);
  const [showTopBar, setShowTopBar] = useState(false);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [hotSectionY, setHotSectionY] = useState(0);
  const [pinHotHeader, setPinHotHeader] = useState(false);
  const topBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(topBarAnim, {
      toValue: showTopBar ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showTopBar, topBarAnim]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const pastHero = heroBottom > 0 && contentOffset.y >= heroBottom;
    if (pastHero !== showTopBar) setShowTopBar(pastHero);

    // Pin the Hot Picks title row once it reaches the bottom of the top bar.
    const pastHotHeader =
      hotSectionY > 0 && contentOffset.y + topBarHeight >= hotSectionY;
    if (pastHotHeader !== pinHotHeader) setPinHotHeader(pastHotHeader);

    // Fetch the next page of Hot Picks a little before the bottom is reached.
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - LOAD_MORE_THRESHOLD
    ) {
      loadMoreHotPicks();
    }
  };
  const {
    tree,
    isLoading: categoriesLoading,
    refresh: refreshCategories,
  } = useCategoryTree();

  // Hot Picks: up to 50 ads, PAGE_SIZE at a time as the user scrolls. The seed keeps the shuffled
  // order stable while paging; pulling to refresh picks a new seed for a fresh mix.
  const [hotSeed, setHotSeed] = useState(newSeed);
  const [hotCategoryId, setHotCategoryId] = useState<string | undefined>();
  // Hot Picks come from the picked city; "Show all" widens to every location until the city changes.
  const [showAllLocations, setShowAllLocations] = useState(false);
  useEffect(() => setShowAllLocations(false), [selectedCity]);
  const hotLocation = showAllLocations ? undefined : selectedCity || undefined;
  const [hotPicks, setHotPicks] = useState<SearchResultItem[]>([]);
  const [hotTotal, setHotTotal] = useState(0);
  const [hotPage, setHotPage] = useState(1);
  const [hotLoading, setHotLoading] = useState(true);
  const [hotLoadingMore, setHotLoadingMore] = useState(false);
  const [hotError, setHotError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Categories and verification statuses refresh alongside Hot Picks; the spinner waits for all.
  const [refreshingOthers, setRefreshingOthers] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const hotRequestId = useRef(0);

  useEffect(() => {
    if (isReady && !hasOnboarded) {
      router.push("/(modals)/location-permission");
    }
  }, [isReady, hasOnboarded, router]);

  const loadHotPicks = useCallback(
    async (page: number) => {
      const id = ++hotRequestId.current;
      if (page === 1) {
        setHotLoading(true);
        setHotError(false);
      } else {
        setHotLoadingMore(true);
      }
      try {
        const result = await listingsService.getHotPicks({
          categoryId: hotCategoryId,
          location: hotLocation,
          page,
          pageSize: HOT_PICKS_PAGE_SIZE,
          seed: hotSeed,
        });
        if (id !== hotRequestId.current) return;
        setHotPicks((prev) =>
          page === 1 ? result.items : [...prev, ...result.items],
        );
        setHotTotal(result.totalCount);
        setHotPage(page);
      } catch {
        if (id === hotRequestId.current && page === 1) {
          setHotPicks([]);
          setHotTotal(0);
          setHotError(true);
        }
      } finally {
        if (id === hotRequestId.current) {
          setHotLoading(false);
          setHotLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [hotCategoryId, hotLocation, hotSeed],
  );

  useEffect(() => {
    loadHotPicks(1);
  }, [loadHotPicks]);

  const loadMoreHotPicks = () => {
    if (hotLoading || hotLoadingMore || hotError || hotPicks.length >= hotTotal)
      return;
    loadHotPicks(hotPage + 1);
  };

  const selectedCategoryName = useMemo(() => {
    if (!hotCategoryId) return null;
    for (const category of tree) {
      if (category.id === hotCategoryId) return category.name;
      const child = category.children.find((c) => c.id === hotCategoryId);
      if (child) return child.name;
    }
    return null;
  }, [hotCategoryId, tree]);

  // The Hot Picks title row: rendered in the feed, and again pinned under the top bar once the
  // user scrolls past it, so the sort button is always one tap away.
  const renderHotPicksHeader = () => (
    <>
      <View className="flex-1 flex-row items-center gap-2">
        <Text className="font-poppins-semibold text-title text-ink-900">
          Hot Picks
        </Text>
        {selectedCategoryName ? (
          <View className="flex-shrink flex-row items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-2">
            <Text
              className="flex-shrink font-poppins-medium text-caption text-brand-700"
              numberOfLines={1}
            >
              {selectedCategoryName}
            </Text>
            <Pressable
              onPress={() => setHotCategoryId(undefined)}
              hitSlop={8}
              accessibilityLabel="Show all categories"
            >
              <X size={ICON.xs} color={colors.brand700} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={() => setShowCategorySheet(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Choose a category for Hot Picks"
        className={`h-10 w-10 items-center justify-center rounded-full border ${
          hotCategoryId
            ? "border-brand-600 bg-brand-600"
            : "border-brand-100 bg-white"
        }`}
      >
        <ArrowDownWideNarrow
          size={ICON.md}
          color={hotCategoryId ? colors.white : colors.ink700}
        />
      </Pressable>
    </>
  );

  return (
    // No bottom safe-area edge: the tab bar already pads for the home indicator, so the feed runs
    // straight down to it instead of stopping short.
    <GradientScreen scroll={false} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || refreshingOthers}
            onRefresh={() => {
              setRefreshing(true);
              setHotSeed(newSeed());
              setRefreshingOthers(true);
              Promise.all([refreshCategories(), refreshVerification()]).finally(
                () => setRefreshingOthers(false),
              );
            }}
            tintColor={colors.brand600}
          />
        }
      >
        <View
          className="px-6 pt-4"
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setHeroBottom(y + height);
          }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <Pressable
              onPress={() => router.push("/(modals)/location-picker")}
              className="flex-shrink flex-row items-center gap-1.5 rounded-full border border-brand-100 bg-white px-3 py-1.5"
            >
              <MapPin size={ICON.sm} color={colors.brand600} />
              <Text className="font-poppins-medium text-caption text-ink-900">
                {locationLabel}
              </Text>
              <ChevronDown size={ICON.sm} color={colors.ink500} />
            </Pressable>
            {isAuthenticated ? <NotificationBell /> : null}
          </View>

          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="mt-4 rounded-3xl p-6 pb-8"
          >
            <Text className="font-poppins-bold text-display text-white">
              What do you need?
            </Text>
            <Text className="mt-1 font-poppins text-body text-white/80">
              Find anything, from anyone, near you.
            </Text>

            <Pressable
              onPress={() => router.push("/search")}
              className="mt-5 flex-row items-center gap-2 rounded-2xl bg-white px-4 py-3.5"
            >
              <Search size={ICON.md} color={colors.ink500} />
              <Text className="font-poppins text-body text-ink-500">
                Search Ogasela
              </Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* Shown until each track is verified, so users can see what's left at a glance. */}
        {showPersonalBadge || showBusinessBadge ? (
          <View className="mx-6 mt-6 gap-3">
            {showPersonalBadge && verification ? (
              <VerificationBadge kind="personal" track={verification.personal} />
            ) : null}
            {showBusinessBadge && verification?.business ? (
              <VerificationBadge kind="business" track={verification.business} />
            ) : null}
          </View>
        ) : null}

        <View className="mt-6">
          <Text className="mb-3 px-6 font-poppins-semibold text-subtitle text-ink-900">
            Categories
          </Text>
          {categoriesLoading ? (
            <ActivityIndicator
              color={colors.brand600}
              style={{ marginTop: 8 }}
            />
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                paddingHorizontal: SCREEN_GUTTER,
                paddingBottom: 8,
                columnGap: CATEGORY_GAP,
                rowGap: CATEGORY_GAP + 4,
              }}
            >
              {tree.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  width={categoryCardWidth}
                  onPress={() =>
                    router.push({
                      pathname: "/search",
                      params: { category: category.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>

        <View
          className="mt-8 px-6"
          onLayout={(event) => setHotSectionY(event.nativeEvent.layout.y)}
        >
          <View className="mb-3 flex-row items-center justify-between">
            {renderHotPicksHeader()}
          </View>

          {hotLoading ? (
            <ActivityIndicator
              color={colors.brand600}
              style={{ marginTop: 24 }}
            />
          ) : hotError ? (
            <View className="items-center rounded-2xl border border-brand-50 bg-white px-4 py-6">
              <Text className="font-poppins text-body text-ink-500">
                Couldn’t load Hot Picks.
              </Text>
              <Pressable
                onPress={() => loadHotPicks(1)}
                className="mt-3 rounded-full bg-brand-50 px-4 py-2"
              >
                <Text className="font-poppins-medium text-caption text-brand-700">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : hotPicks.length === 0 ? (
            <View className="items-center rounded-2xl border border-brand-50 bg-white px-4 py-6">
              <PackageOpen size={ICON.lg} color={colors.ink300} />
              <Text className="mt-2 text-center font-poppins-medium text-body text-ink-500">
                {hotLocation ? `No hot picks in ${hotLocation} yet` : "No data"}
              </Text>
              {hotLocation ? (
                <Pressable
                  onPress={() => setShowAllLocations(true)}
                  accessibilityRole="button"
                  className="mt-4 rounded-2xl bg-brand-600 px-6 py-3 active:opacity-90"
                >
                  <Text className="font-poppins-semibold text-body text-white">
                    Show all
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <>
              {showAllLocations && selectedCity ? (
                <View className="mb-3 flex-row items-center justify-between rounded-xl bg-brand-50 px-3 py-2">
                  <Text className="flex-1 font-poppins text-caption text-brand-700">
                    Showing ads from all locations
                  </Text>
                  <Pressable
                    onPress={() => setShowAllLocations(false)}
                    hitSlop={8}
                  >
                    <Text className="font-poppins-semibold text-caption text-brand-700">
                      Only {selectedCity}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={{ gap: 12 }}>
                {chunkPairs(hotPicks).map((pair) => (
                  <View
                    key={pair[0].id}
                    className="flex-row"
                    style={{ gap: 12 }}
                  >
                    {pair.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        variant="grid"
                      />
                    ))}
                    {pair.length === 1 ? <View className="flex-1" /> : null}
                  </View>
                ))}
                {hotLoadingMore ? (
                  <ActivityIndicator
                    color={colors.brand600}
                    style={{ marginVertical: 12 }}
                  />
                ) : hotPicks.length >= hotTotal ? (
                  <Text className="mt-2 text-center font-poppins text-caption text-ink-300">
                    You’re all caught up · pull down for a fresh mix
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Animated.View
        onLayout={(event) => setTopBarHeight(event.nativeEvent.layout.height)}
        pointerEvents={showTopBar ? "auto" : "none"}
        className="absolute left-0 right-0 top-0 flex-row items-center gap-2 border-b border-brand-50 bg-white px-4 py-2.5"
        style={{
          opacity: topBarAnim,
          transform: [
            {
              translateY: topBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
          shadowColor: colors.ink900,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Pressable
          onPress={() => router.push("/(modals)/location-picker")}
          accessibilityRole="button"
          accessibilityLabel={`Location: ${locationLabel}. Change location`}
          className="max-w-[40%] flex-row items-center gap-1 rounded-full border border-brand-100 bg-white px-3 py-2"
        >
          <MapPin size={ICON.sm} color={colors.brand600} />
          <Text
            className="flex-shrink font-poppins-medium text-caption text-ink-900"
            numberOfLines={1}
          >
            {locationLabel}
          </Text>
          <ChevronDown size={ICON.sm} color={colors.ink500} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/search")}
          accessibilityRole="search"
          className="flex-1 flex-row items-center gap-2 rounded-2xl border border-brand-100 bg-surface px-3.5 py-2.5"
        >
          <Search size={ICON.sm} color={colors.ink500} />
          <Text className="font-poppins text-body text-ink-500" numberOfLines={1}>
            Search Ogasela
          </Text>
        </Pressable>
      </Animated.View>

      {pinHotHeader ? (
        <View
          className="absolute left-0 right-0 flex-row items-center justify-between border-b border-brand-50 bg-white px-6 py-2.5"
          style={{ top: topBarHeight }}
        >
          {renderHotPicksHeader()}
        </View>
      ) : null}

      {isAuthenticated ? <SupportFab /> : null}

      <CategoryFilterSheet
        visible={showCategorySheet}
        tree={tree}
        selectedId={hotCategoryId}
        onSelect={setHotCategoryId}
        onClose={() => setShowCategorySheet(false)}
      />

      {/* Held back until the first-run location prompt is out of the way. */}
      <AnnouncementModal enabled={isReady && hasOnboarded} />
    </GradientScreen>
  );
}
