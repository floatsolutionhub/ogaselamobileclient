import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Check,
  ChevronLeft,
  Clock,
  CreditCard,
  Wallet as WalletIcon,
  type LucideIcon,
} from "lucide-react-native";
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
import * as walletService from "@/services/wallet";
import { colors } from "@/theme/colors";
import type { Listing, PromotionPlan } from "@/types/api";
import { formatNaira } from "@/utils/currency";

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
    case "Payment.InsufficientBalance":
      return { title: "Not enough in your wallet", body: "Pay by card instead, or top up your wallet." };
    default:
      return { title: "Couldn't complete checkout", body: error.message };
  }
}

/**
 * Checkout for a draft ad (step 4 of posting): pick a promotion plan, pay, and only once the
 * payment is confirmed is the ad submitted for review. Until then it stays a draft in My Ads.
 * Card payments open the gateway's page; when it closes we ask the API to confirm with the
 * gateway (retrying briefly), and the gateway's webhook settles it later if the bank is slow.
 */
export default function ChoosePlanScreen() {
  const { listingId, fromPost } = useLocalSearchParams<{ listingId: string; fromPost?: string }>();
  useProtectedRoute(`/choose-plan?listingId=${listingId}`);
  const router = useRouter();

  const [listing, setListing] = useState<Listing | null>(null);
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  const [balanceKobo, setBalanceKobo] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState<ListingPaymentMethod>("Card");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  /** A card payment the bank hasn't confirmed yet - checked again on focus and via "Check again". */
  const [pendingReference, setPendingReference] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      setBalanceKobo((await walletService.getWallet()).balanceKobo);
    } catch {
      setBalanceKobo(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!listingId) return;
      let cancelled = false;
      (async () => {
        try {
          const [ad, allPlans] = await Promise.all([listingsService.getById(listingId), getPromotionPlans()]);
          if (cancelled) return;
          const onSale = allPlans.filter((p) => p.isActive);
          setListing(ad);
          setPlans(onSale);
          setSelectedId((current) => current ?? ad.promotionPlanId ?? onSale[0]?.id ?? null);
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

  const selected = useMemo(() => plans.find((p) => p.id === selectedId) ?? null, [plans, selectedId]);
  const isFree = selected?.price === 0;
  const walletCovers = !!selected && balanceKobo !== null && balanceKobo >= selected.price;
  const effectiveMethod: ListingPaymentMethod = method === "Wallet" && !walletCovers ? "Card" : method;

  const finish = (result: ListingCheckout) => {
    const underReview = result.listing.status === "PendingReview";
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
            text2: "Your ad is saved as a draft - you can pay any time.",
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

  const pay = async () => {
    if (!listing || !selected) return;
    setPaying(isFree ? "Submitting your ad..." : "Starting payment...");
    try {
      const result = await listingsService.checkout(listing.id, selected.id, effectiveMethod);
      if (result.outcome === "Submitted") {
        finish(result);
        return;
      }
      if (result.outcome === "PaymentRequired" && result.redirectUrl && result.paymentReference) {
        setPaying("Waiting for payment...");
        await WebBrowser.openBrowserAsync(result.redirectUrl);
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
      : `Pay ${fromKobo(selected.price)}${effectiveMethod === "Wallet" ? " from wallet" : ""}`;

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
            <ChevronLeft size={20} color={colors.ink700} />
          </Pressable>
          <View className="flex-1">
            <Text className="font-poppins-bold text-2xl text-ink-900">Promote & pay</Text>
            {listing ? (
              <Text className="font-poppins text-xs text-ink-500" numberOfLines={1}>
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
        <Text className="px-6 pt-6 text-center font-poppins text-sm text-ink-500">This ad could not be found.</Text>
      ) : listing.status !== "Draft" ? (
        <Text className="px-6 pt-6 text-center font-poppins text-sm text-ink-500">
          This ad has already been paid for and submitted.
        </Text>
      ) : plans.length === 0 ? (
        <Text className="px-6 pt-6 text-center font-poppins text-sm text-ink-500">
          No plans are available right now. Your ad is saved as a draft - try again later.
        </Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 12 }}>
            {pendingReference ? (
              <View className="flex-row gap-3 rounded-2xl border border-gold-50 bg-gold-50 p-4">
                <Clock size={18} color={colors.gold700} />
                <View className="flex-1">
                  <Text className="font-poppins-semibold text-sm text-gold-700">Confirming your payment</Text>
                  <Text className="mt-0.5 font-poppins text-xs text-ink-700">
                    Your bank hasn&apos;t confirmed it yet. We&apos;ll submit your ad for review automatically once it does -
                    you don&apos;t need to pay again.
                  </Text>
                  <Pressable onPress={() => confirm(pendingReference)} disabled={!!paying} className="mt-2 self-start">
                    <Text className="font-poppins-semibold text-xs text-brand-700">Check again</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {listing.reviewNote ? (
              <View className="rounded-2xl border border-danger/20 bg-danger/5 p-4">
                <Text className="font-poppins-semibold text-sm text-danger">Last submission wasn&apos;t approved</Text>
                <Text className="mt-0.5 font-poppins text-xs text-ink-700">{listing.reviewNote}</Text>
              </View>
            ) : null}

            <Text className="font-poppins-semibold text-base text-ink-900">1. Choose a promotion plan</Text>
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
                      <Text className="font-poppins-semibold text-lg text-ink-900">{plan.name}</Text>
                      {plan.description ? (
                        <Text className="mt-0.5 font-poppins text-xs text-ink-500">{plan.description}</Text>
                      ) : null}
                    </View>
                    <View
                      className={`h-6 w-6 items-center justify-center rounded-full border-2 ${isSelected ? "border-brand-600 bg-brand-600" : "border-ink-300"}`}
                    >
                      {isSelected ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
                    </View>
                  </View>

                  <Text className="mt-3 font-poppins-bold text-2xl text-ink-900">
                    {plan.price === 0 ? "Free" : fromKobo(plan.price)}
                    <Text className="font-poppins text-xs text-ink-500"> · {plan.durationDays} days</Text>
                  </Text>

                  {plan.features.length > 0 ? (
                    <View className="mt-3 gap-1.5">
                      {plan.features.map((feature) => (
                        <View key={feature} className="flex-row items-start gap-2">
                          <Check size={15} color={colors.brand600} style={{ marginTop: 2 }} />
                          <Text className="flex-1 font-poppins text-sm text-ink-700">{feature}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="mt-2 font-poppins text-xs text-ink-500">
                      Up to {plan.photoLimit} photos{plan.videoAllowed ? " and a video" : ""}.
                    </Text>
                  )}
                </Pressable>
              );
            })}

            {selected && !isFree ? (
              <>
                <Text className="mt-3 font-poppins-semibold text-base text-ink-900">2. How would you like to pay?</Text>
                <MethodOption
                  icon={CreditCard}
                  title="Card, bank transfer or USSD"
                  subtitle="Pay securely on our payment partner's page"
                  selected={effectiveMethod === "Card"}
                  onPress={() => setMethod("Card")}
                />
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
              </>
            ) : null}

            <Text className="mt-2 font-poppins text-xs text-ink-500">
              Once {isFree ? "submitted" : "your payment is confirmed"}, your ad goes to our team for a quick review
              before buyers can see it. If it isn&apos;t approved, a paid plan is refunded to your wallet.
            </Text>
          </ScrollView>

          <View className="gap-2 border-t border-brand-50 bg-white px-6 pb-2 pt-4">
            {paying ? (
              <Text className="text-center font-poppins text-xs text-ink-500">{paying}</Text>
            ) : null}
            <PrimaryButton
              label={buttonLabel}
              onPress={pay}
              loading={!!paying}
              disabled={!selected || !!pendingReference}
            />
            <Pressable
              onPress={() => router.replace({ pathname: "/my-ads", params: { tab: "draft" } })}
              className="items-center py-2"
            >
              <Text className="font-poppins-medium text-sm text-ink-500">Save as draft for now</Text>
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
        <Icon size={18} color={colors.brand600} />
      </View>
      <View className="flex-1">
        <Text className="font-poppins-semibold text-sm text-ink-900">{title}</Text>
        <Text className="font-poppins text-xs text-ink-500">{subtitle}</Text>
      </View>
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-brand-600 bg-brand-600" : "border-ink-300"}`}
      >
        {selected ? <Check size={12} color={colors.white} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}
