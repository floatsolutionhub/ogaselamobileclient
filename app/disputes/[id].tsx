import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  FileText,
  ImagePlus,
  Scale,
  Send,
  ShieldCheck,
  X,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as disputesService from "@/services/disputes";
import {
  DISPUTE_REASON_LABELS,
  type DisputeDetail,
  type DisputeEvidence,
  type DisputeOutcome,
} from "@/services/disputes";
import type { LocalFile } from "@/services/me";
import { colors } from "@/theme/colors";
import { compressImage, MAX_EDGE } from "@/utils/photos";
import { DISPUTE_STATUS_STYLE } from "@/utils/disputes";

/** Outcome from the reader's side - the API's outcome is relative to who raised it. */
function outcomeText(
  outcome: DisputeOutcome | null,
  myRole: "Raiser" | "Respondent",
): string {
  switch (outcome) {
    case "InFavourOfRaiser":
      return myRole === "Raiser"
        ? "Resolved in your favour"
        : "Resolved in the other party's favour";
    case "InFavourOfRespondent":
      return myRole === "Respondent"
        ? "Resolved in your favour"
        : "Resolved in the other party's favour";
    case "MutualAgreement":
      return "Settled by mutual agreement";
    case "Dismissed":
      return "Dismissed";
    default:
      return "Resolved";
  }
}

