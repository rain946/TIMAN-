import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import { API_URL } from "../config/api";
import { requestNearbyAlertConsent } from "./nearbyAlertConsentPresenter";
import { executeNearbyAlertEnrollment } from "./nearbyAlertEnrollmentWorkflow";

type AuthenticatedUser = {
  user_id?: number;
  userId?: number;
  role?: string;
};

type PreferenceResponse = {
  success: boolean;
  message?: string;
  preference?: {
    nearbyAlertsEnabled: boolean;
    hasLocation: boolean;
    locationFresh: boolean;
    enrollmentNeeded: boolean;
  };
};

const checkedUserIds = new Set<string>();
const checksInFlight = new Map<string, Promise<void>>();

function getUserIdentity(user: AuthenticatedUser | null) {
  const userId = user?.user_id ?? user?.userId;
  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  if (!userId || (role !== "owner" && role !== "clinic")) return null;
  return { userId: String(userId), role };
}

async function performEnrollmentCheck(token: string, userId: string) {
  const response = await fetch(`${API_URL}/nearby-alerts/preferences`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as PreferenceResponse;
  if (!response.ok || !data.success || !data.preference) return;

  if (!data.preference.enrollmentNeeded) return;

  await executeNearbyAlertEnrollment({
    requestConsent: requestNearbyAlertConsent,
    requestForegroundPermission: async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      return permission.status === Location.PermissionStatus.GRANTED;
    },
    getCurrentPosition: async () => {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    },
    savePreference: async (coordinates) => {
      const updateResponse = await fetch(`${API_URL}/nearby-alerts/preferences`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nearbyAlertsEnabled: true,
          alertLatitude: coordinates.latitude,
          alertLongitude: coordinates.longitude,
        }),
      });
      if (!updateResponse.ok) {
        throw new Error("Unable to save nearby-alert enrollment.");
      }
    },
  });
}

export async function checkNearbyAlertEnrollmentForSession(options?: {
  token?: string;
  user?: AuthenticatedUser;
}) {
  try {
    const token = options?.token ?? (await AsyncStorage.getItem("token"));
    const storedUser = options?.user
      ? options.user
      : JSON.parse((await AsyncStorage.getItem("user")) || "null");
    const identity = getUserIdentity(storedUser);

    if (!token || !identity || checkedUserIds.has(identity.userId)) return;

    const existingCheck = checksInFlight.get(identity.userId);
    if (existingCheck) return existingCheck;

    checkedUserIds.add(identity.userId);
    const check = performEnrollmentCheck(token, identity.userId)
      .catch((error) => {
        console.log("TIMAN NEARBY ALERT ENROLLMENT ERROR:", error);
      })
      .finally(() => {
        checksInFlight.delete(identity.userId);
      });
    checksInFlight.set(identity.userId, check);
    return check;
  } catch (error) {
    console.log("TIMAN NEARBY ALERT ENROLLMENT CHECK ERROR:", error);
  }
}
