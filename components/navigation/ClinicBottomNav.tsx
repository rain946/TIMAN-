import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ClinicTabItemProps = {
  activeIcon: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function ClinicTabItem({
  activeIcon,
  focused,
  inactiveIcon,
  label,
}: ClinicTabItemProps) {
  const color = focused ? "#243B53" : "#7C858D";

  return (
    <View style={styles.tabItemContent}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={23}
        color={color}
      />
      <Text
        numberOfLines={1}
        style={[styles.tabText, focused && styles.activeTabText]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ClinicScanTabButton({
  accessibilityLabel,
  accessibilityState,
  onLongPress,
  onPress,
  testID,
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      hitSlop={4}
      onLongPress={onLongPress}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.scanTabButton,
        pressed && styles.scanTabButtonPressed,
      ]}
    >
      <View style={styles.scanButtonCircle}>
        <Ionicons name="scan" size={29} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

export const clinicBottomNavStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E6E9ED",
    borderTopWidth: 1,
    elevation: 8,
    overflow: "visible",
    paddingTop: 6,
    shadowColor: "#243B53",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  tabBarItem: {
    height: 66,
  },
});

const styles = StyleSheet.create({
  tabItemContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  scanTabButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    transform: [{ translateY: -17 }],
  },
  scanTabButtonPressed: {
    opacity: 0.78,
  },
  scanButtonCircle: {
    alignItems: "center",
    backgroundColor: "#243B53",
    borderRadius: 30,
    elevation: 6,
    height: 60,
    justifyContent: "center",
    shadowColor: "#243B53",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 60,
  },
  tabText: {
    color: "#7C858D",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 2,
  },
  activeTabText: {
    color: "#243B53",
    fontWeight: "800",
  },
});
