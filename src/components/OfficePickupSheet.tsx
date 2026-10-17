import { useRouter } from "expo-router";
import {
  Building2,
  Check,
  CreditCard,
  PackageCheck,
  ShieldCheck,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { Modal } from "@/components/ActivityModal";
import { useLocation } from "@/context/LocationContext";
import { ApiError } from "@/lib/apiClient";
import * as officePickups from "@/services/officePickups";
import {
  formatKobo,
  type OfficeBranch,
  type OfficePickupQuote,
} from "@/services/officePickups";
import { colors } from "@/theme/colors";
import { openCheckout } from "@/utils/payments";
import { ICON } from "@/theme/typography";

/** How long to keep asking after the payment page closes before leaving it to the webhook. */
const CONFIRM_ATTEMPTS = 5;
const CONFIRM_DELAY_MS = 2000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CreditCard,
    title: "Pay through Ogasela",
    body: "You pay Ogasela the item price plus a 3% office pickup fee. We email you a receipt.",
  },
  {
    icon: Building2,
    title: "The seller drops it at our office",
    body: "We ask the seller to bring the item to the Ogasela branch you choose below.",
  },
  {
    icon: ShieldCheck,
    title: "We inspect it",
    body: "Our team checks the item matches the ad before it's handed over.",
  },
  {
    icon: Truck,
    title: "Pick it up, or we deliver",
    body: "Walk in to collect it, or ask us to deliver it to your home.",
  },
];

type Props = {
  visible: boolean;
  listingId: string;
  listingTitle: string;
  onClose: () => void;
};

