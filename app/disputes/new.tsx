import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  ChevronLeft,
  FileText,
  ImagePlus,
  MessageCircle,
  Paperclip,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
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

import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as disputesService from "@/services/disputes";
import {
  BUYER_REASONS,
  DISPUTE_REASON_LABELS,
  MAX_EVIDENCE_FILES,
  SELLER_REASONS,
  type DisputeReason,
} from "@/services/disputes";
import * as listingsService from "@/services/listings";
import type { LocalFile } from "@/services/me";
import * as messagingService from "@/services/messaging";
import { colors } from "@/theme/colors";
import { compressImage, MAX_EDGE } from "@/utils/photos";
import type { Conversation, ListingDetail } from "@/types/api";
import { ICON } from "@/theme/typography";

const MIN_DESCRIPTION = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function NewDisputeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    listingId: string;
    conversationId?: string;
  }>();
  useProtectedRoute(`/disputes/new?listingId=${params.listingId}`);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    params.conversationId ?? null,
  );
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isSeller = !!listing && listing.seller.userId === user?.id;
  const reasons = isSeller ? SELLER_REASONS : BUYER_REASONS;

  useEffect(() => {
    if (!params.listingId) return;
    listingsService
      .getDetail(params.listingId)
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [params.listingId]);

  // A seller disputes a specific buyer - via their chat about this ad.
  useEffect(() => {
    if (!isSeller || params.conversationId) return;
    messagingService
      .getConversations(1, 100)
      .then((page) =>
        setChats(page.items.filter((c) => c.listingId === params.listingId)),
      )
      .catch(() => setChats([]));
  }, [isSeller, params.conversationId, params.listingId]);

  const canSubmit = useMemo(
    () =>
      !!reason &&
      description.trim().length >= MIN_DESCRIPTION &&
      (!isSeller || !!conversationId) &&
      !submitting,
    [reason, description, isSeller, conversationId, submitting],
  );

  const addFile = (file: LocalFile) =>
    setFiles((prev) => [...prev, file].slice(0, MAX_EVIDENCE_FILES));

  /** Evidence photos are always compressed on the device before upload. */
  const fromImageAsset = (asset: ImagePicker.ImagePickerAsset): Promise<LocalFile> =>
    compressImage(asset, MAX_EDGE.document, "evidence");

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "info",
        text1: "Camera access is needed to take a photo",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0])
      addFile(await fromImageAsset(result.assets[0]));
  };

  const choosePhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_EVIDENCE_FILES - files.length,
    });
    if (!result.canceled)
      (await Promise.all(result.assets.map(fromImageAsset))).forEach(addFile);
  };

  const choosePdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_FILE_BYTES) {
      Toast.show({
        type: "error",
        text1: "That file is over 10MB",
        text2: "Choose a smaller file.",
      });
      return;
    }
    addFile({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/pdf",
      webFile: asset.file,
    });
  };

  const submit = async () => {
    if (!listing || !reason) return;
    setSubmitting(true);
    try {
      const dispute = await disputesService.raiseDispute({
        listingId: listing.id,
        conversationId,
        reason,
        description: description.trim(),
        evidence: files,
      });
      Toast.show({
        type: "success",
        text1: `Dispute ${dispute.reference} opened`,
        text2: "We've told the other party. Our team will review it.",
      });
      router.replace({
        pathname: "/disputes/[id]",
        params: { id: dispute.id },
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't open the dispute",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <ChevronLeft size={ICON.lg} color={colors.ink700} />
        </Pressable>
        <Text className="font-poppins-bold text-display text-ink-900">
          Open a dispute
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : !listing ? (
        <Text className="px-6 pt-6 text-center font-poppins text-body text-ink-500">
          This ad could not be found.
        </Text>
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{
              padding: 24,
              paddingTop: 12,
              gap: 16,
              paddingBottom: 40,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row items-center gap-3 rounded-3xl border border-brand-50 bg-white p-4">
              {listing.mediaUrls[0] ? (
                <Image
                  source={{ uri: listing.mediaUrls[0] }}
                  className="h-14 w-14 rounded-xl bg-brand-50"
                />
              ) : (
                <View className="h-14 w-14 rounded-xl bg-brand-50" />
              )}
              <View className="flex-1">
                <Text
                  className="font-poppins-semibold text-body text-ink-900"
                  numberOfLines={2}
                >
                  {listing.title}
                </Text>
                <Text className="font-poppins text-caption text-ink-500">
                  {isSeller
                    ? "Your ad"
                    : `Sold by ${listing.seller.businessName}`}
                </Text>
              </View>
            </View>

            {isSeller && !params.conversationId ? (
              <View className="rounded-3xl border border-brand-50 bg-white p-5">
                <Text className="font-poppins-semibold text-subtitle text-ink-900">
                  Which buyer?
                </Text>
                <Text className="mb-3 mt-0.5 font-poppins text-caption text-ink-500">
                  Choose your chat with the buyer this is about.
                </Text>
                {chats.length === 0 ? (
                  <Text className="font-poppins text-body text-ink-500">
                    No buyer has chatted with you about this ad yet.
                  </Text>
                ) : (
                  chats.map((chat, index) => {
                    const selected = conversationId === chat.id;
                    return (
                      <Pressable
                        key={chat.id}
                        onPress={() => setConversationId(chat.id)}
                        className={`mb-2 flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${selected ? "border-brand-600 bg-brand-50" : "border-brand-50"}`}
                      >
                        <MessageCircle size={ICON.sm} color={colors.brand600} />
                        <Text className="flex-1 font-poppins-medium text-body text-ink-900">
                          Buyer chat {index + 1}
                        </Text>
                        <Text className="font-poppins text-caption text-ink-500">
                          {new Date(
                            chat.lastMessageAt ?? chat.createdAt,
                          ).toLocaleDateString("en-NG")}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            <View className="rounded-3xl border border-brand-50 bg-white p-5">
              <Text className="mb-3 font-poppins-semibold text-subtitle text-ink-900">
                What went wrong?
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {reasons.map((r) => {
                  const selected = reason === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setReason(r)}
                      className={`rounded-full border px-4 py-2 ${selected ? "border-brand-600 bg-brand-600" : "border-brand-100 bg-white"}`}
                    >
                      <Text
                        className={`font-poppins-medium text-caption ${selected ? "text-white" : "text-ink-700"}`}
                      >
                        {DISPUTE_REASON_LABELS[r]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="rounded-3xl border border-brand-50 bg-white p-5">
              <Text className="font-poppins-semibold text-subtitle text-ink-900">
                Tell us what happened
              </Text>
              <Text className="mb-3 mt-0.5 font-poppins text-caption text-ink-500">
                Include dates, amounts paid and how you paid. The other party
                will see this.
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={2000}
                placeholder="e.g. I paid ₦45,000 by transfer on 12 March and the phone hasn't been delivered."
                placeholderTextColor={colors.ink300}
                className="min-h-[120px] rounded-2xl border border-brand-50 bg-surface px-4 py-3 font-poppins text-body text-ink-900"
                style={{ textAlignVertical: "top" }}
              />
              <Text className="mt-1 text-right font-poppins text-micro text-ink-500">
                {description.trim().length < MIN_DESCRIPTION
                  ? `${MIN_DESCRIPTION - description.trim().length} more characters needed`
                  : `${description.length}/2000`}
              </Text>
            </View>

            <View className="rounded-3xl border border-brand-50 bg-white p-5">
              <Text className="font-poppins-semibold text-subtitle text-ink-900">
                Evidence (optional)
              </Text>
              <Text className="mb-3 mt-0.5 font-poppins text-caption text-ink-500">
                Up to {MAX_EVIDENCE_FILES} photos or PDFs - receipts, transfer
                screenshots, photos of the item.
              </Text>
              {files.length > 0 ? (
                <View className="mb-3 flex-row flex-wrap gap-2">
                  {files.map((file, index) => (
                    <View key={`${file.uri}-${index}`}>
                      {file.type === "application/pdf" ? (
                        <View className="h-20 w-20 items-center justify-center rounded-xl bg-brand-50">
                          <FileText size={ICON.lg} color={colors.brand600} />
                          <Text
                            className="mt-1 px-1 font-poppins text-micro text-ink-500"
                            numberOfLines={1}
                          >
                            {file.name}
                          </Text>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: file.uri }}
                          className="h-20 w-20 rounded-xl bg-brand-50"
                        />
                      )}
                      <Pressable
                        onPress={() =>
                          setFiles((prev) => prev.filter((_, i) => i !== index))
                        }
                        hitSlop={8}
                        accessibilityLabel="Remove file"
                        className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-ink-900"
                      >
                        <X size={ICON.xs} color={colors.white} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {files.length < MAX_EVIDENCE_FILES ? (
                <View className="flex-row gap-2">
                  <EvidenceButton
                    icon={Camera}
                    label="Camera"
                    onPress={takePhoto}
                  />
                  <EvidenceButton
                    icon={ImagePlus}
                    label="Photos"
                    onPress={choosePhotos}
                  />
                  <EvidenceButton
                    icon={Paperclip}
                    label="PDF"
                    onPress={choosePdf}
                  />
                </View>
              ) : null}
            </View>

            <PrimaryButton
              label="Open dispute"
              onPress={submit}
              loading={submitting}
              disabled={!canSubmit}
            />
            <Text className="text-center font-poppins text-micro text-ink-500">
              Our team reviews every dispute and may contact both of you before
              deciding.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function EvidenceButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Camera;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-brand-100 py-3 active:bg-brand-50"
    >
      <Icon size={ICON.sm} color={colors.brand600} />
      <Text className="font-poppins-medium text-caption text-brand-700">
        {label}
      </Text>
    </Pressable>
  );
}
