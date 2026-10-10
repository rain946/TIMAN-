import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { timanColors, timanRadii, timanShadow } from "../timan/theme";

type ClinicTabItemProps = {
  activeIcon: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
  focused: boolean;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
};

export function ClinicTabItem({
  activeIcon,
  badgeCount = 0,
  focused,
  inactiveIcon,
}: ClinicTabItemProps) {
  const color = focused ? timanColors.primary : timanColors.muted;

  return (
    <View style={styles.iconContainer}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={23}
        color={color}
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
        <Ionicons name="scan" size={29} color={timanColors.white} />
      </View>
      <Text style={styles.scanTabLabel}>Scan</Text>
    </Pressable>
  );
}

export const clinicBottomNavStyles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    width: undefined,
    maxWidth: 760,
    alignSelf: "center",
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: timanRadii.large,
    backgroundColor: timanColors.white,
    borderTopColor: timanColors.lightMint,
    borderTopWidth: 1,
    borderWidth: 1,
    borderColor: timanColors.lightMint,
    overflow: "visible",
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 6,
    ...timanShadow,
  },
  tabBarItem: {
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 1,
    textAlign: "center",
  },
});

const styles = StyleSheet.create({
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
  scanTabButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    transform: [{ translateY: -9 }],
  },
  scanTabButtonPressed: {
    opacity: 0.78,
  },
  scanButtonCircle: {
    alignItems: "center",
    backgroundColor: timanColors.primary,
    borderRadius: 27,
    elevation: 6,
    height: 54,
    justifyContent: "center",
    shadowColor: timanColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 54,
  },
  scanTabLabel: {
    color: timanColors.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    marginTop: 1,
    textAlign: "center",
  },
});
