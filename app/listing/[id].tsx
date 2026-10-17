import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageOff,
  MapPin,
  ExternalLink,
  MessageCircle,
  PackageCheck,
  Phone,
  ReceiptText,
  Star,
  Store,
  Flag,
  UserX,
  Scale,
} from "lucide-react-native";
import moment from "moment";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ListingCard } from "@/components/ListingCard";
import { OfficePickupSheet } from "@/components/OfficePickupSheet";
import { ReportSheet } from "@/components/ReportSheet";
import { VerifiedBusinessPill } from "@/components/VerifiedBusinessPill";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import { ApiError } from "@/lib/apiClient";
import { recordEngagement } from "@/services/analytics";
import * as listingsService from "@/services/listings";
import * as messagingService from "@/services/messaging";
import * as reviewsService from "@/services/reviews";
import * as searchService from "@/services/search";
import { colors } from "@/theme/colors";
import { SOCIAL_PLATFORMS, youTubeVideoId } from "@/utils/socialLinks";
import type {
  ListingDetail,
  PagedReviews,
  SearchResultItem,
} from "@/types/api";
import { formatNaira } from "@/utils/currency";
import { toCardItem } from "@/utils/listingCard";
import { ICON } from "@/theme/typography";

const GALLERY_HEIGHT = 320;

const AD_REPORT_REASONS = [
  "Scam or fraud",
  "Prohibited or illegal item",
  "Wrong category",
  "Item already sold",
  "Misleading price or description",
  "Duplicate ad",
  "Other",
];

const SELLER_REPORT_REASONS = [
  "Scammer or fraudulent seller",
  "Asked for payment outside Ogasela",
  "Abusive or offensive behaviour",
  "Fake business or identity",
  "Didn't deliver after payment",
  "Other",
];
const RAIL_SIZE = 10;

