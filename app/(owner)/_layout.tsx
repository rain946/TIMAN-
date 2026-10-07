import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, usePathname } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { API_URL } from "../../config/api";
import {
  timanColors,
  timanRadii,
  timanShadow,
} from "../../components/timan/theme";

export default function OwnerTabsLayout() {
  const { width } = useWindowDimensions();
  const compact = width < 360;
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

        tabBarShowLabel: false,

        tabBarStyle: [styles.tabBar, compact && styles.compactTabBar],

        tabBarItemStyle: [styles.tabBarItem, compact && styles.compactTabBarItem],

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
              label="Home"
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
              label="Pets"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",

          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon="notifications"
              inactiveIcon="notifications-outline"
              label="Alerts"
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
              label="Profile"
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
  label,
  badgeCount = 0,
}: {
  focused: boolean;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  badgeCount?: number;
}) {
  return (
    <View style={styles.tabItemContent}>
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

      <Text style={[styles.tabText, focused && styles.activeTabText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 78,
    marginHorizontal: 12,
    marginBottom: Platform.OS === "android" ? 8 : 4,
    borderRadius: timanRadii.large,
    backgroundColor: timanColors.white,

    borderWidth: 1,
    borderColor: timanColors.lightMint,

    paddingTop: 5,

    paddingBottom: Platform.OS === "android" ? 5 : 8,

    ...timanShadow,
  },

  tabBarItem: {
    height: 68,
  },

  compactTabBar: {
    height: 70,
    paddingTop: 2,
  },

  compactTabBarItem: {
    height: 62,
  },

  tabItemContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  iconContainer: {
    position: "relative",
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

  tabText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: timanColors.muted,
  },

  activeTabText: {
    color: timanColors.primary,
    fontWeight: "800",
  },
});
