import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowUpCircle,
  Check,
  ChevronLeft,
  Clock,
  CreditCard,
  ImageOff,
  // Wallet disabled for now - restore with the wallet payment option below.
  // Wallet as WalletIcon,
  type LucideIcon,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { PostStepProgress } from "@/components/PostStepProgress";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as listingsService from "@/services/listings";
import type { ListingCheckout, ListingPaymentMethod } from "@/services/listings";
import { getPromotionPlans } from "@/services/promotionPlans";
// import * as walletService from "@/services/wallet"; // Wallet disabled for now.
import { colors } from "@/theme/colors";
import type { Listing, PromotionPlan } from "@/types/api";
import { formatNaira } from "@/utils/currency";
import { canUpgrade } from "@/utils/listingLifecycle";
import { openCheckout } from "@/utils/payments";
import { ICON } from "@/theme/typography";

/** Plan prices and wallet balances are in kobo. */
const fromKobo = (kobo: number) => formatNaira(Math.round(kobo) / 100);

/** How long to keep asking after the card page closes before handing over to the webhook. */
const CONFIRM_ATTEMPTS = 5;
const CONFIRM_DELAY_MS = 2000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Friendlier wording for the rules the API checks before any money moves. */
function checkoutErrorMessage(error: unknown): { title: string; body: string } {
  if (!(error instanceof ApiError)) {
    return { title: "Couldn't complete checkout", body: "Something went wrong. Please try again." };
  }
  switch (error.code) {
    case "Listing.NotVerified":
      return { title: "Verify your account first", body: "Complete seller verification in your profile, then try again." };
    case "Listing.Incomplete":
      return { title: "Your ad isn't finished", body: error.message };
    case "Listing.MediaLimitExceeded":
      return { title: "Too many photos for this plan", body: "Choose a bigger plan or remove some photos." };
    case "Listing.CategoryNotFreeEligible":
      return { title: "The free plan isn't available here", body: "Ads in this category need a paid plan." };
    case "Listing.FreePlanCapReached":
      return { title: "You've used all your free ads", body: "Choose a paid plan, or wait for one of your free ads to end." };
    case "Listing.ResubmitInstead":
      return { title: "Nothing to pay", body: "This ad's plan is still running. Fix it and resubmit it from My ads." };
    case "Listing.PlanDowngradeNotAllowed":
      return { title: "Plans can only go up", body: "A running plan can only be upgraded. Choose a plan that costs the same or more." };
    case "Listing.SamePlan":
      return { title: "Already on this plan", body: "Choose a bigger plan to upgrade." };
    case "Listing.NotLive":
      return { title: "Can't change plan", body: "Only ads that are live, or being reviewed after an edit, can change plan." };
    // Wallet disabled for now - only reachable when paying from the wallet.
    // case "Payment.InsufficientBalance":
    //   return { title: "Not enough in your wallet", body: "Pay by card instead, or top up your wallet." };
    default:
      return { title: "Couldn't complete checkout", body: error.message };
  }
}

/** new: a draft's first submission. renew: an expired ad. upgrade: a bigger plan for an ad whose plan is running. */
type Mode = "new" | "renew" | "upgrade";

function modeOf(listing: Listing): Mode | null {
  if (canUpgrade(listing)) return "upgrade";
  if (listing.status === "Expired") return "renew";
  if (listing.status === "Draft") return "new";
  return null;
}

/**
 * Paying for an ad's plan. For a draft (step 4 of posting): pick a promotion plan, pay, and only
 * once the payment is confirmed is the ad submitted for review - until then it stays a draft in My
 * Ads. An expired ad is renewed the same way, for a fresh plan period. An ad whose plan is running
 * can only be upgraded: plans costing the same or more, at full price; the new plan starts counting
 * once paid and the old expiry date no longer applies.
 * Card payments open the gateway's page; when it closes we ask the API to confirm with the
 * gateway (retrying briefly), and the gateway's webhook settles it later if the bank is slow.
 */
