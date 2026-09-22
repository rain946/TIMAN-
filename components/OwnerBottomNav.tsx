import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type OwnerTab =
  | "home"
  | "pets"
  | "notifications"
  | "profile";

type OwnerBottomNavProps = {
  activeTab: OwnerTab;
};

export default function OwnerBottomNav({
  activeTab,
}: OwnerBottomNavProps) {
  const navigateTo = (
    tab: OwnerTab,
    route:
      | "/dashboard"
      | "/pets"
      | "/notifications"
      | "/profile"
  ) => {
    // Ayaw pag-open balik sa screen kung active na.
    if (activeTab === tab) {
      return;
    }

    // PUSH para ma-preserve ang previous screen.
    router.push(route);
  };

  return (
    <View style={styles.bottomNav}>
      <NavItem
        icon={
          activeTab === "home"
            ? "home"
            : "home-outline"
        }
        label="Home"
        active={activeTab === "home"}
        onPress={() =>
          navigateTo("home", "/dashboard")
        }
      />

      <NavItem
        icon={
          activeTab === "pets"
            ? "paw"
            : "paw-outline"
        }
        label="Pets"
        active={activeTab === "pets"}
        onPress={() =>
          navigateTo("pets", "/pets")
        }
      />

      <NavItem
        icon={
          activeTab === "notifications"
            ? "notifications"
            : "notifications-outline"
        }
        label="Alerts"
        active={activeTab === "notifications"}
        onPress={() =>
          navigateTo(
            "notifications",
            "/notifications"
          )
        }
      />

      <NavItem
        icon={
          activeTab === "profile"
            ? "person"
            : "person-outline"
        }
        label="Profile"
        active={activeTab === "profile"}
        onPress={() =>
          navigateTo("profile", "/profile")
        }
      />
    </View>
  );
}

function NavItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.navItem,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={23}
        color={
          active
            ? "#176B3A"
            : "#89948E"
        }
      />

      <Text
        style={[
          styles.navText,
          active && styles.activeNavText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E4EAE6",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 5,
  },

  navItem: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
  },

  navText: {
    fontSize: 10,
    color: "#89948E",
    marginTop: 4,
    fontWeight: "600",
  },

  activeNavText: {
    color: "#176B3A",
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.7,
  },
});
