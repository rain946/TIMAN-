import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { API_URL } from "../config/api";

type Preference = {
  nearbyAlertsEnabled: boolean;
  hasLocation: boolean;
  locationUpdatedAt: string | null;
};

const emptyPreference: Preference = {
  nearbyAlertsEnabled: false,
  hasLocation: false,
  locationUpdatedAt: null,
};

export default function NearbyAlertSettings() {
  const [preference, setPreference] = useState<Preference>(emptyPreference);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const request = useCallback(async (method: "GET" | "PUT", body?: object) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Please log in again.");
    const response = await fetch(`${API_URL}/nearby-alerts/preferences`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update nearby-alert settings.");
    }
    setPreference(data.preference);
    return data.preference as Preference;
  }, []);

  useEffect(() => {
    request("GET")
      .catch((error) =>
        Alert.alert(
          "Nearby Alerts",
          error instanceof Error ? error.message : "Unable to load nearby-alert settings.",
        ),
      )
      .finally(() => setLoading(false));
  }, [request]);

  const toggleAlerts = async (enabled: boolean) => {
    try {
      setSaving(true);
      const updated = await request("PUT", { nearbyAlertsEnabled: enabled });
      if (enabled && !updated.hasLocation) {
        Alert.alert(
          "Location Required",
          "Nearby alerts are enabled, but you must tap Update My Location before you can receive nearby alerts.",
        );
      }
    } catch (error) {
      Alert.alert("Unable to Update", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateLocation = async () => {
    try {
      setSaving(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          "Location Permission Needed",
          "Nearby alerts require a location you explicitly share. You can continue using TIMAN without enabling this feature.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await request("PUT", {
        nearbyAlertsEnabled: preference.nearbyAlertsEnabled,
        alertLatitude: position.coords.latitude,
        alertLongitude: position.coords.longitude,
      });
      Alert.alert("Location Updated", "Your nearby-alert location was updated successfully.");
    } catch (error) {
      Alert.alert("Location Update Failed", error instanceof Error ? error.message : "Unable to update your location.");
    } finally {
      setSaving(false);
    }
  };

  const lastUpdated = preference.locationUpdatedAt
    ? new Date(preference.locationUpdatedAt).toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not yet shared";

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.icon}>
          <Ionicons name="location-outline" size={22} color="#176B3A" />
        </View>
        <View style={styles.headingText}>
          <Text style={styles.title}>Nearby Lost-Pet Alerts</Text>
          <Text style={styles.description}>
            Share a location only when you choose. TIMAN does not track you in the background.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#176B3A" />
      ) : (
        <>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Enable Nearby Alerts</Text>
              <Text style={styles.stateText}>
                {preference.nearbyAlertsEnabled ? "Enabled" : "Disabled"}
              </Text>
            </View>
            <Switch
              value={preference.nearbyAlertsEnabled}
              onValueChange={(value) => void toggleAlerts(value)}
              disabled={saving}
              trackColor={{ false: "#D6DDD8", true: "#9CC9A8" }}
              thumbColor={preference.nearbyAlertsEnabled ? "#176B3A" : "#FFFFFF"}
            />
          </View>
          <Text style={styles.locationStatus}>
            Location: {preference.hasLocation ? "Shared" : "Not shared"}
          </Text>
          <Text style={styles.updatedText}>Last updated: {lastUpdated}</Text>
          <Pressable
            onPress={() => void updateLocation()}
            disabled={saving}
            style={({ pressed }) => [
              styles.button,
              (pressed || saving) && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Update My Location</Text>
              </>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8E4", borderRadius: 17, padding: 15 },
  headingRow: { flexDirection: "row", alignItems: "flex-start" },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EAF4EB", alignItems: "center", justifyContent: "center" },
  headingText: { flex: 1, marginLeft: 11 },
  title: { fontSize: 15, fontWeight: "800", color: "#3A4A40" },
  description: { fontSize: 12, lineHeight: 17, color: "#7A877F", marginTop: 3 },
  loader: { marginVertical: 18 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 17, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#EEF1EF" },
  settingLabel: { fontSize: 13, fontWeight: "800", color: "#3A4A40" },
  stateText: { fontSize: 11, color: "#7A877F", marginTop: 2 },
  locationStatus: { fontSize: 12, fontWeight: "700", color: "#59675E", marginTop: 14 },
  updatedText: { fontSize: 11, color: "#89948D", marginTop: 3 },
  button: { height: 46, borderRadius: 13, backgroundColor: "#176B3A", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.7 },
});
