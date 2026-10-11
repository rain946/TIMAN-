import { router, Tabs, usePathname } from "expo-router";
import { Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { timanColors } from "../../../components/timan/theme";
import { useUnreadNotificationCount } from "../../../hooks/useUnreadNotificationCount";

import {
  ClinicScanTabButton,
  ClinicTabItem,
  clinicBottomNavStyles,
} from "../../../components/navigation/ClinicBottomNav";

export default function ClinicTabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const webWide = Platform.OS === "web" && width >= 768;
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 10 : 8,
  );
  const tabBarHeight = compact ? 76 : 80;
  const tabItemHeight = compact ? 64 : 68;
  const pathname = usePathname();
  const unreadCount = useUnreadNotificationCount(pathname);

  return (
    <Tabs
      backBehavior="history"
      initialRouteName="clinic-dashboard"
      screenOptions={{
        headerShown: false,
        sceneStyle: [styles.scene, webWide && styles.webScene],
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: timanColors.primary,
        tabBarInactiveTintColor: timanColors.muted,
        tabBarLabelStyle: clinicBottomNavStyles.tabLabel,
        tabBarStyle: [
          clinicBottomNavStyles.tabBar,
          {
            bottom: bottomInset,
            height: tabBarHeight,
          },
          webWide && styles.webTabBar,
        ],
        tabBarItemStyle: [
          clinicBottomNavStyles.tabBarItem,
          { height: tabItemHeight },
        ],
      }}
    >
      <Tabs.Screen
        name="clinic-dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <ClinicTabItem
              focused={focused}
              activeIcon="home"
              inactiveIcon="home-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="clinic-schedule-tab"
        options={{
          title: "Schedules",
          tabBarLabel: "Schedule",
          tabBarIcon: ({ focused }) => (
            <ClinicTabItem
              focused={focused}
              activeIcon="calendar"
              inactiveIcon="calendar-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push("/(scanner)/qr-scanner");
          },
        }}
        options={{
          title: "Scan",
          tabBarButton: (props) => <ClinicScanTabButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="vet-records"
        options={{
          title: "Records",
          href: null,
        }}
      />

      <Tabs.Screen
        name="clinic-notifications"
        options={{
          title: "Notifications",
          tabBarLabel: "Alerts",
          tabBarIcon: ({ focused }) => (
            <ClinicTabItem
              focused={focused}
              activeIcon="notifications"
              inactiveIcon="notifications-outline"
              badgeCount={unreadCount}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="clinic-profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <ClinicTabItem
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

const styles = StyleSheet.create({
  scene: {
    backgroundColor: timanColors.cream,
  },
  webScene: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },
  webTabBar: {
    left: undefined,
    right: undefined,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: timanColors.lightMint,
    borderRightColor: timanColors.lightMint,
  },
});
