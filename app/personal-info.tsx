import { useFocusEffect, useRouter } from "expo-router";
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  CreditCard,
  Lock,
  Mail,
  Phone,
  Receipt,
  ScanFace,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import {
  DocumentUploadSheet,
  ID_TYPE_LABELS,
} from "@/components/DocumentUploadSheet";
import { DocumentDetailSheet } from "@/components/DocumentDetailSheet";
import { DocumentRow } from "@/components/DocumentRow";
import { FormField } from "@/components/FormField";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as meService from "@/services/me";
import type { UserDocument, UserDocumentType } from "@/services/me";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

export default function PersonalInfoScreen() {
  useProtectedRoute("/personal-info");
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploading, setUploading] = useState<UserDocumentType | null>(null);
  const [viewing, setViewing] = useState<{
    document: UserDocument;
    title: string;
    note?: string;
  } | null>(null);

  // Only when the saved name itself changes - refreshUser() on every focus hands back a new user
  // object, and keying off that wiped whatever was being typed.
  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  // Pick up a new profile photo when coming back from face capture.
  useFocusEffect(
    useCallback(() => {
      refreshUser().catch(() => {});
    }, [refreshUser]),
  );

  useEffect(() => {
    meService
      .getMyDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setDocumentsLoading(false));
  }, []);

  const dirty = name.trim() !== (user?.name ?? "");
  const canSave = dirty && name.trim().length > 0 && !saving;

  const save = async () => {
    setSaving(true);
    try {
      await meService.updateProfile({ name: name.trim() });
      await refreshUser();
      Toast.show({ type: "success", text1: "Personal info saved" });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't save your changes",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const latest = (type: UserDocumentType) =>
    documents.find((d) => d.type === type);

  // Once verified, the selfie, ID card and utility bill are locked: documents open read-only.
  const isVerified = user?.sellerProfile?.verificationStatus === "Verified";
  const hasSelfie = !!user?.profilePhotoUrl;
  // A rejected upload has to be replaced, so it counts as missing.
  const hasUpload = (type: UserDocumentType) => {
    const document = latest(type);
    return !!document && document.status !== "Rejected";
  };
  const missingDocuments = [
    !hasUpload("IdCard") && "ID card",
    !hasUpload("UtilityBill") && "utility bill",
  ].filter(Boolean);
  // Everything is in, so there's nothing left to (re)take until the review is done.
  const photoLocked =
    isVerified ||
    (hasSelfie && !documentsLoading && missingDocuments.length === 0);

  const openDocument = (type: UserDocumentType, title: string) => {
    const document = latest(type);
    // One submission per document at a time: a pending one opens read-only until it's reviewed.
    if (document?.status === "PendingReview") {
      setViewing({ document, title, note: "This document is waiting for review. You can upload a new one once it’s approved or rejected." });
      return;
    }
    if (!isVerified) {
      setUploading(type);
      return;
    }
    if (document) setViewing({ document, title });
  };

  const photoCaption = isVerified
    ? "Verified"
    : !hasSelfie
      ? "Tap the camera icon to take a live selfie to complete biometric verification - it must clearly show your face."
      : missingDocuments.length > 0
        ? `Awaiting ${missingDocuments.join(" and ")} upload`
        : "Pending approval";

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
          Personal Info
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile photo */}
        <View className="items-center rounded-3xl border border-brand-50 bg-white p-6">
          <Pressable
            onPress={() => router.push("/face-capture")}
            disabled={photoLocked}
            accessibilityRole={photoLocked ? "image" : "button"}
            accessibilityLabel={
              user?.profilePhotoUrl
                ? "Retake profile photo"
                : "Take profile photo"
            }
          >
            {user?.profilePhotoUrl ? (
              <Image
                source={{ uri: user.profilePhotoUrl }}
                className="h-28 w-28 rounded-full bg-brand-50"
              />
            ) : (
              <View className="h-28 w-28 items-center justify-center rounded-full bg-brand-50">
                <UserRound
                  size={52}
                  color={colors.brand600}
                  strokeWidth={1.5}
                />
              </View>
            )}
            {photoLocked ? null : (
              <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand-600">
                <Camera size={ICON.sm} color={colors.white} />
              </View>
            )}
          </Pressable>
          <Text className="mt-3 font-poppins-semibold text-subtitle text-ink-900">
            Profile photo
          </Text>
          {hasSelfie && !isVerified && documentsLoading ? null : (
            <View
              className={`mt-3 flex-row items-center gap-2 rounded-2xl border px-4 py-2.5 ${
                isVerified
                  ? "border-brand-100 bg-brand-50"
                  : "border-gold-200 bg-gold-50"
              }`}
            >
              {isVerified ? (
                <BadgeCheck size={ICON.md} color={colors.brand600} />
              ) : (
                <ScanFace size={ICON.md} color={colors.gold700} />
              )}
              <Text className="flex-shrink font-poppins-medium text-caption text-ink-900">
                {photoCaption}
              </Text>
            </View>
          )}
        </View>

        {/* Basic information */}
        <View className="rounded-3xl border border-brand-50 bg-white p-5">
          <Text className="mb-4 font-poppins-semibold text-subtitle text-ink-900">
            Basic information
          </Text>
          <FormField
            label="Full name"
            icon={User}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <ReadOnlyField
            icon={Mail}
            label="Email address"
            value={user?.email}
          />
          <ReadOnlyField
            icon={Phone}
            label="Phone number"
            value={user?.phone}
          />
          <Text className="mb-4 font-poppins text-micro text-ink-500">
            To change your email or phone, go to Settings - changes are
            reviewed before they take effect.
          </Text>

          <Pressable
            onPress={save}
            disabled={!canSave}
            className="items-center rounded-2xl bg-brand-600 py-4"
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text className="font-poppins-semibold text-subtitle text-white">
                Save changes
              </Text>
            )}
          </Pressable>
        </View>

        {/* Documents */}
        <View className="overflow-hidden rounded-3xl border border-brand-50 bg-white">
          <View className="px-5 pb-2 pt-5">
            <Text className="font-poppins-semibold text-subtitle text-ink-900">
              Documents
            </Text>
            <Text className="mt-0.5 font-poppins text-caption text-ink-500">
              {isVerified
                ? "Verified - tap a document to view it."
                : "Upload your ID and proof of address. Our team reviews them."}
            </Text>
          </View>
          {documentsLoading ? (
            <ActivityIndicator
              color={colors.brand600}
              style={{ marginVertical: 20 }}
            />
          ) : (
            <>
              <DocumentRow
                icon={CreditCard}
                title="ID Card"
                document={latest("IdCard")}
                subtitleFor={(d) =>
                  `${d.idType ? ID_TYPE_LABELS[d.idType] : "ID"} · ${d.idNumber ?? ""} · ${moment(d.createdAt).format("D MMM YYYY")}`
                }
                onPress={() => openDocument("IdCard", "ID Card")}
              />
              <DocumentRow
                icon={Receipt}
                title="Utility Bill"
                document={latest("UtilityBill")}
                subtitleFor={(d) =>
                  `${d.fileName} · ${moment(d.createdAt).format("D MMM YYYY")}`
                }
                onPress={() => openDocument("UtilityBill", "Utility Bill")}
                last
              />
            </>
          )}
        </View>
      </ScrollView>

      <DocumentUploadSheet
        type={uploading}
        onClose={() => setUploading(null)}
        onUploaded={(document) => setDocuments((prev) => [document, ...prev])}
      />
      <DocumentDetailSheet
        document={viewing?.document ?? null}
        title={viewing?.title ?? ""}
        lockNote={viewing?.note}
        onClose={() => setViewing(null)}
      />
    </SafeAreaView>
  );
}

function ReadOnlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-poppins-medium text-body text-ink-700">
        {label}
      </Text>
      <View className="flex-row items-center rounded-2xl border border-brand-50 bg-surface px-4 py-3.5">
        <Icon size={ICON.md} color={colors.ink300} style={{ marginRight: 10 }} />
        <Text
          className="flex-1 font-poppins text-subtitle text-ink-500"
          numberOfLines={1}
        >
          {value || "Not set"}
        </Text>
        <Lock size={ICON.sm} color={colors.ink300} />
      </View>
    </View>
  );
}
