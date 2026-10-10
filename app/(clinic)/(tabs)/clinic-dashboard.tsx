import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { timanShadow } from "../../../components/timan/theme";

import { API_URL, getImageUrl } from "../../../config/api";

type PendingRequest = {
  authorization_id: number;
  pet_id: number;
  requested_at: string;
  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
};

type RecentActivity = {
  record_id: number;
  pet_id: number;
  service_type: string;
  visit_date: string;
  created_at: string;
  pet_name: string;
  can_open: boolean;
};

type DashboardData = {
  clinic: {
    user_id: number;
    full_name: string;
    clinic_name: string | null;
  };
  overview: {
    added: number;
    completed: number;
    cancelled: number;
    rescheduled: number;
  };
  pending_requests: PendingRequest[];
  recent_activity: RecentActivity[];
};

const EMPTY_DASHBOARD: DashboardData = {
  clinic: {
    user_id: 0,
    full_name: "Clinic",
    clinic_name: null,
  },
  overview: {
    added: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
  },
  pending_requests: [],
  recent_activity: [],
};

export default function ClinicDashboardScreen() {
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/clinic-dashboard`, {
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
        throw new Error(data.message || "Unable to load the clinic dashboard.");
      }

      setDashboard({
        clinic: data.clinic,
        overview: data.overview,
        pending_requests: Array.isArray(data.pending_requests)
          ? data.pending_requests
          : [],
        recent_activity: Array.isArray(data.recent_activity)
          ? data.recent_activity
          : [],
      });
    } catch (loadError: any) {
      console.log("CLINIC DASHBOARD LOAD ERROR:", loadError);
      setError(loadError?.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true,
      );

      return () => {
        subscription.remove();
      };
    }, [loadDashboard]),
  );

  const clinicName =
    dashboard.clinic.clinic_name || dashboard.clinic.full_name || "Clinic";

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#2E7D6B"
            colors={["#2E7D6B"]}
            onRefresh={() => {
              setRefreshing(true);
              loadDashboard(false);
            }}
          />
        }
      >
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons name="medical" size={20} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.brandName}>TIMAN</Text>
            <Text style={styles.brandRole}>CLINIC WORKSPACE</Text>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <View pointerEvents="none" style={styles.welcomeCreamShape} />
          <View pointerEvents="none" style={styles.welcomeCoralShape} />

          <View style={styles.welcomeTextContainer}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.clinicName} numberOfLines={2}>
              {loading ? "Loading clinic..." : clinicName}
            </Text>
            <Text style={styles.subtitle}>
              Manage pet visits and health records
            </Text>
          </View>

          <Image
            source={require("../../../assets/images/clinic-dashboard-vet.png")}
            style={styles.welcomeVetImage}
            resizeMode="contain"
            accessible={false}
          />
        </View>

        {error && (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.errorCard,
              pressed && styles.pressed,
            ]}
            onPress={() => loadDashboard()}
          >
            <Ionicons name="alert-circle-outline" size={20} color="#E57373" />
            <View style={styles.errorContent}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Tap to retry</Text>
            </View>
          </Pressable>
        )}

        <SectionTitle title="This Month" />
        <View style={styles.overviewGrid}>
          <View style={styles.overviewRow}>
            <OverviewCard
              icon="calendar-outline"
              value={loading ? "—" : String(dashboard.overview.added)}
              label="Booked"
              onPress={() =>
                router.push({
                  pathname: "/(clinic)/clinic-monthly-schedules",
                  params: { filter: "added" },
                })
              }
            />
            <OverviewCard
              icon="checkmark-circle-outline"
              value={loading ? "—" : String(dashboard.overview.completed)}
              label="Completed"
              onPress={() =>
                router.push({
                  pathname: "/(clinic)/clinic-monthly-schedules",
                  params: { filter: "completed" },
                })
              }
            />
          </View>

          <View style={styles.overviewRow}>
            <OverviewCard
              icon="close-circle-outline"
              value={loading ? "—" : String(dashboard.overview.cancelled)}
              label="Cancelled"
              tone="cancelled"
              onPress={() =>
                router.push({
                  pathname: "/(clinic)/clinic-monthly-schedules",
                  params: { filter: "cancelled" },
                })
              }
            />
            <OverviewCard
              icon="calendar-number-outline"
              value={loading ? "—" : String(dashboard.overview.rescheduled)}
              label="Rescheduled"
              tone="rescheduled"
              onPress={() =>
                router.push({
                  pathname: "/(clinic)/clinic-monthly-schedules",
                  params: { filter: "rescheduled" },
                })
              }
            />
          </View>
        </View>

        <SectionHeader
          title="Pending Access"
          onPress={() =>
            router.push({
              pathname: "/access-requests",
              params: { initialStatus: "Pending" },
            })
          }
        />
        {loading ? (
          <LoadingCard label="Loading access requests..." />
        ) : dashboard.pending_requests.length === 0 ? (
          <EmptyCard
            icon="shield-checkmark-outline"
            text="No pending access requests."
          />
        ) : (
          dashboard.pending_requests.map((request) => (
            <PendingRequestCard
              key={request.authorization_id}
              request={request}
            />
          ))
        )}

        <SectionHeader
          title="Recent Activity"
          onPress={() => router.push("/(clinic)/(tabs)/vet-records")}
        />
        {loading ? (
          <LoadingCard label="Loading veterinary activity..." />
        ) : dashboard.recent_activity.length === 0 ? (
          <EmptyCard
            icon="document-text-outline"
            text="No recent veterinary activity yet."
          />
        ) : (
          dashboard.recent_activity.map((activity) => (
            <ActivityCard key={activity.record_id} activity={activity} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SectionHeader({
  title,
  onPress,
}: {
  title: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitleNoMargin}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !onPress }}
        disabled={!onPress}
        style={({ pressed }) => pressed && styles.pressed}
        onPress={onPress}
      >
        <Text style={onPress ? styles.seeAll : styles.seeAllDisabled}>
          See All
        </Text>
      </Pressable>
    </View>
  );
}

function OverviewCard({
  icon,
  value,
  label,
  tone = "default",
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tone?: "default" | "cancelled" | "rescheduled";
  onPress: () => void;
}) {
  const iconBadgeStyle =
    tone === "cancelled"
      ? styles.overviewIconCancelled
      : tone === "rescheduled"
        ? styles.overviewIconRescheduled
        : styles.overviewIconDefault;
  const iconColor =
    tone === "cancelled"
      ? "#E57373"
      : tone === "rescheduled"
        ? "#4D8FCB"
        : "#2E7D6B";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${label.toLowerCase()} schedules this month`}
      style={({ pressed }) => [
        styles.overviewCard,
        pressed && styles.overviewCardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.overviewTopRow}>
        <View style={[styles.overviewIcon, iconBadgeStyle]}>
          <Ionicons name={icon} size={23} color={iconColor} />
        </View>

        <Text style={styles.overviewValue}>{value}</Text>
      </View>

      <Text style={styles.overviewLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function PendingRequestCard({ request }: { request: PendingRequest }) {
  const photoUrl = getImageUrl(request.photo_url);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.requestCard, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: "/clinic-pet",
          params: {
            petId: String(request.pet_id),
            authorizationStatus: "Pending",
          },
        })
      }
    >
      <View style={styles.petAvatar}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.petPhoto} />
        ) : (
          <Ionicons name="paw" size={23} color="#2E7D6B" />
        )}
      </View>
      <View style={styles.requestInfo}>
        <Text style={styles.petName} numberOfLines={1}>
          {request.pet_name}
        </Text>
        <Text style={styles.petDetails} numberOfLines={1}>
          {request.breed || request.species}
        </Text>
        <Text style={styles.requestStatus}>Waiting for owner approval</Text>
      </View>
      <View style={styles.pendingBadge}>
        <Text style={styles.pendingText}>Pending</Text>
      </View>
    </Pressable>
  );
}

