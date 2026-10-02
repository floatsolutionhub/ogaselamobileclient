import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Scale } from "lucide-react-native";
import moment from "moment";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import * as disputesService from "@/services/disputes";
import {
  DISPUTE_REASON_LABELS,
  type DisputeSummary,
} from "@/services/disputes";
import { DISPUTE_STATUS_STYLE } from "@/utils/disputes";
import { colors } from "@/theme/colors";

export default function MyDisputesScreen() {
  useProtectedRoute("/disputes");
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setDisputes(await disputesService.getMyDisputes());
    } catch {
      setDisputes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
          Disputes
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 24,
            paddingTop: 12,
            gap: 12,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.brand600}
            />
          }
          ListEmptyComponent={
            <View className="items-center rounded-3xl border border-brand-50 bg-white px-6 py-10">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                <Scale size={24} color={colors.brand600} />
              </View>
              <Text className="mt-3 font-poppins-semibold text-base text-ink-900">
                No disputes
              </Text>
              <Text className="mt-1 text-center font-poppins text-xs text-ink-500">
                If a deal goes wrong, open a dispute from the ad or your chat
                with the other person.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = DISPUTE_STATUS_STYLE[item.status];
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/disputes/[id]",
                    params: { id: item.id },
                  })
                }
                className="flex-row items-center gap-3 rounded-3xl border border-brand-50 bg-white p-4 active:bg-brand-50"
              >
                {item.listingThumbnailUrl ? (
                  <Image
                    source={{ uri: item.listingThumbnailUrl }}
                    className="h-14 w-14 rounded-xl bg-brand-50"
                  />
                ) : (
                  <View className="h-14 w-14 rounded-xl bg-brand-50" />
                )}
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-poppins-semibold text-sm text-ink-900">
                      {item.reference}
                    </Text>
                    <Text
                      className={`rounded-full px-2 py-0.5 font-poppins-medium text-[10px] ${status.className}`}
                    >
                      {status.label}
                    </Text>
                  </View>
                  <Text
                    className="font-poppins text-xs text-ink-700"
                    numberOfLines={1}
                  >
                    {item.listingTitle}
                  </Text>
                  <Text
                    className="font-poppins text-[11px] text-ink-500"
                    numberOfLines={1}
                  >
                    {DISPUTE_REASON_LABELS[item.reason]} ·{" "}
                    {item.myRole === "Raiser" ? "against" : "raised by"}{" "}
                    {item.otherPartyName} · {moment(item.createdAt).fromNow()}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.ink300} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
