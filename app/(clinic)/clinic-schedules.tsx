import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useSegments } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL, getImageUrl } from "../../config/api";

type ScheduleStatus = "Pending" | "Completed" | "Cancelled";

type ClinicSchedule = {
  record_id: number;
  pet_id: number;
  visit_date: string;
  service_type: string;
  diagnosis: string | null;
  treatment: string | null;
  medication: string | null;
  notes: string | null;
  next_due_date: string;
  schedule_status: ScheduleStatus;
  completed_at: string | null;
  created_at: string;
  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  can_open: boolean;
};

const STATUSES: ScheduleStatus[] = ["Pending", "Completed", "Cancelled"];

export default function ClinicSchedulesScreen() {
  const segments = useSegments();
  const isTabScreen = segments.some(
    (segment) => String(segment) === "(tabs)",
  );
  const [schedules, setSchedules] = useState<ClinicSchedule[]>([]);
  const [selectedStatus, setSelectedStatus] =
    useState<ScheduleStatus>("Pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestInFlight = useRef(false);

  const loadSchedules = useCallback(async (showLoading = true) => {
    if (requestInFlight.current) {
      setRefreshing(false);
      return;
    }
    requestInFlight.current = true;

    try {
      if (showLoading) setLoading(true);
      setError(false);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/vet-records/clinic-schedules`, {
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
        throw new Error(data.message || "Unable to load schedules.");
      }

      setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
    } catch (loadError) {
      console.log("CLINIC SCHEDULES ERROR:", loadError);
      setError(true);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSchedules();
    }, [loadSchedules]),
  );

  const counts = useMemo(
    () =>
      STATUSES.reduce(
        (result, status) => ({
          ...result,
          [status]: schedules.filter(
            (schedule) => schedule.schedule_status === status,
          ).length,
        }),
        {} as Record<ScheduleStatus, number>,
      ),
    [schedules],
  );

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const statusSchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) => schedule.schedule_status === selectedStatus,
      ),
    [schedules, selectedStatus],
  );
  const visibleSchedules = useMemo(
    () =>
      statusSchedules.filter((schedule) => {
        if (!normalizedSearch) return true;
        return [
          schedule.pet_name,
          schedule.breed,
          schedule.species,
          schedule.service_type,
        ].some((value) =>
          String(value || "")
            .toLocaleLowerCase()
            .includes(normalizedSearch),
        );
      }),
    [normalizedSearch, statusSchedules],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadSchedules(false);
  }, [loadSchedules]);

  const showSearchEmpty =
    statusSchedules.length > 0 && visibleSchedules.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        {isTabScreen ? (
          <View style={styles.headerSpacer} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={23} color="#1E2D24" />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>Schedules</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#176B3A"
          />
        }
      >
        <Text style={styles.subtitle}>
          Pet care schedules managed by your clinic
        </Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#758178" />
          <TextInput
            accessibilityLabel="Search schedules"
            value={search}
            onChangeText={setSearch}
            placeholder="Search schedules..."
            placeholderTextColor="#9AA39D"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSearch("")}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={19} color="#91A097" />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {STATUSES.map((status) => {
            const selected = selectedStatus === status;
            return (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.tab,
                  selected && styles.tabSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text
                  style={[styles.tabText, selected && styles.tabTextSelected]}
                >
                  {status === "Pending" ? "Booked" : status} ({counts[status]})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!loading && !error && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTitle}>
              {selectedStatus === "Pending" ? "Booked" : selectedStatus} Schedules
            </Text>
            <Text style={styles.summaryCount}>
              {visibleSchedules.length}{" "}
              {visibleSchedules.length === 1 ? "schedule" : "schedules"}
            </Text>
          </View>
        )}

        {loading ? (
          <StateCard>
            <ActivityIndicator color="#176B3A" />
            <Text style={styles.loadingText}>Loading schedules...</Text>
          </StateCard>
        ) : error ? (
          <StateCard>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={29} color="#A7483E" />
            </View>
            <Text style={styles.stateTitle}>Unable to load schedules.</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
              onPress={() => loadSchedules()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </StateCard>
        ) : showSearchEmpty ? (
          <StateCard>
            <View style={styles.emptyIconMuted}>
              <Ionicons name="search-outline" size={29} color="#66746B" />
            </View>
            <Text style={styles.stateTitle}>No matching schedules</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
              onPress={() => setSearch("")}
            >
              <Text style={styles.clearText}>Clear Search</Text>
            </Pressable>
          </StateCard>
        ) : visibleSchedules.length === 0 ? (
          <EmptyState status={selectedStatus} />
        ) : (
          <View style={styles.scheduleList}>
            {visibleSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.record_id}
                schedule={schedule}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScheduleCard({
  schedule,
}: {
  schedule: ClinicSchedule;
}) {
  const imageUrl = getImageUrl(schedule.photo_url);
  const dueState = getDueState(schedule.next_due_date);
  const petContext = [schedule.breed, schedule.species]
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={styles.scheduleCard}>
      <View style={styles.cardMain}>
        <View style={styles.photoContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.petPhoto} />
          ) : (
            <Ionicons name="paw" size={25} color="#176B3A" />
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={styles.petName} numberOfLines={1}>
              {schedule.pet_name}
            </Text>
            <StatusBadge status={schedule.schedule_status} />
          </View>
          <Text style={styles.petContext} numberOfLines={1}>
            {petContext}
          </Text>
          <Text style={styles.serviceType}>{schedule.service_type}</Text>
          <View style={styles.dueRow}>
            <Ionicons name="calendar-outline" size={14} color="#76837B" />
            <Text style={styles.dueDate}>
              {schedule.schedule_status === "Pending" ? "Due " : "Scheduled "}
              {formatDateOnly(schedule.next_due_date)}
            </Text>
            {schedule.schedule_status === "Pending" && (
              <View
                style={[
                  styles.dueBadge,
                  { backgroundColor: dueState.backgroundColor },
                ]}
              >
                <Text style={[styles.dueBadgeText, { color: dueState.color }]}>
                  {dueState.label}
                </Text>
              </View>
            )}
          </View>
          {schedule.schedule_status === "Completed" &&
            schedule.completed_at && (
              <Text style={styles.completedAt}>
                Completed {formatDateTime(schedule.completed_at)}
              </Text>
            )}
          {!schedule.can_open && (
            <Text style={styles.accessChanged}>Current access has changed</Text>
          )}
        </View>

      </View>

    </View>
  );
}

function StatusBadge({ status }: { status: ScheduleStatus }) {
  return (
    <View
      style={[
        styles.statusBadge,
        status === "Pending" && styles.pendingBadge,
        status === "Completed" && styles.completedBadge,
        status === "Cancelled" && styles.cancelledBadge,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          status === "Pending" && styles.pendingBadgeText,
          status === "Completed" && styles.completedBadgeText,
          status === "Cancelled" && styles.cancelledBadgeText,
        ]}
      >
        {status === "Pending" ? "BOOKED" : status.toUpperCase()}
      </Text>
    </View>
  );
}

function EmptyState({ status }: { status: ScheduleStatus }) {
  const content = {
    Pending: {
      title: "No booked schedules",
      description:
        "New follow-up schedules created from veterinary records will appear here.",
      icon: "calendar-outline" as const,
    },
    Completed: {
      title: "No completed schedules yet",
      description: "Completed follow-up schedules will appear here.",
      icon: "checkmark-circle-outline" as const,
    },
    Cancelled: {
      title: "No cancelled schedules",
      description: "Cancelled schedule history will appear here.",
      icon: "close-circle-outline" as const,
    },
  }[status];

  return (
    <StateCard>
      <View style={styles.emptyIcon}>
        <Ionicons name={content.icon} size={29} color="#176B3A" />
      </View>
      <Text style={styles.stateTitle}>{content.title}</Text>
      <Text style={styles.stateDescription}>{content.description}</Text>
    </StateCard>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.stateCard}>{children}</View>;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDueState(value: string) {
  const dueDate = parseDateOnly(value);
  if (!dueDate)
    return { label: "SCHEDULED", color: "#176B3A", backgroundColor: "#E5F3E8" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);

  if (days < 0)
    return { label: "OVERDUE", color: "#A7483E", backgroundColor: "#FBE9E6" };
  if (days === 0)
    return { label: "TODAY", color: "#A66A15", backgroundColor: "#FFF0D5" };
  if (days <= 30)
    return {
      label: `${days} DAYS`,
      color: "#A66A15",
      backgroundColor: "#FFF0D5",
    };
  return { label: "SCHEDULED", color: "#176B3A", backgroundColor: "#E5F3E8" };
}

function formatDateOnly(value: string) {
  const date = parseDateOnly(value);
  if (!date) return "Date unavailable";
  return date.toLocaleDateString([], {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString([], {
    timeZone: "Asia/Manila",
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
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#1E2D24" },
  headerSpacer: { width: 44, height: 44 },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 45 },
  subtitle: { fontSize: 14, color: "#77847C" },
  searchContainer: {
    minHeight: 50,
    marginTop: 17,
    borderRadius: 15,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5DF",
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    marginHorizontal: 10,
    paddingVertical: 0,
    fontSize: 15,
    color: "#26372C",
  },
  tabs: { gap: 8, paddingTop: 17, paddingBottom: 4 },
  tab: {
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5DF",
  },
  tabSelected: { backgroundColor: "#176B3A", borderColor: "#176B3A" },
  tabText: { fontSize: 12, fontWeight: "800", color: "#66746B" },
  tabTextSelected: { color: "#FFFFFF" },
  summaryRow: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTitle: { fontSize: 19, fontWeight: "900", color: "#1E2D24" },
  summaryCount: { fontSize: 12, fontWeight: "700", color: "#718078" },
  scheduleList: { gap: 11 },
  scheduleCard: {
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8E3",
    overflow: "hidden",
  },
  cardMain: {
    minHeight: 142,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: { backgroundColor: "#F5F9F5", opacity: 0.82 },
  photoContainer: {
    width: 62,
    height: 62,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },
  petPhoto: { width: "100%", height: "100%" },
  cardContent: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 6 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  petName: { flex: 1, fontSize: 17, fontWeight: "900", color: "#27372D" },
  petContext: { marginTop: 3, fontSize: 12, color: "#7B877F" },
  serviceType: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "#395044",
  },
  dueRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  dueDate: { fontSize: 11, color: "#76837B" },
  dueBadge: {
    minHeight: 21,
    borderRadius: 8,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  dueBadgeText: { fontSize: 11, fontWeight: "900" },
  statusBadge: {
    minHeight: 23,
    borderRadius: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeText: { fontSize: 11, fontWeight: "900" },
  pendingBadge: { backgroundColor: "#FFF0D5" },
  pendingBadgeText: { color: "#A66A15" },
  completedBadge: { backgroundColor: "#E5F3E8" },
  completedBadgeText: { color: "#176B3A" },
  cancelledBadge: { backgroundColor: "#FBE9E6" },
  cancelledBadgeText: { color: "#A7483E" },
  completedAt: { marginTop: 7, fontSize: 11, color: "#4D725D" },
  accessChanged: {
    marginTop: 7,
    fontSize: 11,
    fontWeight: "800",
    color: "#A66A15",
  },
  stateCard: {
    minHeight: 245,
    marginTop: 12,
    borderRadius: 19,
    padding: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8E3",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, fontSize: 13, color: "#77847C" },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#E8F4EA",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconMuted: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EEF2EF",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FDEDEA",
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    marginTop: 13,
    fontSize: 16,
    fontWeight: "900",
    color: "#34453B",
    textAlign: "center",
  },
  stateDescription: {
    maxWidth: 280,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: "#77847C",
    textAlign: "center",
  },
  retryButton: {
    minWidth: 108,
    minHeight: 42,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#176B3A",
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  clearButton: {
    minWidth: 108,
    minHeight: 42,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#176B3A",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { fontSize: 13, fontWeight: "900", color: "#176B3A" },
  pressed: { opacity: 0.72 },
});
