import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL, getImageUrl } from "../../config/api";

type AuthorizationStatus = "Pending" | "Approved" | "Declined" | "Revoked";

type AuthorizationItem = {
  authorization_id: number;
  pet_id: number;
  status: AuthorizationStatus;
  requested_at: string;
  responded_at: string | null;
  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  has_record: boolean | number;
};

const FILTERS: AuthorizationStatus[] = [
  "Pending",
  "Approved",
  "Declined",
  "Revoked",
];

const EMPTY_MESSAGES: Record<AuthorizationStatus, string> = {
  Pending: "No pending access requests.",
  Approved: "No approved pet access yet.",
  Declined: "No declined access requests.",
  Revoked: "No revoked access.",
};

export default function AccessRequestsScreen() {
  const params = useLocalSearchParams<{ initialStatus?: string }>();
  const [selectedStatus, setSelectedStatus] = useState<AuthorizationStatus>(
    () => normalizeStatus(params.initialStatus),
  );
  const [requests, setRequests] = useState<AuthorizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadRequests = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(false);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/authorizations/clinic`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      let data: any = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText };
      }

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load access requests.");
      }

      setRequests(
        Array.isArray(data.authorizations) ? data.authorizations : [],
      );
    } catch (loadError) {
      console.log("CLINIC ACCESS REQUESTS ERROR:", loadError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<AuthorizationStatus, number>>(
        (result, status) => {
          result[status] = requests.filter(
            (request) => request.status === status,
          ).length;
          return result;
        },
        { Pending: 0, Approved: 0, Declined: 0, Revoked: 0 },
      ),
    [requests],
  );

  const filteredRequests = useMemo(
    () => requests.filter((request) => request.status === selectedStatus),
    [requests, selectedStatus],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={27} color="#173D2A" />
        </Pressable>
        <Text style={styles.headerTitle}>Access Requests</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={["#176B3A"]}
            tintColor="#176B3A"
            onRefresh={() => {
              setRefreshing(true);
              loadRequests(false);
            }}
          />
        }
      >
        <Text style={styles.introTitle}>Pet access status</Text>
        <Text style={styles.introText}>
          Track owner authorization for pets your clinic has scanned.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((status) => {
            const selected = selectedStatus === status;
            return (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.filterButton,
                  selected && styles.filterButtonSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}
                >
                  {status} ({counts[status]})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#176B3A" />
            <Text style={styles.loadingText}>Loading access requests...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={27} color="#A7483E" />
            </View>
            <Text style={styles.stateTitle}>
              Unable to load access requests.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
              onPress={() => loadRequests()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={emptyIcon(selectedStatus)}
                size={28}
                color="#647269"
              />
            </View>
            <Text style={styles.stateTitle}>
              {EMPTY_MESSAGES[selectedStatus]}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredRequests.map((request) => (
              <AuthorizationCard
                key={request.authorization_id}
                request={request}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthorizationCard({ request }: { request: AuthorizationItem }) {
  const imageUrl = getImageUrl(request.photo_url);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() =>
        router.push({
          pathname: "/clinic-pet",
          params: {
            petId: String(request.pet_id),
            authorizationStatus: request.status,
          },
        })
      }
    >
      <View style={styles.petPhotoContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.petPhoto} />
        ) : (
          <Ionicons name="paw" size={25} color="#176B3A" />
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.petName} numberOfLines={1}>
            {request.pet_name}
          </Text>
          <StatusBadge status={request.status} />
        </View>
        <Text style={styles.petDetails} numberOfLines={1}>
          {request.breed || request.species}
        </Text>
        <Text style={styles.requestDate}>
          Requested {formatDate(request.requested_at)}
        </Text>
        <View style={styles.cardActionRow}>
          <Text style={styles.cardAction}>
            {request.status === "Approved" && Boolean(request.has_record)
              ? "View Record"
              : actionLabel(request.status)}
          </Text>
          <Ionicons name="chevron-forward" size={17} color="#176B3A" />
        </View>
      </View>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: AuthorizationStatus }) {
  return (
    <View
      style={[
        styles.statusBadge,
        status === "Pending" && styles.pendingBadge,
        status === "Approved" && styles.approvedBadge,
        status === "Declined" && styles.declinedBadge,
        status === "Revoked" && styles.revokedBadge,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          status === "Pending" && styles.pendingText,
          status === "Approved" && styles.approvedText,
          status === "Declined" && styles.declinedText,
          status === "Revoked" && styles.revokedText,
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

function normalizeStatus(value?: string): AuthorizationStatus {
  return FILTERS.includes(value as AuthorizationStatus)
    ? (value as AuthorizationStatus)
    : "Pending";
}

function actionLabel(status: AuthorizationStatus) {
  if (status === "Pending") return "View Request";
  if (status === "Approved") return "Open Pet";
  return "View Pet";
}

function emptyIcon(
  status: AuthorizationStatus,
): keyof typeof Ionicons.glyphMap {
  if (status === "Approved") return "shield-checkmark-outline";
  if (status === "Pending") return "time-outline";
  return "close-circle-outline";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unavailable";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFDF7" },
  header: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E9EDE9",
    backgroundColor: "#FFFDF7",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#1E2D24" },
  headerSpacer: { width: 44, height: 44 },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 20, paddingTop: 21, paddingBottom: 45 },
  introTitle: { fontSize: 22, fontWeight: "900", color: "#203027" },
  introText: { marginTop: 4, fontSize: 13, lineHeight: 17, color: "#77847C" },
  filterRow: { gap: 8, paddingVertical: 19 },
  filterButton: {
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5DF",
  },
  filterButtonSelected: { backgroundColor: "#176B3A", borderColor: "#176B3A" },
  filterText: { fontSize: 13, fontWeight: "800", color: "#66746B" },
  filterTextSelected: { color: "#FFFFFF" },
  list: { gap: 10 },
  card: {
    minHeight: 122,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8E3",
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  petPhotoContainer: {
    width: 66,
    height: 66,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },
  petPhoto: { width: "100%", height: "100%" },
  cardContent: { flex: 1, marginLeft: 13 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  petName: { flex: 1, fontSize: 17, fontWeight: "900", color: "#27372D" },
  petDetails: { marginTop: 3, fontSize: 12, color: "#7B877F" },
  requestDate: { marginTop: 7, fontSize: 11, color: "#929C96" },
  cardActionRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  cardAction: {
    fontSize: 12,
    fontWeight: "800",
    color: "#176B3A",
    marginRight: 2,
  },
  statusBadge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: "900" },
  pendingBadge: { backgroundColor: "#FFF1DA" },
  pendingText: { color: "#9A6416" },
  approvedBadge: { backgroundColor: "#E6F4E9" },
  approvedText: { color: "#176B3A" },
  declinedBadge: { backgroundColor: "#FDE9E6" },
  declinedText: { color: "#A7483E" },
  revokedBadge: { backgroundColor: "#F4E8E6" },
  revokedText: { color: "#8F4A42" },
  stateCard: {
    minHeight: 220,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8E3",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, fontSize: 13, color: "#77847C" },
  stateTitle: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#526158",
    textAlign: "center",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "#EEF3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "#FDEDEA",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButton: {
    minWidth: 102,
    minHeight: 44,
    marginTop: 17,
    borderRadius: 12,
    backgroundColor: "#176B3A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  retryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.7 },
});
