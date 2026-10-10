import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, usePathname } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL } from "../../config/api";
import {
  timanColors,
  timanRadii,
  timanShadow,
} from "../../components/timan/theme";

export default function OwnerTabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 10 : 8,
  );
  const tabBarHeight = compact ? 76 : 80;
  const tabItemHeight = compact ? 64 : 68;
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        setUnreadCount(0);
        return;
      }

      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setUnreadCount(Math.max(0, Number(data.unreadCount) || 0));
      }
    } catch (error) {
      console.log("LOAD UNREAD NOTIFICATION COUNT ERROR:", error);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
  }, [loadUnreadCount, pathname]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarHideOnKeyboard: true,

        tabBarShowLabel: true,

        tabBarActiveTintColor: timanColors.primary,

        tabBarInactiveTintColor: timanColors.muted,

        tabBarLabelStyle: styles.tabLabel,

        tabBarStyle: [
          styles.tabBar,
          {
            bottom: bottomInset,
            height: tabBarHeight,
          },
        ],

        tabBarItemStyle: [styles.tabBarItem, { height: tabItemHeight }],

        sceneStyle: {
          backgroundColor: timanColors.cream,
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",

          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon="home"
              inactiveIcon="home-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="pets"
        options={{
          title: "Pets",

          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon="paw"
              inactiveIcon="paw-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notification",
          tabBarLabel: "Notification",

          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon="notifications"
              inactiveIcon="notifications-outline"
              badgeCount={unreadCount}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",

          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon="person"
              inactiveIcon="person-outline"
            />
          ),
        }}
      />
    </Tabs>
  );
}

function TabItem({
  focused,
  activeIcon,
  inactiveIcon,
  badgeCount = 0,
}: {
  focused: boolean;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
}) {
  return (
    <View style={styles.iconContainer}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={23}
        color={focused ? timanColors.primary : timanColors.muted}
      />

      {badgeCount > 0 ? (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    width: undefined,
    maxWidth: 640,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: timanRadii.large,
    backgroundColor: timanColors.white,

    borderWidth: 1,
    borderColor: timanColors.lightMint,

    overflow: "visible",
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 6,

    ...timanShadow,
  },

  tabBarItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },

  iconContainer: {
    position: "relative",
    width: 28,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationBadge: {
    position: "absolute",
    top: -9,
    right: -13,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: timanColors.danger,
    borderWidth: 2,
    borderColor: timanColors.white,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationBadgeText: {
    color: timanColors.white,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
  },

  tabLabel: {
    textAlign: "center",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 1,
  },
});
