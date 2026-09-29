import { router, Tabs } from "expo-router";
import { Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const bottomInset = Math.max(insets.bottom, 6);

  return (
    <Tabs
      backBehavior="history"
      initialRouteName="clinic-dashboard"
      screenOptions={{
        headerShown: false,
        sceneStyle: [styles.scene, webWide && styles.webScene],
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarStyle: [
          clinicBottomNavStyles.tabBar,
          {
            height: (compact ? 66 : 72) + bottomInset,
            paddingBottom: bottomInset,
          },
          webWide && styles.webTabBar,
        ],
        tabBarItemStyle: clinicBottomNavStyles.tabBarItem,
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
              label="Home"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="clinic-schedule-tab"
        options={{
          title: "Schedules",
          tabBarIcon: ({ focused }) => (
            <ClinicTabItem
              focused={focused}
              activeIcon="calendar"
              inactiveIcon="calendar-outline"
              label="Schedule"
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
          tabBarIcon: ({ focused }) => (
            <ClinicTabItem
              focused={focused}
              activeIcon="document-text"
              inactiveIcon="document-text-outline"
              label="Records"
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
              label="Profile"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: "#FFFDF7",
  },
  webScene: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },
  webTabBar: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: "#E4EAE6",
    borderRightColor: "#E4EAE6",
  },
});
