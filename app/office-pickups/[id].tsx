import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Clock,
  MapPin,
  Navigation,
  Phone,
  X,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { Modal } from "@/components/ActivityModal";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as officePickups from "@/services/officePickups";
import {
  OFFICE_PICKUP_STATUS_STYLE,
  formatKobo,
  type OfficePickupDetail,
  type OfficePickupStatus,
} from "@/services/officePickups";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

/** The main stages shown on the progress tracker, in order. */
const STAGES: { status: OfficePickupStatus; label: string }[] = [
  { status: "PaymentConfirmed", label: "Payment confirmed" },
  { status: "ItemReceived", label: "Item delivered to our office" },
  { status: "InspectionPassed", label: "Passed quality inspection" },
  { status: "ReadyForCollection", label: "Available for pickup or delivery" },
  { status: "Completed", label: "Completed" },
];

const STAGE_INDEX: Partial<Record<OfficePickupStatus, number>> = {
  PaymentConfirmed: 0,
  ItemReceived: 1,
  InspectionPassed: 2,
  ReadyForCollection: 3,
  OutForDelivery: 3,
  Completed: 4,
};

/** What the reader should do or expect now. */
function nextStepText(detail: OfficePickupDetail): string {
  const { summary, branch } = detail;
  const buyer = summary.myRole === "Buyer";
  switch (summary.status) {
    case "AwaitingPayment":
      return buyer
        ? "We're waiting for your bank to confirm the payment. This usually takes a minute."
        : "The buyer hasn't completed payment yet.";
    case "PaymentFailed":
      return "The payment didn't go through, so nothing was charged.";
    case "PaymentCancelled":
      return "You cancelled the payment, so nothing was charged. You can request office pickup again from the ad.";
    case "PaymentConfirmed":
      return buyer
        ? `We've asked the seller to drop the item at our ${branch.name} office. We'll let you know when it arrives.`
        : `The buyer has paid. Please drop the item at our ${branch.name} office (${branch.address}) and quote ${summary.reference}.`;
    case "ItemReceived":
      return "The item is at our office and our team is inspecting it.";
    case "InspectionPassed":
      return "The item passed our quality inspection. It'll be ready for you shortly.";
    case "InspectionFailed":
      return buyer
        ? "The item didn't pass inspection. We'll refund you, less the 1% cancellation fee."
        : `The item didn't pass inspection. Please collect it from our ${branch.name} office.`;
    case "ReadyForCollection":
      return buyer
        ? `Your item is ready. Collect it at our ${branch.name} office and quote ${summary.reference} - or contact us to have it delivered.`
        : "The item is ready for the buyer to collect.";
    case "OutForDelivery":
      return `The item is on its way to ${detail.deliveryAddress ?? "the buyer"}.`;
    case "Completed":
      return buyer ? "You've received your item. Enjoy!" : "The buyer has received the item.";
    case "Refunded":
      return buyer
        ? `We refunded ${formatKobo(detail.refundedKobo ?? 0)} to your payment method. It can take a few working days to show.`
        : "This office pickup was cancelled and the buyer was refunded.";
  }
}

