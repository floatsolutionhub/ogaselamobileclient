import { Tabs, useRouter } from "expo-router";
import { Heart, Home, MessageCircle, PlusCircle, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useUnreadMessages } from "@/context/UnreadMessagesContext";
import { colors } from "@/theme/colors";
import { FONT, TYPE } from "@/theme/typography";

function useGuardedTabPress(redirect: string) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  return (e: { preventDefault: () => void }) => {
    if (!isAuthenticated) {
      e.preventDefault();
      router.push({ pathname: "/(modals)/sign-in", params: { redirect } });
    }
  };
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnreadMessages();

  const guardFavourites = useGuardedTabPress("/(app)/favourites");
  const guardPost = useGuardedTabPress("/(app)/post");
  const guardMessages = useGuardedTabPress("/(app)/messages");
  const guardProfile = useGuardedTabPress("/(app)/profile");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.ink300,
        tabBarLabelStyle: { fontFamily: FONT.medium, fontSize: TYPE.micro.fontSize },
        tabBarStyle: {
          borderTopColor: colors.brand50,
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
        listeners={{ tabPress: guardFavourites }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post",
          tabBarIcon: ({ color, size }) => <PlusCircle color={color} size={size} />,
        }}
        listeners={{ tabPress: guardPost }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge:
            unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            fontFamily: FONT.semibold,
            fontSize: 11,
          },
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} />
          ),
        }}
        listeners={{ tabPress: guardMessages }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
        listeners={{ tabPress: guardProfile }}
      />
    </Tabs>
  );
}