function EvidenceThumb({
  evidence,
  size = 72,
}: {
  evidence: DisputeEvidence;
  size?: number;
}) {
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(evidence.url)}
      accessibilityLabel="Open attachment"
    >
      {evidence.isPdf ? (
        <View
          className="items-center justify-center rounded-xl bg-brand-50"
          style={{ width: size, height: size }}
        >
          <FileText size={20} color={colors.brand600} />
          <Text className="mt-0.5 font-poppins text-[10px] text-ink-500">
            PDF
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: evidence.url }}
          className="rounded-xl bg-brand-50"
          style={{ width: size, height: size }}
        />
      )}
    </Pressable>
  );
}

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useProtectedRoute(`/disputes/${id}`);
  const router = useRouter();

  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<LocalFile | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDispute(await disputesService.getDispute(id));
    } catch {
      setDispute(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    const asset = result.canceled ? null : result.assets[0];
    // Always compressed on the device before upload.
    if (asset) setAttachment(await compressImage(asset, MAX_EDGE.document, "evidence"));
  };

  const send = async () => {
    if (!dispute || !reply.trim() || sending) return;
    setSending(true);
    try {
      const message = await disputesService.replyToDispute(
        dispute.summary.id,
        reply.trim(),
        attachment,
      );
      setDispute((prev) =>
        prev ? { ...prev, messages: [...prev.messages, message] } : prev,
      );
      setReply("");
      setAttachment(null);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Reply not sent",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  const summary = dispute?.summary;
  const isResolved = summary?.status === "Resolved";

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-4">
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/disputes")
          }
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <ChevronLeft size={20} color={colors.ink700} />
        </Pressable>
        <Text
          className="flex-1 font-poppins-bold text-2xl text-ink-900"
          numberOfLines={1}
        >
          {summary?.reference ?? "Dispute"}
        </Text>
        {summary ? (
          <Text
            className={`rounded-full px-2.5 py-1 font-poppins-medium text-[11px] ${DISPUTE_STATUS_STYLE[summary.status].className}`}
          >
            {DISPUTE_STATUS_STYLE[summary.status].label}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : !dispute || !summary ? (
        <Text className="px-6 pt-6 text-center font-poppins text-sm text-ink-500">
          This dispute could not be found.
        </Text>
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {isResolved ? (
              <View className="rounded-3xl border border-brand-100 bg-brand-50 p-5">
                <View className="flex-row items-center gap-2">
                  <ShieldCheck size={18} color={colors.brand600} />
                  <Text className="font-poppins-semibold text-base text-brand-700">
                    {outcomeText(summary.outcome, summary.myRole)}
                  </Text>
                </View>
                {dispute.resolutionNote ? (
                  <Text className="mt-2 font-poppins text-sm text-ink-700">
                    {dispute.resolutionNote}
                  </Text>
                ) : null}
                {dispute.resolvedAt ? (
                  <Text className="mt-2 font-poppins text-[11px] text-ink-500">
                    {moment(dispute.resolvedAt).format("D MMM YYYY, h:mm a")}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View className="flex-row gap-3 rounded-3xl border border-gold-100 bg-gold-50 p-4">
                <Scale size={18} color={colors.gold700} />
                <Text className="flex-1 font-poppins text-xs text-ink-700">
                  {summary.status === "Open"
                    ? "Our team will pick this up shortly. Add anything that helps - both of you can reply here."
                    : "Our team is reviewing this dispute. Reply here with anything they ask for."}
                </Text>
              </View>
            )}

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/listing/[id]",
                  params: { id: summary.listingId },
                })
              }
              className="flex-row items-center gap-3 rounded-3xl border border-brand-50 bg-white p-4"
            >
              {summary.listingThumbnailUrl ? (
                <Image
                  source={{ uri: summary.listingThumbnailUrl }}
                  className="h-14 w-14 rounded-xl bg-brand-50"
                />
              ) : (
                <View className="h-14 w-14 rounded-xl bg-brand-50" />
              )}
              <View className="flex-1">
                <Text
                  className="font-poppins-semibold text-sm text-ink-900"
                  numberOfLines={2}
                >
                  {summary.listingTitle}
                </Text>
                <Text className="font-poppins text-xs text-ink-500">
                  {summary.myRole === "Raiser"
                    ? "You opened this against"
                    : "Opened by"}{" "}
                  {summary.otherPartyName}
                </Text>
              </View>
            </Pressable>

            <View className="rounded-3xl border border-brand-50 bg-white p-5">
              <Text className="font-poppins-semibold text-sm text-ink-900">
                {DISPUTE_REASON_LABELS[summary.reason]}
              </Text>
              <Text className="mt-0.5 font-poppins text-[11px] text-ink-500">
                {summary.myRole === "Raiser" ? "You" : summary.otherPartyName} ·{" "}
                {moment(summary.createdAt).format("D MMM YYYY")}
              </Text>
              <Text className="mt-3 font-poppins text-sm text-ink-700">
                {dispute.description}
              </Text>
              {dispute.evidence.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {dispute.evidence.map((e) => (
                    <EvidenceThumb key={e.url} evidence={e} />
                  ))}
                </View>
              ) : null}
            </View>

            <View className="gap-3">
              <Text className="font-poppins-semibold text-base text-ink-900">
                Replies
              </Text>
              {dispute.messages.length === 0 ? (
                <Text className="font-poppins text-xs text-ink-500">
                  No replies yet.
                </Text>
              ) : (
                dispute.messages.map((m) => {
                  const mine = m.authorRole === summary.myRole;
                  const staff = m.authorRole === "Staff";
                  return (
                    <View
                      key={m.id}
                      className={`max-w-[85%] ${mine ? "self-end" : "self-start"}`}
                    >
                      <View
                        className={`rounded-2xl px-4 py-3 ${staff ? "border border-brand-100 bg-brand-50" : mine ? "bg-brand-600" : "bg-white"}`}
                      >
                        {staff ? (
                          <Text className="mb-1 font-poppins-semibold text-[11px] text-brand-700">
                            {m.authorName}
                          </Text>
                        ) : null}
                        <Text
                          className={`font-poppins text-sm ${mine && !staff ? "text-white" : "text-ink-900"}`}
                        >
                          {m.body}
                        </Text>
                        {m.attachment ? (
                          <View className="mt-2">
                            <EvidenceThumb evidence={m.attachment} size={96} />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        className={`mt-1 font-poppins text-[10px] text-ink-500 ${mine ? "text-right" : ""}`}
                      >
                        {mine ? "You" : staff ? "" : m.authorName}{" "}
                        {moment(m.createdAt).fromNow()}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {!isResolved ? (
            <View className="border-t border-brand-50 bg-white px-4 py-3">
              {attachment ? (
                <View className="mb-2 flex-row items-center gap-2">
                  <Image
                    source={{ uri: attachment.uri }}
                    className="h-12 w-12 rounded-lg bg-brand-50"
                  />
                  <Pressable
                    onPress={() => setAttachment(null)}
                    hitSlop={8}
                    accessibilityLabel="Remove attachment"
                  >
                    <X size={16} color={colors.ink500} />
                  </Pressable>
                </View>
              ) : null}
              <View className="flex-row items-end gap-2">
                <Pressable
                  onPress={pickAttachment}
                  accessibilityLabel="Attach a photo"
                  className="h-11 w-11 items-center justify-center rounded-full bg-surface"
                >
                  <ImagePlus size={18} color={colors.brand600} />
                </Pressable>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  multiline
                  maxLength={2000}
                  placeholder="Reply to this dispute"
                  placeholderTextColor={colors.ink300}
                  className="max-h-28 flex-1 rounded-2xl bg-surface px-4 py-3 font-poppins text-sm text-ink-900"
                />
                <Pressable
                  onPress={send}
                  disabled={!reply.trim() || sending}
                  accessibilityLabel="Send reply"
                  className="h-11 w-11 items-center justify-center rounded-full bg-brand-600"
                  style={{ opacity: reply.trim() && !sending ? 1 : 0.5 }}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Send size={18} color={colors.white} />
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
