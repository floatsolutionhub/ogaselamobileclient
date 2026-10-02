import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Check,
  FileText,
  Image as ImageIcon,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ApiError } from "@/lib/apiClient";
import {
  uploadDocument,
  type IdDocumentType,
  type LocalFile,
  type UserDocument,
  type UserDocumentType,
} from "@/services/me";
import { colors } from "@/theme/colors";
import { compressImage, MAX_EDGE, MAX_PDF_BYTES } from "@/utils/photos";

export const ID_TYPE_LABELS: Record<IdDocumentType, string> = {
  NationalIdCard: "National ID card",
  NinSlip: "NIN slip",
  VotersCard: "Voter's card",
  DriversLicence: "Driver's licence",
  InternationalPassport: "International passport",
};

const ID_TYPES = Object.keys(ID_TYPE_LABELS) as IdDocumentType[];

/** Sheet copy for each document type (the ID card also asks for its type and number). */
const COPY: Record<
  UserDocumentType,
  { title: string; hint: string; fileLabel: string; uploaded: string }
> = {
  IdCard: {
    title: "Upload your ID card",
    hint: "Choose the ID type, enter its number and add a clear photo or PDF of it.",
    fileLabel: "Photo or PDF of the ID",
    uploaded: "ID card uploaded",
  },
  UtilityBill: {
    title: "Upload a utility bill",
    hint: "A recent bill (last 3 months) showing your name and address - electricity, water, waste or similar.",
    fileLabel: "Photo or PDF of the bill",
    uploaded: "Utility bill uploaded",
  },
  BusinessRegistration: {
    title: "Upload business registration",
    hint: "Your CAC certificate (or other registration document) showing the business name.",
    fileLabel: "Photo or PDF of the document",
    uploaded: "Business registration uploaded",
  },
  OfficeUtilityBill: {
    title: "Upload proof of office address",
    hint: "A recent utility bill (last 3 months) for your office or shop, showing the business address.",
    fileLabel: "Photo or PDF of the bill",
    uploaded: "Proof of office address uploaded",
  },
};

type DocumentUploadSheetProps = {
  /** null hides the sheet. */
  type: UserDocumentType | null;
  onClose: () => void;
  onUploaded: (document: UserDocument) => void;
};

/**
 * Half-height sheet for uploading an ID card (type + number + file) or any other document (file
 * only): a utility bill, or for sellers a business registration document or office utility bill.
 * The file can be a photo taken now, one from the library, or a PDF/image from Files.
 */
