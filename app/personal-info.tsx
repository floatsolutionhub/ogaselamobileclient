import { useFocusEffect, useRouter } from "expo-router";
import {
  Camera,
  ChevronLeft,
  CreditCard,
  Lock,
  Mail,
  Phone,
  Receipt,
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
import { DocumentRow } from "@/components/DocumentRow";
import { FormField } from "@/components/FormField";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as meService from "@/services/me";
import type { UserDocument, UserDocumentType } from "@/services/me";
import { colors } from "@/theme/colors";

export default function PersonalInfoScreen() {
  useProtectedRoute("/personal-info");
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploading, setUploading] = useState<UserDocumentType | null>(null);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user]);

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
          <ChevronLeft size={20} color={colors.ink700} />
        </Pressable>
        <Text className="font-poppins-bold text-2xl text-ink-900">
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
            accessibilityRole="button"
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
            <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand-600">
              <Camera size={16} color={colors.white} />
            </View>
          </Pressable>
          <Text className="mt-3 font-poppins-semibold text-base text-ink-900">
            Profile photo
          </Text>
          <Text className="mt-0.5 text-center font-poppins text-xs text-ink-500">
            {user?.profilePhotoUrl
              ? "Tap to retake it with face capture."
              : "Tap to take one with face capture - it must clearly show your face."}
          </Text>
        </View>

        {/* Basic information */}
        <View className="rounded-3xl border border-brand-50 bg-white p-5">
          <Text className="mb-4 font-poppins-semibold text-base text-ink-900">
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
          <Text className="mb-4 font-poppins text-[11px] text-ink-500">
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
              <Text className="font-poppins-semibold text-base text-white">
                Save changes
              </Text>
            )}
          </Pressable>
        </View>

        {/* Documents */}
        <View className="overflow-hidden rounded-3xl border border-brand-50 bg-white">
          <View className="px-5 pb-2 pt-5">
            <Text className="font-poppins-semibold text-base text-ink-900">
              Documents
            </Text>
            <Text className="mt-0.5 font-poppins text-xs text-ink-500">
              Upload your ID and proof of address. Our team reviews them.
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
                onPress={() => setUploading("IdCard")}
              />
              <DocumentRow
                icon={Receipt}
                title="Utility Bill"
                document={latest("UtilityBill")}
                subtitleFor={(d) =>
                  `${d.fileName} · ${moment(d.createdAt).format("D MMM YYYY")}`
                }
                onPress={() => setUploading("UtilityBill")}
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
      <Text className="mb-1.5 font-poppins-medium text-sm text-ink-700">
        {label}
      </Text>
      <View className="flex-row items-center rounded-2xl border border-brand-50 bg-surface px-4 py-3.5">
        <Icon size={18} color={colors.ink300} style={{ marginRight: 10 }} />
        <Text
          className="flex-1 font-poppins text-base text-ink-500"
          numberOfLines={1}
        >
          {value || "Not set"}
        </Text>
        <Lock size={14} color={colors.ink300} />
      </View>
    </View>
  );
}