export function OfficePickupSheet({
  visible,
  listingId,
  listingTitle,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coords } = useLocation();

  const [quote, setQuote] = useState<OfficePickupQuote | null>(null);
  const [branches, setBranches] = useState<OfficeBranch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    Promise.all([
      officePickups.getQuote(listingId),
      officePickups.getBranches(coords),
    ])
      .then(([q, b]) => {
        if (!active) return;
        setQuote(q);
        setBranches(b);
        // Nearest branch first (when we know where the buyer is).
        setBranchId(b[0]?.id ?? null);
      })
      .catch((err) => {
        if (active) {
          setLoadError(
            err instanceof ApiError ? err.message : "Couldn't load office pickup details.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      // Start the next opening from a clean loading state.
      setLoading(true);
      setLoadError(null);
    };
  }, [visible, listingId, coords]);

  const openRequest = (id: string) => {
    onClose();
    router.push({ pathname: "/office-pickups/[id]", params: { id } });
  };

  const pay = async () => {
    if (!branchId || paying) return;
    setPaying("Starting payment...");
    let requestId: string | null = null;
    try {
      const checkout = await officePickups.start(listingId, branchId);
      requestId = checkout.request.id;
      setPaying("Waiting for payment...");
      const returned = await openCheckout(checkout.redirectUrl);
      if (returned === "closed") {
        setPaying("Checking your payment...");
        const detail = await officePickups.cancelPayment(checkout.request.id);
        if (detail.summary.status === "PaymentConfirmed") {
          Toast.show({
            type: "success",
            text1: "Payment confirmed",
            text2: "Your receipt is on its way to your email. We'll update you at every step.",
          });
          openRequest(checkout.request.id);
        } else if (detail.summary.status === "AwaitingPayment") {
          // Still in progress at the bank - the webhook will confirm it.
          Toast.show({
            type: "info",
            text1: "Waiting for your bank",
            text2: "We'll let you know as soon as the payment is confirmed.",
          });
          openRequest(checkout.request.id);
        } else {
          Toast.show({ type: "info", text1: "Payment cancelled", text2: "Nothing was charged." });
        }
        return;
      }

      setPaying("Confirming your payment...");
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
        const detail = await officePickups.confirmPayment(checkout.request.id);
        if (detail.summary.status === "PaymentConfirmed") {
          Toast.show({
            type: "success",
            text1: "Payment confirmed",
            text2: "Your receipt is on its way to your email. We'll update you at every step.",
          });
          openRequest(checkout.request.id);
          return;
        }
        if (detail.summary.status === "PaymentFailed") {
          Toast.show({
            type: "error",
            text1: "Payment wasn't completed",
            text2: "Nothing was charged. You can try again.",
          });
          return;
        }
        await wait(CONFIRM_DELAY_MS);
      }
      // Still pending at the bank: the request page lets them check again, and the webhook settles it.
      Toast.show({
        type: "info",
        text1: "Waiting for your bank",
        text2: "We'll let you know as soon as the payment is confirmed.",
      });
      openRequest(checkout.request.id);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't start office pickup",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
      if (requestId) {
        // Something broke after checkout started - stop pretending it's in progress unless it really is.
        officePickups.cancelPayment(requestId).catch(() => {});
      }
    } finally {
      setPaying(null);
    }
  };

  const unavailable = quote !== null && !quote.available;
  const canPay = !!quote?.available && !!branchId && !paying;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,24,40,0.45)" }}>
        <Pressable style={{ flex: 1 }} onPress={paying ? undefined : onClose} />
        <View
          className="rounded-t-3xl bg-white px-6 pt-5"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8, maxHeight: "90%" }}
        >
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-title text-ink-900">Request Office Pickup</Text>
            <Pressable onPress={onClose} disabled={!!paying} hitSlop={10}>
              <X size={ICON.lg} color={colors.ink500} />
            </Pressable>
          </View>
          <Text className="mb-4 font-poppins text-caption text-ink-500" numberOfLines={2}>
            Buy “{listingTitle}” safely through an Ogasela office.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.brand600} style={{ marginVertical: 40 }} />
          ) : loadError ? (
            <Text className="py-8 text-center font-poppins text-body text-ink-500">{loadError}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-3">
                {STEPS.map(({ icon: Icon, title, body }, index) => (
                  <View key={title} className="flex-row gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                      <Icon size={ICON.md} color={colors.brand600} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-poppins-semibold text-body text-ink-900">
                        {index + 1}. {title}
                      </Text>
                      <Text className="font-poppins text-caption leading-5 text-ink-500">{body}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View className="mt-4 rounded-2xl bg-gold-50 px-4 py-3">
                <Text className="font-poppins text-caption leading-5 text-ink-700">
                  If the item fails inspection, or you decide not to go ahead, you’re refunded
                  everything except a {quote?.cancellationFeePercent ?? 1}% processing and
                  cancellation fee
                  {quote ? ` (${formatKobo(quote.cancellationFeeKobo)})` : ""}.{" "}
                  <Text
                    onPress={() => router.push("/(modals)/terms")}
                    className="font-poppins-semibold text-brand-700"
                  >
                    See the Terms of Service
                  </Text>
                </Text>
              </View>

              {unavailable ? (
                <Text className="mt-5 text-center font-poppins text-body text-ink-500">
                  Office pickup isn’t available for this ad.
                </Text>
              ) : (
                <>
                  <Text className="mb-2 mt-5 font-poppins-semibold text-body text-ink-900">
                    Pickup branch
                  </Text>
                  {branches.length === 0 ? (
                    <Text className="font-poppins text-caption text-ink-500">
                      No branches are open for office pickup right now. Please check back soon.
                    </Text>
                  ) : (
                    branches.map((branch) => {
                      const selected = branch.id === branchId;
                      return (
                        <Pressable
                          key={branch.id}
                          onPress={() => setBranchId(branch.id)}
                          disabled={!!paying}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          className={`mb-2 flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
                            selected ? "border-brand-600 bg-brand-50" : "border-brand-50 bg-white"
                          }`}
                        >
                          <View className="flex-1">
                            <Text className="font-poppins-semibold text-body text-ink-900">
                              {branch.name}
                              {branch.distanceKm !== null ? (
                                <Text className="font-poppins text-caption text-ink-500">
                                  {"  "}
                                  {branch.distanceKm} km away
                                </Text>
                              ) : null}
                            </Text>
                            <Text className="font-poppins text-caption text-ink-500" numberOfLines={2}>
                              {branch.address}
                            </Text>
                            {branch.openingHours ? (
                              <Text className="font-poppins text-micro text-ink-300">
                                {branch.openingHours}
                              </Text>
                            ) : null}
                          </View>
                          {selected ? <Check size={ICON.sm} color={colors.brand600} /> : null}
                        </Pressable>
                      );
                    })
                  )}

                  {quote ? (
                    <View className="mt-3 gap-1.5 rounded-2xl border border-brand-50 bg-surface px-4 py-3">
                      <Row label="Item price" value={formatKobo(quote.itemPriceKobo)} />
                      <Row
                        label={`Office pickup fee (${quote.serviceFeePercent}%)`}
                        value={formatKobo(quote.serviceFeeKobo)}
                      />
                      <View className="my-1 h-px bg-brand-50" />
                      <Row label="Total" value={formatKobo(quote.totalKobo)} bold />
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          )}

          <Pressable
            onPress={pay}
            disabled={!canPay}
            className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4"
            style={{ opacity: canPay || paying ? 1 : 0.5 }}
          >
            {paying ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text className="font-poppins-semibold text-subtitle text-white">{paying}</Text>
              </>
            ) : (
              <>
                <PackageCheck size={ICON.md} color="#FFFFFF" />
                <Text className="font-poppins-semibold text-subtitle text-white">
                  Continue to payment
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const weight = bold ? "font-poppins-semibold text-ink-900" : "font-poppins text-ink-700";
  return (
    <View className="flex-row justify-between">
      <Text className={`text-body ${weight}`}>{label}</Text>
      <Text className={`text-body ${weight}`}>{value}</Text>
    </View>
  );
}