export default function ListingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const { isFavourite, toggleFavourite } = useFavourites();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sellerAds, setSellerAds] = useState<SearchResultItem[]>([]);
  const [reviews, setReviews] = useState<PagedReviews | null>(null);
  const [similarAds, setSimilarAds] = useState<SearchResultItem[]>([]);
  const [startingChat, setStartingChat] = useState(false);
  const [reporting, setReporting] = useState<"ad" | "seller" | null>(null);
  const [officePickupOpen, setOfficePickupOpen] = useState(false);

  // Re-fetched when auth changes: the seller's phone is only returned to signed-in callers.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    listingsService
      .getDetail(id)
      .then((detail) => {
        if (active) setListing(detail);
      })
      .catch((err) => {
        if (active) {
          setLoadError(
            err instanceof ApiError ? err.message : "Could not load this ad.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isAuthenticated]);

  const sellerProfileId = listing?.seller.sellerProfileId;
  const categoryId = listing?.categoryId;
  const parentCategoryId = listing?.parentCategoryId;

  useEffect(() => {
    if (!sellerProfileId) return;
    let active = true;

    listingsService
      .getSellerListings(sellerProfileId, 1, RAIL_SIZE + 1)
      .then((page) => {
        if (!active) return;
        setSellerAds(
          page.items
            .filter(
              (item) =>
                item.id !== id &&
                (item.status === "Active" || item.status === "ExpiringSoon"),
            )
            .slice(0, RAIL_SIZE)
            .map(toCardItem),
        );
      })
      .catch(() => {
        if (active) setSellerAds([]);
      });

    reviewsService
      .getSellerReviews(sellerProfileId, 1, 5)
      .then((page) => {
        if (active) setReviews(page);
      })
      .catch(() => {
        if (active) setReviews(null);
      });

    return () => {
      active = false;
    };
  }, [sellerProfileId, id]);

  // Same subcategory first; if that doesn't fill the rail with other sellers' ads, top up
  // from the wider parent category (searching a parent includes all its subcategories).
  useEffect(() => {
    if (!categoryId || !sellerProfileId) return;
    let active = true;

    const othersOnly = (items: SearchResultItem[]) =>
      items.filter(
        (item) => item.sellerId !== sellerProfileId && item.id !== id,
      );

    (async () => {
      const sameSubcategory = othersOnly(
        (await searchService.search({ categoryId, pageSize: RAIL_SIZE * 2 }))
          .items,
      );
      let combined = sameSubcategory;
      if (combined.length < RAIL_SIZE && parentCategoryId) {
        const seen = new Set(combined.map((item) => item.id));
        const wider = othersOnly(
          (
            await searchService.search({
              categoryId: parentCategoryId,
              pageSize: RAIL_SIZE * 2,
            })
          ).items,
        ).filter((item) => !seen.has(item.id));
        combined = [...combined, ...wider];
      }
      if (active) setSimilarAds(combined.slice(0, RAIL_SIZE));
    })().catch(() => {
      if (active) setSimilarAds([]);
    });

    return () => {
      active = false;
    };
  }, [categoryId, parentCategoryId, sellerProfileId, id]);

  const requireSignIn = () =>
    router.push({
      pathname: "/(modals)/sign-in",
      params: { redirect: `/listing/${id}` },
    });

  const handleMessage = async () => {
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    if (!listing) return;
    setStartingChat(true);
    try {
      const conversation = await messagingService.startConversation(listing.id);
      router.push({
        pathname: "/(modals)/conversation",
        params: { conversationId: conversation.id, title: listing.title, listingId: listing.id },
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't start a chat",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setStartingChat(false);
    }
  };

  const handleCall = () => {
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    const phone = listing?.seller.phone;
    if (listing) recordEngagement(listing.id, "CallClick");
    if (!phone) {
      Toast.show({
        type: "info",
        text1: "This seller hasn't shared a phone number",
      });
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() =>
      Toast.show({ type: "error", text1: "Couldn't open the phone app" }),
    );
  };

  const handleOfficePickup = () => {
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    setOfficePickupOpen(true);
  };

  const openReport = (target: "ad" | "seller") => {
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    setReporting(target);
  };

  const submitReport = async (reason: string) => {
    if (!listing || !reporting) return;
    try {
      if (reporting === "ad") {
        await listingsService.reportListing(listing.id, reason);
      } else {
        await messagingService.reportUser(listing.seller.userId, reason);
      }
      setReporting(null);
      Toast.show({
        type: "success",
        text1: "Report sent",
        text2: "Thanks - our moderators will review it.",
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't send your report",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
      throw err;
    }
  };

  const handleFavourite = () => {
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    if (listing) toggleFavourite(listing.id);
  };

  if (loading && !listing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.brand600} />
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-poppins-medium text-body text-ink-500">
            {loadError ?? "This ad is no longer available."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnListing = user?.id === listing.seller.userId;
  const favourited = isFavourite(listing.id);
  const storeAddress = listing.seller.storeAddress ?? listing.location;
  // A YouTube video plays right on the ad; any other link opens in its app (or the browser).
  const videoId = listing.youTubeUrl ? youTubeVideoId(listing.youTubeUrl) : null;
  const linkByPlatform = {
    youtube: videoId ? null : listing.youTubeUrl,
    tiktok: listing.tikTokUrl,
    instagram: listing.instagramUrl,
    facebook: listing.facebookUrl,
  };
  const socialLinks = SOCIAL_PLATFORMS.flatMap((platform) => {
    const url = linkByPlatform[platform.key];
    return url ? [{ ...platform, url }] : [];
  });

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View>
          <Gallery urls={listing.mediaUrls} />
          <SafeAreaView
            edges={["top"]}
            className="absolute left-0 right-0 top-0 flex-row justify-between px-4"
            pointerEvents="box-none"
          >
            <BackButton onPress={() => router.back()} />
            <Pressable
              onPress={handleFavourite}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
            >
              <Heart
                size={ICON.md}
                color={favourited ? colors.danger : colors.ink700}
                fill={favourited ? colors.danger : "transparent"}
              />
            </Pressable>
          </SafeAreaView>
        </View>

        <View className="px-6 pt-5">
          <Text className="font-poppins-semibold text-heading text-ink-900">
            {listing.title}
          </Text>
          <Text className="mt-2 font-poppins-bold text-display text-brand-700">
            {listing.price !== null
              ? formatNaira(listing.price)
              : "Price on request"}
          </Text>
          <View className="mt-2 flex-row items-center gap-1">
            <MapPin size={ICON.xs} color={colors.ink300} />
            <Text
              className="font-poppins text-caption text-ink-500"
              numberOfLines={1}
            >
              {listing.location ?? "Location not set"}
              {` · ${moment(listing.publishedAt ?? listing.createdAt).fromNow()}`}
            </Text>
          </View>

          {!isOwnListing ? (
            <View className="mt-5 gap-3">
              <Pressable
                onPress={handleMessage}
                disabled={startingChat}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4"
                style={{ opacity: startingChat ? 0.7 : 1 }}
              >
                {startingChat ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MessageCircle size={ICON.md} color="#FFFFFF" />
                    <Text className="font-poppins-semibold text-subtitle text-white">
                      Message
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={handleCall}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-brand-600 bg-white py-4"
              >
                <Phone size={ICON.md} color={colors.brand600} />
                <Text className="font-poppins-semibold text-subtitle text-brand-600">
                  Call
                </Text>
              </Pressable>
              {listing.officePickupAvailable ? (
                <Pressable
                  onPress={handleOfficePickup}
                  className="flex-row items-center justify-center gap-2 rounded-2xl bg-gold-400 py-4"
                >
                  <PackageCheck size={ICON.md} color={colors.ink900} />
                  <Text className="font-poppins-semibold text-subtitle text-ink-900">
                    Request Office Pickup
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View className="mt-6 flex-row gap-3">
            <InfoTile label="Condition" value={listing.condition} />
            <InfoTile
              label="Ad type"
              value={
                listing.promotionPlanName
                  ? `${listing.promotionPlanName} ad`
                  : "Standard ad"
              }
            />
          </View>

          {listing.condition === "Used" && listing.hasOriginalReceipt != null ? (
            <View
              className={`mt-3 flex-row items-center gap-2 self-start rounded-full px-3 py-1.5 ${
                listing.hasOriginalReceipt ? "bg-brand-50" : "bg-surface"
              }`}
            >
              <ReceiptText
                size={ICON.sm}
                color={listing.hasOriginalReceipt ? colors.brand600 : colors.ink500}
              />
              <Text
                className={`font-poppins-medium text-caption ${
                  listing.hasOriginalReceipt ? "text-brand-700" : "text-ink-500"
                }`}
              >
                {listing.hasOriginalReceipt
                  ? "Comes with original receipt"
                  : "No original receipt"}
              </Text>
            </View>
          ) : null}

          <Section title="Description">
            <Text className="font-poppins text-body leading-6 text-ink-700">
              {listing.description}
            </Text>
          </Section>

          {videoId ? (
            <Section title="Video">
              <YouTubePlayer videoId={videoId} />
            </Section>
          ) : null}

          {socialLinks.length > 0 ? (
            <Section title="See it on">
              <View className="flex-row flex-wrap gap-2">
                {socialLinks.map(({ key, label, color, url }) => (
                  <Pressable
                    key={key}
                    onPress={() => Linking.openURL(url).catch(() => {})}
                    accessibilityRole="link"
                    accessibilityLabel={`Open this ad on ${label}`}
                    className="flex-row items-center gap-1.5 rounded-full px-4 py-2 active:opacity-80"
                    style={{ backgroundColor: color }}
                  >
                    <Text className="font-poppins-semibold text-caption text-white">
                      {label}
                    </Text>
                    <ExternalLink size={ICON.xs} color={colors.white} />
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="Seller">
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/seller/[id]",
                  params: { id: listing.seller.sellerProfileId },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`View ${listing.seller.businessName}'s profile`}
              className="rounded-2xl border border-brand-50 bg-surface p-4 active:bg-brand-50"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-50">
                  <Store size={ICON.lg} color={colors.brand600} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text
                      className="font-poppins-semibold text-subtitle text-ink-900"
                      numberOfLines={1}
                    >
                      {listing.seller.businessName}
                    </Text>
                    {listing.seller.verificationStatus === "Verified" ? (
                      <BadgeCheck size={ICON.sm} color={colors.brand600} />
                    ) : null}
                  </View>
                  {listing.seller.isBusinessVerified ? (
                    <VerifiedBusinessPill />
                  ) : null}
                  <Text className="font-poppins text-caption text-ink-500">
                    On Ogasela since{" "}
                    {moment(listing.seller.memberSince).format("MMM YYYY")}
                  </Text>
                </View>
              </View>
              <View className="mt-3 flex-row items-start gap-2">
                <MapPin
                  size={ICON.sm}
                  color={colors.ink500}
                  style={{ marginTop: 2 }}
                />
                <Text className="flex-1 font-poppins text-body text-ink-700">
                  {storeAddress ?? "No store address shared"}
                </Text>
              </View>
              <View className="mt-3 flex-row items-center justify-end gap-1">
                <Text className="font-poppins-medium text-caption text-brand-600">
                  View seller profile
                </Text>
                <ChevronRight size={ICON.sm} color={colors.brand600} />
              </View>
            </Pressable>
          </Section>

          {!isOwnListing ? (
            <View className="mt-4 flex-row gap-3">
              <ReportButton
                icon={Flag}
                label="Report Ad"
                onPress={() => openReport("ad")}
              />
              <ReportButton
                icon={UserX}
                label="Report Seller"
                onPress={() => openReport("seller")}
              />
            </View>
          ) : null}
          {!isOwnListing ? (
            <Pressable
              onPress={() => {
                if (!user) {
                  router.push({
                    pathname: "/(modals)/sign-in",
                    params: { redirect: `/listing/${listing.id}` },
                  });
                  return;
                }
                router.push({
                  pathname: "/disputes/new",
                  params: { listingId: listing.id },
                });
              }}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-ink-300/40 bg-white py-3"
            >
              <Scale size={ICON.sm} color={colors.ink700} />
              <Text className="font-poppins-semibold text-body text-ink-700">
                Had a problem with this deal? Open a dispute
              </Text>
            </Pressable>
          ) : null}
        </View>

        <ListingRail
          title="Other ads by this seller"
          listings={sellerAds}
          emptyText="This seller has no other ads."
        />

        <View className="px-6">
          <Section
            title="Seller reviews"
            trailing={
              reviews && reviews.totalCount > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Star
                    size={ICON.sm}
                    color={colors.gold500}
                    fill={colors.gold500}
                  />
                  <Text className="font-poppins-semibold text-body text-ink-900">
                    {reviews.averageRating.toFixed(1)}
                  </Text>
                  <Text className="font-poppins text-caption text-ink-500">
                    ({reviews.totalCount})
                  </Text>
                </View>
              ) : null
            }
          >
            {!reviews || reviews.items.length === 0 ? (
              <EmptyCard text="No reviews yet." />
            ) : (
              <View className="gap-3">
                {reviews.items.map((review) => (
                  <View
                    key={review.id}
                    className="rounded-2xl border border-brand-50 bg-white p-4"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-poppins-semibold text-body text-ink-900">
                        {review.reviewerName ?? "Ogasela buyer"}
                      </Text>
                      <Text className="font-poppins text-micro text-ink-300">
                        {moment(review.createdAt).fromNow()}
                      </Text>
                    </View>
                    <View className="mt-1 flex-row gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={ICON.xs}
                          color={colors.gold500}
                          fill={
                            n <= review.rating ? colors.gold500 : "transparent"
                          }
                        />
                      ))}
                    </View>
                    {review.comment ? (
                      <Text className="mt-2 font-poppins text-body text-ink-700">
                        {review.comment}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </Section>
        </View>

        <ListingRail
          title="Similar ads"
          listings={similarAds}
          emptyText="No similar ads yet."
        />
      </ScrollView>

      <ReportSheet
        visible={reporting !== null}
        title={reporting === "seller" ? "Report seller" : "Report ad"}
        subtitle={
          reporting === "seller"
            ? `Tell us what's wrong with ${listing.seller.businessName}. Reports are private.`
            : "Tell us what's wrong with this ad. The seller won't see who reported it."
        }
        reasons={
          reporting === "seller" ? SELLER_REPORT_REASONS : AD_REPORT_REASONS
        }
        onClose={() => setReporting(null)}
        onSubmit={submitReport}
      />

      <OfficePickupSheet
        visible={officePickupOpen}
        listingId={listing.id}
        listingTitle={listing.title}
        onClose={() => setOfficePickupOpen(false)}
      />
    </View>
  );
}

function ReportButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Flag;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 py-3"
    >
      <Icon size={ICON.sm} color={colors.danger} />
      <Text className="font-poppins-semibold text-body text-danger">{label}</Text>
    </Pressable>
  );
}

function Gallery({ urls }: { urls: string[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (urls.length === 0) {
    return (
      <View
        className="items-center justify-center bg-brand-50"
        style={{ width, height: GALLERY_HEIGHT }}
      >
        <ImageOff size={32} color={colors.ink300} />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={urls}
        keyExtractor={(url, i) => `${i}-${url}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height: GALLERY_HEIGHT }}
            className="bg-brand-50"
            resizeMode="cover"
          />
        )}
      />
      {urls.length > 1 ? (
        <>
          <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
            {urls.map((url, i) => (
              <View
                key={`${i}-${url}`}
                className={`h-1.5 rounded-full ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </View>
          <View className="absolute bottom-3 right-4 rounded-full bg-black/50 px-2.5 py-1">
            <Text className="font-poppins-medium text-micro text-white">
              {index + 1}/{urls.length}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
    >
      <ChevronLeft size={ICON.lg} color={colors.ink700} />
    </Pressable>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-brand-50 bg-surface px-4 py-3">
      <Text className="font-poppins text-micro uppercase tracking-wide text-ink-500">
        {label}
      </Text>
      <Text className="mt-1 font-poppins-semibold text-body text-ink-900">
        {value}
      </Text>
    </View>
  );
}

function Section({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-7">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-poppins-semibold text-subtitle text-ink-900">
          {title}
        </Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View className="items-center rounded-2xl border border-brand-50 bg-white px-4 py-5">
      <Text className="font-poppins text-body text-ink-500">{text}</Text>
    </View>
  );
}

function ListingRail({
  title,
  listings,
  emptyText,
}: {
  title: string;
  listings: SearchResultItem[];
  emptyText: string;
}) {
  return (
    <View className="mt-7">
      <Text className="mb-3 px-6 font-poppins-semibold text-subtitle text-ink-900">
        {title}
      </Text>
      {listings.length === 0 ? (
        <View className="px-6">
          <EmptyCard text={emptyText} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          {listings.map((item) => (
            <ListingCard key={item.id} listing={item} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
