import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function OwnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarShowLabel: false,

        tabBarStyle: styles.tabBar,

        tabBarItemStyle: styles.tabBarItem,

        sceneStyle: {
          backgroundColor: "#FFFDF7",
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
        name={
          focused
            ? activeIcon
            : inactiveIcon
        }
        size={23}
        color={
          focused
            ? "#176B3A"
            : "#89948E"
        }
      />

      <Text
        style={[
          styles.tabText,
          focused && styles.activeTabText,
        ]}
      >
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
    borderTopColor: "#E4EAE6",

    paddingTop: 5,

    paddingBottom:
      Platform.OS === "android" ? 5 : 8,

    elevation: 0,

    shadowOpacity: 0,
  },

  tabBarItem: {
    height: 68,
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
    color: "#89948E",
  },

  activeTabText: {
    color: "#176B3A",
    fontWeight: "800",
  },
});
