import moment from "moment";
import { ExternalLink, FileText, Lock, X } from "lucide-react-native";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DOCUMENT_STATUS_STYLE } from "@/components/DocumentRow";
import { ID_TYPE_LABELS } from "@/components/DocumentUploadSheet";
import type { UserDocument } from "@/services/me";
import { colors } from "@/theme/colors";

type DocumentDetailSheetProps = {
  /** null hides the sheet. */
  document: UserDocument | null;
  title: string;
  /** Why it's read-only. */
  lockNote?: string;
  onClose: () => void;
};

/** Read-only view of an uploaded document - shown once the account is verified and its files are locked. */
export function DocumentDetailSheet({
  document,
  title,
  lockNote = "Your account is verified, so this can no longer be changed.",
  onClose,
}: DocumentDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const status = document ? DOCUMENT_STATUS_STYLE[document.status] : null;
  const isImage = document?.contentType.startsWith("image/") ?? false;

  return (
    <Modal
      visible={document !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
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
            maxHeight: "88%",
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}
        >
          <View className="mb-1 flex-row items-center justify-between px-6">
            <View className="flex-row items-center gap-2">
              <Text className="font-poppins-semibold text-lg text-ink-900">
                {title}
              </Text>
              {status ? (
                <Text
                  className={`rounded-full px-2 py-0.5 font-poppins-medium text-[10px] ${status.className}`}
                >
                  {status.label}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            >
              <X size={18} color={colors.ink700} />
            </Pressable>
          </View>
          <View className="mb-3 flex-row items-center gap-1.5 px-6">
            <Lock size={12} color={colors.ink500} />
            <Text className="font-poppins text-xs text-ink-500">
              {lockNote}
            </Text>
          </View>

          {document ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
              {document.idType ? (
                <DetailRow
                  label="ID type"
                  value={ID_TYPE_LABELS[document.idType]}
                />
              ) : null}
              {document.idNumber ? (
                <DetailRow label="ID number" value={document.idNumber} />
              ) : null}
              <DetailRow label="File" value={document.fileName} />
              <DetailRow
                label="Uploaded"
                value={moment(document.createdAt).format("D MMM YYYY")}
              />

              {isImage ? (
                <Image
                  source={{ uri: document.fileUrl }}
                  resizeMode="contain"
                  className="mt-4 h-64 w-full rounded-2xl bg-surface"
                />
              ) : (
                <Pressable
                  onPress={() => Linking.openURL(document.fileUrl)}
                  accessibilityRole="link"
                  className="mt-4 flex-row items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3"
                >
                  <FileText size={20} color={colors.brand700} />
                  <Text className="flex-1 font-poppins-medium text-sm text-ink-900">
                    Open file
                  </Text>
                  <ExternalLink size={16} color={colors.brand700} />
                </Pressable>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-brand-50 py-3">
      <Text className="font-poppins text-sm text-ink-500">{label}</Text>
      <Text
        className="ml-4 flex-shrink font-poppins-medium text-sm text-ink-900"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