function ActivityCard({ activity }: { activity: RecentActivity }) {
  const content = (
    <>
      <View style={styles.activityTimeline} pointerEvents="none">
        <View style={styles.activityTimelineDot} />
        <View style={styles.activityTimelineLine} />
      </View>
      <View style={styles.activityIcon}>
        <Ionicons name="medical-outline" size={21} color="#2E7D6B" />
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {activity.service_type}
        </Text>
        <Text style={styles.activityPet} numberOfLines={1}>
          {activity.pet_name}
        </Text>
        <Text style={styles.activityTime}>
          {formatActivityTime(activity.created_at)}
        </Text>
      </View>
      {activity.can_open && (
        <Ionicons name="chevron-forward" size={18} color="#6B7C73" />
      )}
    </>
  );

  if (!activity.can_open) {
    return <View style={styles.activityCard}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: "/clinic-vet-records",
          params: {
            petId: String(activity.pet_id),
            recordId: String(activity.record_id),
          },
        })
      }
    >
      {content}
    </Pressable>
  );
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay(date, today)) return `Today, ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`;

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LoadingCard({ label }: { label: string }) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator size="small" color="#2E7D6B" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function EmptyCard({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color="#6B7C73" />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 110 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#2E7D6B",
    letterSpacing: 0.5,
  },
  brandRole: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B7C73",
    letterSpacing: 1.2,
    marginTop: 1,
  },
  welcomeCard: {
    minHeight: 172,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#CFE8DD",
    padding: 19,
    justifyContent: "center",
    overflow: "hidden",
  },
  welcomeTextContainer: {
    width: "58%",
    zIndex: 3,
  },
  welcomeCreamShape: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -42,
    top: -51,
    backgroundColor: "#FFF5E9",
    opacity: 0.9,
  },
  welcomeCoralShape: {
    position: "absolute",
    width: 39,
    height: 39,
    borderRadius: 20,
    right: 127,
    bottom: 18,
    backgroundColor: "#E57373",
    opacity: 0.2,
  },
  welcomeVetImage: {
    position: "absolute",
    width: "44%",
    height: 174,
    right: -3,
    bottom: -7,
    zIndex: 2,
  },
  greeting: { fontSize: 16, color: "#6B7C73", fontWeight: "600" },
  clinicName: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    color: "#2E3A34",
    marginTop: 2,
  },
  subtitle: { fontSize: 15, color: "#6B7C73", marginTop: 5 },
  errorCard: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.14)",
    backgroundColor: "#FFF5E9",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  errorContent: { flex: 1, marginLeft: 10 },
  errorText: { fontSize: 14, lineHeight: 20, color: "#E57373" },
  retryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E57373",
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#2E3A34",
    marginTop: 27,
    marginBottom: 13,
  },
  overviewGrid: { gap: 11 },
  overviewRow: { flexDirection: "row", gap: 11 },
  overviewCard: {
    flex: 1,
    minWidth: 0,
    height: 116,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 14,
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  overviewCardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  overviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewIconDefault: { backgroundColor: "#CFE8DD" },
  overviewIconCancelled: { backgroundColor: "rgba(229, 115, 115, 0.14)" },
  overviewIconRescheduled: { backgroundColor: "rgba(100, 181, 246, 0.16)" },
  overviewValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2E3A34",
    textAlign: "right",
  },
  overviewLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7C73",
    marginTop: 12,
    textAlign: "left",
  },
  unavailableHint: {
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7C73",
    marginTop: 9,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitleNoMargin: { fontSize: 21, fontWeight: "900", color: "#2E3A34" },
  seeAll: { fontSize: 15, fontWeight: "700", color: "#2E7D6B" },
  seeAllDisabled: { fontSize: 15, fontWeight: "700", color: "#6B7C73" },
  requestCard: {
    ...timanShadow,
    minHeight: 78,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 17,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  petAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  petPhoto: { width: "100%", height: "100%" },
  requestInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  petName: { fontSize: 16, fontWeight: "900", color: "#2E3A34" },
  petDetails: { fontSize: 14, color: "#6B7C73", marginTop: 2 },
  requestStatus: { fontSize: 13, color: "#F5A623", marginTop: 5 },
  pendingBadge: {
    backgroundColor: "#FAD7A0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
  },
  pendingText: { fontSize: 11, fontWeight: "800", color: "#F5A623" },
  activityCard: {
    minHeight: 74,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 16,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
    position: "relative",
    paddingLeft: 25,
  },
  activityTimeline: {
    position: "absolute",
    left: 8,
    top: 0,
    bottom: 0,
    width: 10,
    alignItems: "center",
  },
  activityTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 20,
    backgroundColor: "#56B091",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    zIndex: 1,
  },
  activityTimelineLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#CFE8DD",
  },
  activityIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: { flex: 1, marginLeft: 11 },
  activityTitle: { fontSize: 16, fontWeight: "800", color: "#2E3A34" },
  activityPet: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2E7D6B",
    marginTop: 3,
  },
  activityTime: { fontSize: 13, color: "#6B7C73", marginTop: 3 },
  loadingCard: {
    minHeight: 88,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  loadingText: { fontSize: 14, color: "#6B7C73", marginLeft: 9 },
  emptyCard: {
    minHeight: 102,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyText: { fontSize: 14, color: "#6B7C73", textAlign: "center" },
  pressed: { opacity: 0.72 },
});
