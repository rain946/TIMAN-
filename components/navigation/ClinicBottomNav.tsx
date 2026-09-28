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
  const color = focused ? "#176B3A" : "#89948E";

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
    backgroundColor: "#FFFEFA",
    borderTopColor: "#E4EAE6",
    borderTopWidth: 1,
    elevation: 0,
    overflow: "visible",
    paddingTop: 6,
    shadowOpacity: 0,
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
    minWidth: 64,
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
    backgroundColor: "#176B3A",
    borderRadius: 30,
    elevation: 6,
    height: 60,
    justifyContent: "center",
    shadowColor: "#143D29",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 60,
  },
  tabText: {
    color: "#89948E",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
    width: 64,
  },
  activeTabText: {
    color: "#176B3A",
    fontWeight: "800",
  },
});
