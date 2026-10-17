import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, PackageCheck } from "lucide-react-native";
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
import * as officePickups from "@/services/officePickups";
import {
  OFFICE_PICKUP_STATUS_STYLE,
  formatKobo,
  type OfficePickupSummary,
} from "@/services/officePickups";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

export default function MyOfficePickupsScreen() {
  useProtectedRoute("/office-pickups");
  const router = useRouter();
  const [requests, setRequests] = useState<OfficePickupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await officePickups.getMine());
    } catch {
      setRequests([]);
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
          <ChevronLeft size={ICON.lg} color={colors.ink700} />
        </Pressable>
        <Text className="font-poppins-bold text-display text-ink-900">
          Office pickups
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 12, flexGrow: 1 }}
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
                <PackageCheck size={ICON.xl} color={colors.brand600} />
              </View>
              <Text className="mt-3 font-poppins-semibold text-subtitle text-ink-900">
                No office pickups yet
              </Text>
              <Text className="mt-1 text-center font-poppins text-caption text-ink-500">
                Tap “Request Office Pickup” on an ad to buy it safely through
                one of our offices.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = OFFICE_PICKUP_STATUS_STYLE[item.status];
            return (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/office-pickups/[id]", params: { id: item.id } })
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
                    <Text className="font-poppins-semibold text-body text-ink-900">
                      {item.reference}
                    </Text>
                    <Text
                      className={`rounded-full px-2 py-0.5 font-poppins-medium text-micro ${status.className}`}
                    >
                      {status.label}
                    </Text>
                  </View>
                  <Text className="font-poppins text-caption text-ink-700" numberOfLines={1}>
                    {item.listingTitle}
                  </Text>
                  <Text className="font-poppins text-micro text-ink-500" numberOfLines={1}>
                    {item.myRole === "Buyer"
                      ? `You're buying · ${formatKobo(item.totalKobo)}`
                      : "You're selling"}{" "}
                    · {item.branchName} · {moment(item.createdAt).fromNow()}
                  </Text>
                </View>
                <ChevronRight size={ICON.sm} color={colors.ink300} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
