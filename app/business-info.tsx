import { Building2, FileBadge, MapPin, Receipt, Store } from "lucide-react-native";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ChangeRequestBanner } from "@/components/ChangeRequestBanner";
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
  const canSubmit = dirty && businessName.trim().length >= 2 && !submitting;

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

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Business Info" />

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
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
          <Text className="font-poppins-semibold text-base text-ink-900">
            Business details
          </Text>
          <Text className="mb-4 mt-0.5 font-poppins text-xs text-ink-500">
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
              <Text className="font-poppins-semibold text-base text-white">
                Submit for approval
              </Text>
            )}
          </Pressable>
        </View>

        {/* Business documents */}
        <View className="overflow-hidden rounded-3xl border border-brand-50 bg-white">
          <View className="flex-row items-start gap-3 px-5 pb-2 pt-5">
            <Building2 size={18} color={colors.brand600} />
            <View className="flex-1">
              <Text className="font-poppins-semibold text-base text-ink-900">
                Business documents
              </Text>
              <Text className="mt-0.5 font-poppins text-xs text-ink-500">
                Upload your registration document and proof of your office
                address. Our team reviews them.
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
                onPress={() => setUploading("BusinessRegistration")}
              />
              <DocumentRow
                icon={Receipt}
                title="Proof of office address"
                document={latest("OfficeUtilityBill")}
                subtitleFor={fileSubtitle}
                onPress={() => setUploading("OfficeUtilityBill")}
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
    </SafeAreaView>
  );
}
