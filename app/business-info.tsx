import {
  BadgeCheck,
  Building2,
  Clock,
  FileBadge,
  FileWarning,
  MapPin,
  Receipt,
  Store,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ChangeRequestBanner } from "@/components/ChangeRequestBanner";
import { DocumentDetailSheet } from "@/components/DocumentDetailSheet";
import { DocumentRow } from "@/components/DocumentRow";
import { DocumentUploadSheet } from "@/components/DocumentUploadSheet";
import { FormField } from "@/components/FormField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as meService from "@/services/me";
import type { ProfileChange, UserDocument, UserDocumentType } from "@/services/me";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

/**
 * Seller business setup: business name and store/office address (changes go to staff for
 * approval and apply once approved), plus the business registration document and proof of
 * office address, which staff review like the personal documents.
 */
export default function BusinessInfoScreen() {
  useProtectedRoute("/business-info");
  const { user, refreshUser } = useAuth();
  const currentName = user?.sellerProfile?.businessName ?? "";
  const currentAddress = user?.sellerProfile?.storeAddress ?? "";

  const [businessName, setBusinessName] = useState(currentName);
  const [storeAddress, setStoreAddress] = useState(currentAddress);
  const [submitting, setSubmitting] = useState(false);
  const [change, setChange] = useState<ProfileChange | undefined>();
  const [cancelling, setCancelling] = useState(false);

  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<UserDocumentType | null>(null);
  const [viewing, setViewing] = useState<{
    document: UserDocument;
    title: string;
    note?: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [changes, docs] = await Promise.all([
      meService.getMyChangeRequests().catch(() => []),
      meService.getMyDocuments().catch(() => []),
      refreshUser().catch(() => {}),
    ]);
    setChange(changes.find((c) => c.type === "BusinessInfo"));
    setDocuments(docs);
    setLoading(false);
  }, [refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setBusinessName(currentName);
    setStoreAddress(currentAddress);
  }, [currentName, currentAddress]);

  const dirty =
    businessName.trim() !== currentName ||
    storeAddress.trim() !== currentAddress;
  // One change at a time: wait for the pending one to be reviewed (or withdraw it).
  const hasPending = change?.status === "PendingReview";
  const canSubmit = dirty && businessName.trim().length >= 2 && !submitting && !hasPending;

  const submit = async () => {
    setSubmitting(true);
    try {
      const created = await meService.submitBusinessInfoChange(
        businessName.trim(),
        storeAddress.trim(),
      );
      setChange(created);
      setBusinessName(currentName);
      setStoreAddress(currentAddress);
      Toast.show({
        type: "success",
        text1: "Sent for approval",
        text2: "We'll notify you once it's reviewed.",
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't submit your changes",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async () => {
    if (!change) return;
    setCancelling(true);
    try {
      await meService.cancelChangeRequest(change.id);
      setChange({ ...change, status: "Cancelled" });
      Toast.show({ type: "success", text1: "Request withdrawn" });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't withdraw the request",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setCancelling(false);
    }
  };

  const latest = (type: UserDocumentType) =>
    documents.find((d) => d.type === type);
  const fileSubtitle = (d: UserDocument) =>
    `${d.fileName} · ${moment(d.createdAt).format("D MMM YYYY")}`;

  // Once the business is verified its documents are locked: they open read-only.
  const isBusinessVerified = !!user?.sellerProfile?.businessVerifiedAt;
  // A rejected upload has to be replaced, so it counts as missing.
  const hasUpload = (type: UserDocumentType) => {
    const document = latest(type);
    return !!document && document.status !== "Rejected";
  };
  const missingDocuments = [
    !hasUpload("BusinessRegistration") && "business registration",
    !hasUpload("OfficeUtilityBill") && "proof of office address",
  ].filter(Boolean);
  const status = isBusinessVerified
    ? {
        Icon: BadgeCheck,
        text: "Business verified - buyers see a verified business badge on your shop and ads.",
        tone: "brand",
      }
    : missingDocuments.length > 0
      ? {
          Icon: FileWarning,
          text: `Awaiting ${missingDocuments.join(" and ")} upload`,
          tone: "gold",
        }
      : { Icon: Clock, text: "Pending approval", tone: "brand" };

  const openDocument = (type: UserDocumentType, title: string) => {
    const document = latest(type);
    // One submission per document at a time: a pending one opens read-only until it's reviewed.
    if (document?.status === "PendingReview") {
      setViewing({ document, title, note: "This document is waiting for review. You can upload a new one once it’s approved or rejected." });
      return;
    }
    if (!isBusinessVerified) {
      setUploading(type);
      return;
    }
    if (document) setViewing({ document, title });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Business Info" />

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? null : (
          <View
            className={`flex-row items-center gap-2 rounded-2xl border px-4 py-3 ${
              status.tone === "gold"
                ? "border-gold-200 bg-gold-50"
                : "border-brand-100 bg-brand-50"
            }`}
          >
            <status.Icon
              size={ICON.md}
              color={status.tone === "gold" ? colors.gold700 : colors.brand600}
            />
            <Text className="flex-shrink font-poppins-medium text-caption text-ink-900">
              {status.text}
            </Text>
          </View>
        )}

        <ChangeRequestBanner
          change={change}
          pendingText={
            change
              ? `${change.businessName ?? ""}${change.storeAddress ? ` · ${change.storeAddress}` : " · no store address"}`
              : ""
          }
          onCancel={withdraw}
          cancelling={cancelling}
        />

        {/* Business details */}
        <View className="rounded-3xl border border-brand-50 bg-white p-5">
          <Text className="font-poppins-semibold text-subtitle text-ink-900">
            Business details
          </Text>
          <Text className="mb-4 mt-0.5 font-poppins text-caption text-ink-500">
            Changes are reviewed by our team before they show on your shop.
          </Text>
          <FormField
            label="Business name"
            icon={Store}
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
            maxLength={200}
          />
          <FormField
            label="Store / office address"
            icon={MapPin}
            value={storeAddress}
            onChangeText={setStoreAddress}
            placeholder="Where buyers can find you (optional)"
            maxLength={300}
          />

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            className="items-center rounded-2xl bg-brand-600 py-4"
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text className="font-poppins-semibold text-subtitle text-white">
                {hasPending ? "Waiting for review" : "Submit for approval"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Business documents */}
        <View className="overflow-hidden rounded-3xl border border-brand-50 bg-white">
          <View className="flex-row items-start gap-3 px-5 pb-2 pt-5">
            <Building2 size={ICON.md} color={colors.brand600} />
            <View className="flex-1">
              <Text className="font-poppins-semibold text-subtitle text-ink-900">
                Business documents
              </Text>
              <Text className="mt-0.5 font-poppins text-caption text-ink-500">
                {isBusinessVerified
                  ? "Verified - tap a document to view it."
                  : "Upload your registration document and proof of your office address. Our team reviews them."}
              </Text>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator
              color={colors.brand600}
              style={{ marginVertical: 20 }}
            />
          ) : (
            <>
              <DocumentRow
                icon={FileBadge}
                title="Business registration"
                document={latest("BusinessRegistration")}
                subtitleFor={fileSubtitle}
                onPress={() =>
                  openDocument("BusinessRegistration", "Business registration")
                }
              />
              <DocumentRow
                icon={Receipt}
                title="Proof of office address"
                document={latest("OfficeUtilityBill")}
                subtitleFor={fileSubtitle}
                onPress={() =>
                  openDocument("OfficeUtilityBill", "Proof of office address")
                }
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
        lockNote={viewing?.note ?? "Your business is verified, so this can no longer be changed."}
        onClose={() => setViewing(null)}
      />
    </SafeAreaView>
  );
}