export function DocumentUploadSheet({
  type,
  onClose,
  onUploaded,
}: DocumentUploadSheetProps) {
  const insets = useSafeAreaInsets();
  const [idType, setIdType] = useState<IdDocumentType | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [file, setFile] = useState<LocalFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (type) {
      setIdType(null);
      setIdNumber("");
      setFile(null);
    }
  }, [type]);

  const isIdCard = type === "IdCard";
  const copy = COPY[type ?? "IdCard"];
  const idNumberValid = /^[A-Za-z0-9]{5,20}$/.test(idNumber.trim());
  const canSubmit =
    !!file && !submitting && (!isIdCard || (!!idType && idNumberValid));

  /** Photos are always compressed on the device first (MAX_EDGE.document keeps text readable). */
  const fromImageAsset = (asset: ImagePicker.ImagePickerAsset): Promise<LocalFile> =>
    compressImage(asset, MAX_EDGE.document, "document");

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
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0])
      setFile(await fromImageAsset(result.assets[0]));
  };

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0])
      setFile(await fromImageAsset(result.assets[0]));
  };

  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    // An image picked as a file is compressed like any other photo; PDFs are capped instead.
    if (asset.mimeType?.startsWith("image/")) {
      setFile(await compressImage({ uri: asset.uri, fileName: asset.name }, MAX_EDGE.document, "document"));
      return;
    }
    if (asset.size && asset.size > MAX_PDF_BYTES) {
      Toast.show({
        type: "error",
        text1: "That file is over 10MB",
        text2: "Choose a smaller file.",
      });
      return;
    }
    setFile({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/pdf",
      webFile: asset.file,
    });
  };

  const submit = async () => {
    if (!type || !file) return;
    setSubmitting(true);
    try {
      const document = await uploadDocument({
        type,
        idType: isIdCard ? (idType ?? undefined) : undefined,
        idNumber: isIdCard ? idNumber.trim() : undefined,
        file,
      });
      Toast.show({
        type: "success",
        text1: copy.uploaded,
        text2: "We'll review it shortly.",
      });
      onUploaded(document);
      onClose();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Upload failed",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={type !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(16,24,40,0.45)",
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          className="rounded-t-3xl bg-white pt-5"
          style={{
            minHeight: "50%",
            maxHeight: "88%",
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}
        >
          <View className="mb-1 flex-row items-center justify-between px-6">
            <Text className="font-poppins-semibold text-lg text-ink-900">
              {copy.title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            >
              <X size={18} color={colors.ink700} />
            </Pressable>
          </View>
          <Text className="mb-3 px-6 font-poppins text-xs text-ink-500">
            {copy.hint}
          </Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 24 }}
          >
            {isIdCard ? (
              <>
                <Text className="mb-2 mt-2 font-poppins-medium text-sm text-ink-700">
                  ID type
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {ID_TYPES.map((option) => {
                    const selected = idType === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setIdType(option)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        className={`rounded-full border px-3.5 py-2 ${
                          selected
                            ? "border-brand-600 bg-brand-600"
                            : "border-brand-100 bg-white"
                        }`}
                      >
                        <Text
                          className={`font-poppins-medium text-xs ${selected ? "text-white" : "text-ink-700"}`}
                        >
                          {ID_TYPE_LABELS[option]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text className="mb-1.5 mt-5 font-poppins-medium text-sm text-ink-700">
                  ID number
                </Text>
                <TextInput
                  value={idNumber}
                  onChangeText={(text) =>
                    setIdNumber(text.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
                  }
                  placeholder="As printed on the ID"
                  placeholderTextColor={colors.ink300}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={20}
                  className="rounded-2xl border border-brand-100 bg-surface px-4 py-3.5 font-poppins text-base text-ink-900"
                />
                {idNumber.length > 0 && !idNumberValid ? (
                  <Text className="mt-1 font-poppins text-xs text-danger">
                    Use 5-20 letters or digits.
                  </Text>
                ) : null}
              </>
            ) : null}

            <Text className="mb-2 mt-5 font-poppins-medium text-sm text-ink-700">
              {copy.fileLabel}
            </Text>
            {file ? (
              <View className="flex-row items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3">
                {file.type === "application/pdf" ? (
                  <FileText size={20} color={colors.brand700} />
                ) : (
                  <Check size={20} color={colors.brand700} />
                )}
                <Text
                  className="flex-1 font-poppins-medium text-sm text-ink-900"
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                <Pressable onPress={() => setFile(null)} hitSlop={8}>
                  <Text className="font-poppins-medium text-xs text-brand-700">
                    Change
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <PickButton
                  icon={Camera}
                  label="Take photo"
                  onPress={takePhoto}
                />
                <PickButton
                  icon={ImageIcon}
                  label="Photo library"
                  onPress={choosePhoto}
                />
                <PickButton
                  icon={FileText}
                  label="PDF / Files"
                  onPress={chooseFile}
                />
              </View>
            )}
          </ScrollView>

          <View className="px-6 pt-4">
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
                  Upload
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PickButton({
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
      className="flex-1 items-center gap-1.5 rounded-2xl border border-dashed border-brand-200 bg-surface py-4 active:bg-brand-50"
    >
      <Icon size={20} color={colors.brand600} />
      <Text className="font-poppins-medium text-[11px] text-ink-700">
        {label}
      </Text>
    </Pressable>
  );
}
