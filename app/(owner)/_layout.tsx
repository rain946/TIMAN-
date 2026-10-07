import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export default function OwnerTabsLayout() {
  const { width } = useWindowDimensions();
  const compact = width < 360;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarShowLabel: false,

        tabBarStyle: [styles.tabBar, compact && styles.compactTabBar],

        tabBarItemStyle: [styles.tabBarItem, compact && styles.compactTabBarItem],

        sceneStyle: {
          backgroundColor: "#FFF5E9",
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
}: {
  focused: boolean;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.tabItemContent}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={23}
        color={focused ? "#2E7D6B" : "#6B7C73"}
      />

      <Text style={[styles.tabText, focused && styles.activeTabText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 78,
    backgroundColor: "#FFFFFF",

    borderTopWidth: 1,
    borderTopColor: "#CFE8DD",

    paddingTop: 5,

    paddingBottom: Platform.OS === "android" ? 5 : 8,

    elevation: 8,

    shadowColor: "#2E7D6B",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
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

  tabText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7C73",
  },

  activeTabText: {
    color: "#2E7D6B",
    fontWeight: "800",
  },
});