export default function OfficePickupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useProtectedRoute(`/office-pickups/${id}`);
  const router = useRouter();

  const [detail, setDetail] = useState<OfficePickupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDetail(await officePickups.get(id));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const checkPayment = async () => {
    if (!detail) return;
    setChecking(true);
    try {
      const updated = await officePickups.confirmPayment(detail.summary.id);
      setDetail(updated);
      if (updated.summary.status === "AwaitingPayment") {
        Toast.show({ type: "info", text1: "Still waiting for your bank", text2: "We'll notify you once it's confirmed." });
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't check the payment",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setChecking(false);
    }
  };

  const summary = detail?.summary;
  const status = summary ? OFFICE_PICKUP_STATUS_STYLE[summary.status] : null;
  const isBuyer = summary?.myRole === "Buyer";
  const inProgress =
    !!summary &&
    ["PaymentConfirmed", "ItemReceived", "InspectionPassed", "InspectionFailed", "ReadyForCollection"].includes(summary.status);
  const canCancel = isBuyer && inProgress && !summary?.cancellationRequested;
  const stageIndex = summary ? STAGE_INDEX[summary.status] : undefined;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-4">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/office-pickups"))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <ChevronLeft size={ICON.lg} color={colors.ink700} />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-display text-ink-900" numberOfLines={1}>
          {summary?.reference ?? "Office pickup"}
        </Text>
        {status ? (
          <Text className={`rounded-full px-2.5 py-1 font-poppins-medium text-micro ${status.className}`}>
            {status.label}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : !detail || !summary ? (
        <Text className="px-6 pt-6 text-center font-poppins text-body text-ink-500">
          This office pickup could not be found.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 12 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/listing/[id]", params: { id: summary.listingId } })}
            className="flex-row items-center gap-3 rounded-3xl border border-brand-50 bg-white p-4"
          >
            {summary.listingThumbnailUrl ? (
              <Image source={{ uri: summary.listingThumbnailUrl }} className="h-14 w-14 rounded-xl bg-brand-50" />
            ) : (
              <View className="h-14 w-14 rounded-xl bg-brand-50" />
            )}
            <View className="flex-1">
              <Text className="font-poppins-semibold text-body text-ink-900" numberOfLines={2}>
                {summary.listingTitle}
              </Text>
              <Text className="font-poppins text-caption text-ink-500">
                {isBuyer ? "You're buying" : "You're selling"} · requested {moment(summary.createdAt).format("D MMM YYYY")}
              </Text>
            </View>
          </Pressable>

          <View className="rounded-3xl bg-brand-50 p-4">
            <Text className="font-poppins-semibold text-body text-brand-800">What’s next</Text>
            <Text className="mt-1 font-poppins text-body leading-6 text-ink-700">{nextStepText(detail)}</Text>
            {summary.cancellationRequested && summary.status !== "Refunded" ? (
              <Text className="mt-2 font-poppins text-caption text-ink-500">
                {isBuyer
                  ? "You've asked to cancel. Our team will process your refund shortly."
                  : "The buyer has asked to cancel."}
              </Text>
            ) : null}
            {isBuyer && summary.status === "AwaitingPayment" ? (
              <Pressable
                onPress={checkPayment}
                disabled={checking}
                className="mt-3 items-center rounded-2xl bg-brand-600 py-3"
              >
                {checking ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-poppins-semibold text-body text-white">Check payment</Text>
                )}
              </Pressable>
            ) : null}
          </View>

          {stageIndex !== undefined ? (
            <View className="rounded-3xl border border-brand-50 bg-white p-4">
              <Text className="mb-3 font-poppins-semibold text-body text-ink-900">Progress</Text>
              {STAGES.map((stage, index) => {
                const done = index <= stageIndex;
                return (
                  <View key={stage.status} className="flex-row gap-3">
                    <View className="items-center">
                      <View className={`h-3 w-3 rounded-full ${done ? "bg-brand-600" : "bg-brand-100"}`} />
                      {index < STAGES.length - 1 ? (
                        <View className={`w-0.5 flex-1 ${index < stageIndex ? "bg-brand-600" : "bg-brand-100"}`} style={{ minHeight: 22 }} />
                      ) : null}
                    </View>
                    <Text
                      className={`-mt-1 pb-3 font-poppins text-body ${done ? "text-ink-900" : "text-ink-300"}`}
                    >
                      {stage.status === "ReadyForCollection" && summary.status === "OutForDelivery"
                        ? "Out for delivery"
                        : stage.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View className="rounded-3xl border border-brand-50 bg-white p-4">
            <Text className="font-poppins-semibold text-body text-ink-900">Ogasela {detail.branch.name} office</Text>
            <View className="mt-2 flex-row items-start gap-2">
              <MapPin size={ICON.sm} color={colors.ink500} style={{ marginTop: 2 }} />
              <Text className="flex-1 font-poppins text-body text-ink-700">{detail.branch.address}</Text>
            </View>
            {detail.branch.openingHours ? (
              <View className="mt-1.5 flex-row items-center gap-2">
                <Clock size={ICON.sm} color={colors.ink500} />
                <Text className="font-poppins text-body text-ink-700">{detail.branch.openingHours}</Text>
              </View>
            ) : null}
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${detail.branch.latitude},${detail.branch.longitude}`,
                  ).catch(() => {})
                }
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-brand-600 py-2.5"
              >
                <Navigation size={ICON.sm} color={colors.brand600} />
                <Text className="font-poppins-semibold text-caption text-brand-600">Directions</Text>
              </Pressable>
              {detail.branch.phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${detail.branch.phone}`).catch(() => {})}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-brand-600 py-2.5"
                >
                  <Phone size={ICON.sm} color={colors.brand600} />
                  <Text className="font-poppins-semibold text-caption text-brand-600">Call branch</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {isBuyer ? (
            <View className="gap-1.5 rounded-3xl border border-brand-50 bg-white p-4">
              <Text className="mb-1 font-poppins-semibold text-body text-ink-900">Payment</Text>
              <Row label="Item price" value={formatKobo(detail.itemPriceKobo)} />
              <Row label="Office pickup fee (3%)" value={formatKobo(detail.serviceFeeKobo)} />
              <Row label="Total paid" value={formatKobo(summary.totalKobo)} bold />
              {detail.refundedKobo !== null ? (
                <>
                  <Row label="Cancellation fee (1%)" value={`- ${formatKobo(detail.cancellationFeeKobo ?? 0)}`} />
                  <Row label="Refunded" value={formatKobo(detail.refundedKobo)} bold />
                </>
              ) : null}
              {detail.paidAt ? (
                <Text className="mt-1 font-poppins text-micro text-ink-500">
                  Paid {moment(detail.paidAt).format("D MMM YYYY, h:mm a")} · receipt sent to your email
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="rounded-3xl border border-brand-50 bg-white p-4">
            <Text className="mb-3 font-poppins-semibold text-body text-ink-900">Activity</Text>
            {detail.activities.length === 0 ? (
              <Text className="font-poppins text-caption text-ink-500">Nothing yet.</Text>
            ) : (
              detail.activities.map((activity, index) => (
                <View key={`${activity.createdAt}-${index}`} className="mb-3 flex-row gap-3">
                  <View className={`mt-1.5 h-2 w-2 rounded-full ${index === 0 ? "bg-brand-600" : "bg-ink-300"}`} />
                  <View className="flex-1">
                    <Text className="font-poppins-medium text-body text-ink-900">{activity.title}</Text>
                    {activity.note ? (
                      <Text className="font-poppins text-caption leading-5 text-ink-700">{activity.note}</Text>
                    ) : null}
                    <Text className="font-poppins text-micro text-ink-300">
                      {moment(activity.createdAt).format("D MMM, h:mm a")}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {canCancel ? (
            <Pressable
              onPress={() => setCancelling(true)}
              className="items-center rounded-2xl border border-danger/30 bg-danger/5 py-3"
            >
              <Text className="font-poppins-semibold text-body text-danger">Cancel and request a refund</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      {detail ? (
        <CancelSheet
          visible={cancelling}
          detail={detail}
          onClose={() => setCancelling(false)}
          onCancelled={(updated) => {
            setDetail(updated);
            setCancelling(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function CancelSheet({
  visible,
  detail,
  onClose,
  onCancelled,
}: {
  visible: boolean;
  detail: OfficePickupDetail;
  onClose: () => void;
  onCancelled: (detail: OfficePickupDetail) => void;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fee = Math.round(detail.itemPriceKobo * 0.01);

  const submit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      onCancelled(await officePickups.requestCancellation(detail.summary.id, reason.trim()));
      setReason("");
      Toast.show({ type: "success", text1: "Cancellation requested", text2: "Our team will process your refund." });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't request cancellation",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,24,40,0.45)" }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View className="rounded-t-3xl bg-white px-6 pt-5" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-title text-ink-900">Cancel office pickup</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={ICON.lg} color={colors.ink500} />
            </Pressable>
          </View>
          <Text className="mb-4 font-poppins text-caption leading-5 text-ink-500">
            You’ll be refunded {formatKobo(detail.summary.totalKobo - fee)} - everything you paid except the 1% processing
            and cancellation fee ({formatKobo(fee)}).
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Why are you cancelling?"
            placeholderTextColor={colors.ink300}
            multiline
            maxLength={1000}
            className="min-h-[88px] rounded-2xl border border-brand-100 bg-surface px-4 py-3 font-poppins text-body text-ink-900"
            style={{ textAlignVertical: "top" }}
          />
          <Pressable
            onPress={submit}
            disabled={!reason.trim() || submitting}
            className="mt-4 items-center justify-center rounded-2xl bg-danger py-4"
            style={{ opacity: reason.trim() && !submitting ? 1 : 0.5 }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-subtitle text-white">Request cancellation</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
