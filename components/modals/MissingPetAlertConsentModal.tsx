import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { setNearbyAlertConsentPresenter } from "../../services/nearbyAlertConsentPresenter";

export default function MissingPetAlertConsentModal() {
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((allowed: boolean) => void) | null>(null);

  const present = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setVisible(true);
      }),
    [],
  );

  useEffect(() => {
    setNearbyAlertConsentPresenter(present);
    return () => setNearbyAlertConsentPresenter(null);
  }, [present]);

  const finish = (allowed: boolean) => {
    setVisible(false);
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(allowed);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {}}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconArea}>
            <Ionicons name="notifications-outline" size={30} color="#2E7D6B" />
            <View style={styles.accentDot} />
          </View>

          <Text style={styles.title}>Missing Pet Alerts</Text>
          <Text style={styles.message}>
            TIMAN can use your current location to notify you when a missing pet
            is reported nearby. Your location is only captured when you allow it
            and is not tracked in the background.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => finish(false)}
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>Not Now</Text>
            </Pressable>

            <Pressable
              onPress={() => finish(true)}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>Allow</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(46, 58, 52, 0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFFFFF",
    padding: 22,
    alignItems: "center",
    shadowColor: "#2E7D6B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  iconArea: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  accentDot: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#F5A623",
  },
  title: {
    marginTop: 17,
    color: "#2E7D6B",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    marginTop: 9,
    color: "#6B7C73",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  button: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#2E7D6B",
    backgroundColor: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#2E7D6B",
  },
  secondaryText: {
    color: "#2E7D6B",
    fontSize: 14,
    fontWeight: "800",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