export default function ChoosePlanScreen() {
  const { listingId, fromPost } = useLocalSearchParams<{ listingId: string; fromPost?: string }>();
  useProtectedRoute(`/choose-plan?listingId=${listingId}`);
  const router = useRouter();

  const [listing, setListing] = useState<Listing | null>(null);
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  /** Upgrades: the plan the ad is on now. */
  const [currentPlan, setCurrentPlan] = useState<PromotionPlan | null>(null);
  // Wallet disabled for now: no balance is loaded or shown, and every paid plan goes through the card checkout.
  // const [balanceKobo, setBalanceKobo] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState<ListingPaymentMethod>("Card");
  // Wallet disabled for now - stand-in so the rest of the screen compiles unchanged.
  const balanceKobo: number | null = null;
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  /** A card payment the bank hasn't confirmed yet - checked again on focus and via "Check again". */
  const [pendingReference, setPendingReference] = useState<string | null>(null);

  // Wallet disabled for now - restore the balance fetch with the wallet option.
  // const loadWallet = useCallback(async () => {
  //   try {
  //     setBalanceKobo((await walletService.getWallet()).balanceKobo);
  //   } catch {
  //     setBalanceKobo(null);
  //   }
  // }, []);
  const loadWallet = useCallback(() => {}, []);

  useFocusEffect(
    useCallback(() => {
      if (!listingId) return;
      let cancelled = false;
      (async () => {
        try {
          const [ad, allPlans] = await Promise.all([listingsService.getById(listingId), getPromotionPlans()]);
          if (cancelled) return;
          const onSale = allPlans.filter((p) => p.isActive);
          const current = allPlans.find((p) => p.id === ad.promotionPlanId) ?? null;
          const upgrading = modeOf(ad) === "upgrade";
          // Never a downgrade: paid plans at least as dear as the current one.
          const offered = upgrading
            ? onSale.filter((p) => p.price > 0 && p.id !== current?.id && p.price >= (current?.price ?? 0))
            : onSale;
          setListing(ad);
          setCurrentPlan(current);
          setPlans(offered);
          setSelectedId((selectedNow) =>
            selectedNow && offered.some((p) => p.id === selectedNow)
              ? selectedNow
              : (!upgrading && offered.some((p) => p.id === ad.promotionPlanId) ? ad.promotionPlanId : offered[0]?.id) ?? null,
          );
        } catch {
          if (!cancelled) setListing(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      loadWallet();
      return () => {
        cancelled = true;
      };
    }, [listingId, loadWallet]),
  );

  const mode = listing ? modeOf(listing) : null;
  const upgrading = mode === "upgrade";
  /** Where the ad lives in My Ads while it isn't paid for. */
  const savedNote = upgrading ? "Your ad stays on its current plan" : "Your ad is saved in My Ads";
  const selected = useMemo(() => plans.find((p) => p.id === selectedId) ?? null, [plans, selectedId]);
  const isFree = selected?.price === 0;
  const photoCount = listing?.mediaUrls.length ?? 0;
  /** Photos the API will leave off when this ad is submitted on the selected plan (it keeps the first ones). */
  const photosDropped = selected && selected.photoLimit > 0 ? Math.max(0, photoCount - selected.photoLimit) : 0;
  const walletCovers = !!selected && balanceKobo !== null && balanceKobo >= selected.price;
  const effectiveMethod: ListingPaymentMethod = method === "Wallet" && !walletCovers ? "Card" : method;

  const finish = (result: ListingCheckout) => {
    const underReview = result.listing.status === "PendingReview";
    if (upgrading) {
      Toast.show({
        type: "success",
        text1: "Plan upgraded",
        text2: result.listing.expiresAt
          ? `Your new plan started today and runs until ${moment(result.listing.expiresAt).format("D MMM YYYY")}.`
          : undefined,
      });
      const tab = underReview ? "pending" : result.listing.status === "Draft" ? "rejected" : "active";
      router.replace({ pathname: "/my-ads", params: { tab } });
      return;
    }
    Toast.show({
      type: "success",
      text1: underReview ? "Paid - your ad is under review" : "Your ad is live",
      text2: underReview ? "We'll let you know as soon as our team approves it." : undefined,
    });
    router.replace({ pathname: "/my-ads", params: { tab: underReview ? "pending" : "active" } });
  };

  /** Asks the API to confirm a card payment, a few times while the bank catches up. */
  const confirm = async (reference: string) => {
    setPaying("Confirming your payment...");
    try {
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
        const result = await listingsService.confirmCheckout(listingId, reference);
        if (result.outcome === "Submitted") {
          setPendingReference(null);
          finish(result);
          return;
        }
        if (result.outcome === "PaymentFailed") {
          setPendingReference(null);
          Toast.show({
            type: "error",
            text1: "Payment wasn't completed",
            text2: `${savedNote}. You can try again any time.`,
          });
          loadWallet();
          return;
        }
        await wait(CONFIRM_DELAY_MS);
      }
      // Still pending: the webhook will submit the ad when the bank confirms.
      setPendingReference(reference);
    } catch (error) {
      setPendingReference(reference);
      const { title, body } = checkoutErrorMessage(error);
      Toast.show({ type: "error", text1: title, text2: body });
    } finally {
      setPaying(null);
    }
  };

  /** The payment page was closed without finishing - cancelled, unless the gateway says otherwise. */
  const cancel = async (reference: string) => {
    setPaying("Checking your payment...");
    try {
      const result = await listingsService.cancelCheckout(listingId, reference);
      if (result.outcome === "Submitted") {
        finish(result);
      } else if (result.outcome === "PaymentPending") {
        // Genuinely in progress at the bank (e.g. a transfer) - keep waiting for the webhook.
        setPendingReference(reference);
      } else {
        Toast.show({
          type: "info",
          text1: "Payment cancelled",
          text2: `Nothing was charged. ${savedNote}.`,
        });
      }
    } catch {
      Toast.show({ type: "error", text1: "Payment cancelled", text2: "Nothing was charged." });
    } finally {
      loadWallet();
    }
  };

  const pay = async () => {
    if (!listing || !selected) return;
    setPaying(isFree ? "Submitting your ad..." : "Starting payment...");
    try {
      const result = upgrading
        ? await listingsService.upgradePlan(listing.id, selected.id, effectiveMethod)
        : await listingsService.checkout(listing.id, selected.id, effectiveMethod);
      if (result.outcome === "Submitted") {
        finish(result);
        return;
      }
      if (result.outcome === "PaymentRequired" && result.redirectUrl && result.paymentReference) {
        setPaying("Waiting for payment...");
        const returned = await openCheckout(result.redirectUrl);
        if (returned === "closed") {
          await cancel(result.paymentReference);
          return;
        }
        await confirm(result.paymentReference);
      }
    } catch (error) {
      const { title, body } = checkoutErrorMessage(error);
      Toast.show({ type: "error", text1: title, text2: body });
      loadWallet();
    } finally {
      setPaying(null);
    }
  };

  const buttonLabel = !selected
    ? "Choose a plan"
    : isFree
      ? "Submit for review - free"
      : upgrading
        ? `Pay ${fromKobo(selected.price)} and upgrade`
        : `Pay ${fromKobo(selected.price)}`;
  // Wallet disabled for now: was `Pay ${fromKobo(selected.price)}${effectiveMethod === "Wallet" ? " from wallet" : ""}`

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <View className="px-6 pb-2 pt-4">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/my-ads"))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <ChevronLeft size={ICON.lg} color={colors.ink700} />
          </Pressable>
          <View className="flex-1">
            <Text className="font-poppins-bold text-display text-ink-900">
              {upgrading ? "Upgrade your plan" : mode === "renew" ? "Renew your ad" : "Promote & pay"}
            </Text>
            {listing ? (
              <Text className="font-poppins text-caption text-ink-500" numberOfLines={1}>
                for “{listing.title}”
              </Text>
            ) : null}
          </View>
        </View>
        {fromPost ? <PostStepProgress current={3} /> : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : !listing ? (
        <Text className="px-6 pt-6 text-center font-poppins text-body text-ink-500">This ad could not be found.</Text>
      ) : mode === null ? (
        <Text className="px-6 pt-6 text-center font-poppins text-body text-ink-500">
          This ad has already been paid for and submitted.
        </Text>
      ) : plans.length === 0 ? (
        <Text className="px-6 pt-6 text-center font-poppins text-body text-ink-500">
          {upgrading
            ? `Your ad is already on our top plan${currentPlan ? ` (${currentPlan.name})` : ""}.`
            : "No plans are available right now. Your ad is saved in My Ads. Try again later."}
        </Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 12 }}>
            {pendingReference ? (
              <View className="flex-row gap-3 rounded-2xl border border-gold-50 bg-gold-50 p-4">
                <Clock size={ICON.md} color={colors.gold700} />
                <View className="flex-1">
                  <Text className="font-poppins-semibold text-body text-gold-700">Confirming your payment</Text>
                  <Text className="mt-0.5 font-poppins text-caption text-ink-700">
                    Your bank hasn&apos;t confirmed it yet.{" "}
                    {upgrading
                      ? "We'll move your ad to its new plan automatically once it does."
                      : "We'll submit your ad for review automatically once it does."}{" "}
                    You don&apos;t need to pay again.
                  </Text>
                  <Pressable onPress={() => confirm(pendingReference)} disabled={!!paying} className="mt-2 self-start">
                    <Text className="font-poppins-semibold text-caption text-brand-700">Check again</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {upgrading && currentPlan ? (
              <View className="flex-row gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
                <ArrowUpCircle size={ICON.md} color={colors.brand600} />
                <View className="flex-1">
                  <Text className="font-poppins-semibold text-body text-ink-900">
                    You&apos;re on the {currentPlan.name} plan
                    {listing.expiresAt ? ` until ${moment(listing.expiresAt).format("D MMM YYYY")}` : ""}
                  </Text>
                  <Text className="mt-0.5 font-poppins text-caption text-ink-700">
                    An upgrade costs the new plan&apos;s full price. It starts the moment your payment is confirmed and runs
                    for its full length from then, so your current end date no longer applies. No new review is needed for a
                    plan change.
                  </Text>
                </View>
              </View>
            ) : null}

            {mode === "new" && listing.reviewNote ? (
              <View className="rounded-2xl border border-danger/20 bg-danger/5 p-4">
                <Text className="font-poppins-semibold text-body text-danger">Last submission wasn&apos;t approved</Text>
                <Text className="mt-0.5 font-poppins text-caption text-ink-700">{listing.reviewNote}</Text>
              </View>
            ) : null}

            <Text className="font-poppins-semibold text-subtitle text-ink-900">
              1. Choose {upgrading ? "your new plan" : "a promotion plan"}
            </Text>
            {plans.map((plan) => {
              const isSelected = plan.id === selectedId;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelectedId(plan.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={`rounded-3xl border-2 bg-white p-5 ${isSelected ? "border-brand-600" : "border-brand-50"}`}
                >
                  <View className="flex-row items-start gap-3">
                    <View className="flex-1">
                      <Text className="font-poppins-semibold text-title text-ink-900">{plan.name}</Text>
                      {plan.description ? (
                        <Text className="mt-0.5 font-poppins text-caption text-ink-500">{plan.description}</Text>
                      ) : null}
                    </View>
                    <View
                      className={`h-6 w-6 items-center justify-center rounded-full border-2 ${isSelected ? "border-brand-600 bg-brand-600" : "border-ink-300"}`}
                    >
                      {isSelected ? <Check size={ICON.sm} color={colors.white} strokeWidth={3} /> : null}
                    </View>
                  </View>

                  <Text className="mt-3 font-poppins-bold text-display text-ink-900">
                    {plan.price === 0 ? "Free" : fromKobo(plan.price)}
                    <Text className="font-poppins text-caption text-ink-500"> · {plan.durationDays} days</Text>
                  </Text>

                  {plan.photoLimit > 0 && photoCount > plan.photoLimit ? (
                    <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-gold-50 px-3 py-2">
                      <ImageOff size={ICON.sm} color={colors.gold700} style={{ marginTop: 2 }} />
                      <Text className="flex-1 font-poppins text-caption text-gold-700">
                        Shows {plan.photoLimit} of your {photoCount} photos - we&apos;ll keep your first {plan.photoLimit}.
                      </Text>
                    </View>
                  ) : null}

                  {plan.features.length > 0 ? (
                    <View className="mt-3 gap-1.5">
                      {plan.features.map((feature) => (
                        <View key={feature} className="flex-row items-start gap-2">
                          <Check size={ICON.sm} color={colors.brand600} style={{ marginTop: 2 }} />
                          <Text className="flex-1 font-poppins text-body text-ink-700">{feature}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="mt-2 font-poppins text-caption text-ink-500">
                      Up to {plan.photoLimit} photos{plan.videoAllowed ? " and a video" : ""}.
                    </Text>
                  )}
                </Pressable>
              );
            })}

            {selected && !isFree ? (
              <>
                <Text className="mt-3 font-poppins-semibold text-subtitle text-ink-900">2. How would you like to pay?</Text>
                <MethodOption
                  icon={CreditCard}
                  title="Card, bank transfer or USSD"
                  subtitle="Pay securely on our payment partner's page"
                  selected={effectiveMethod === "Card"}
                  onPress={() => setMethod("Card")}
                />
                {/* Wallet disabled for now - restore with WalletIcon, walletService and balanceKobo above.
                <MethodOption
                  icon={WalletIcon}
                  title="Wallet"
                  subtitle={
                    balanceKobo === null
                      ? "Balance unavailable"
                      : walletCovers
                        ? `Balance ${fromKobo(balanceKobo)}`
                        : `Balance ${fromKobo(balanceKobo)} - not enough for this plan`
                  }
                  selected={effectiveMethod === "Wallet"}
                  disabled={!walletCovers}
                  onPress={() => setMethod("Wallet")}
                />
                */}
              </>
            ) : null}

            {photosDropped > 0 && selected ? (
              <View className="mt-2 flex-row gap-3 rounded-2xl border border-gold-50 bg-gold-50 p-4">
                <ImageOff size={ICON.md} color={colors.gold700} />
                <Text className="flex-1 font-poppins text-caption text-ink-700">
                  The {selected.name} plan includes up to {selected.photoLimit} photos, so your last {photosDropped}{" "}
                  {photosDropped === 1 ? "photo" : "photos"} will be left off when your ad is submitted. Choose a bigger
                  plan to keep them all, or edit your draft and remove the ones you can do without.
                </Text>
              </View>
            ) : null}

            <Text className="mt-2 font-poppins text-caption text-ink-500">
              {upgrading
                ? "Once your payment is confirmed, your ad moves to the new plan straight away."
                : `Once ${isFree ? "submitted" : "your payment is confirmed"}, your ad goes to our team for a quick review before buyers can see it.`}
              {/* Wallet disabled for now: " If it isn't approved, a paid plan is refunded to your wallet." */}
            </Text>
          </ScrollView>

          <View className="gap-2 border-t border-brand-50 bg-white px-6 pb-2 pt-4">
            {paying ? (
              <Text className="text-center font-poppins text-caption text-ink-500">{paying}</Text>
            ) : null}
            <PrimaryButton
              label={buttonLabel}
              onPress={pay}
              loading={!!paying}
              disabled={!selected || !!pendingReference}
            />
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: "/my-ads",
                  params: { tab: upgrading ? "active" : mode === "renew" ? "expired" : "draft" },
                })
              }
              className="items-center py-2"
            >
              <Text className="font-poppins-medium text-body text-ink-500">
                {mode === "new" ? "Save as draft for now" : "Back to My Ads"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function MethodOption({
  icon: Icon,
  title,
  subtitle,
  selected,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      className={`flex-row items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 ${selected ? "border-brand-600" : "border-brand-50"}`}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
        <Icon size={ICON.md} color={colors.brand600} />
      </View>
      <View className="flex-1">
        <Text className="font-poppins-semibold text-body text-ink-900">{title}</Text>
        <Text className="font-poppins text-caption text-ink-500">{subtitle}</Text>
      </View>
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-brand-600 bg-brand-600" : "border-ink-300"}`}
      >
        {selected ? <Check size={ICON.xs} color={colors.white} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}
