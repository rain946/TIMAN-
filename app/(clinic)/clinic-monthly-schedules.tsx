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

type MonthlyFilter = "added" | "completed" | "cancelled" | "rescheduled";

type ClinicSchedule = {
  record_id: number;
  pet_name: string;
  owner_name: string;
  service_type: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  next_due_date: string;
  follow_up_plan: string | null;
  booked_date: string;
  completed_date: string | null;
  cancelled_date: string | null;
  rescheduled_date: string | null;
  is_added_this_month: boolean;
  is_completed_this_month: boolean;
  is_cancelled_this_month: boolean;
  is_rescheduled_this_month: boolean;
};

const FILTERS: {
  key: MonthlyFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
}[] = [
  { key: "added", label: "Booked", icon: "calendar-outline", color: "#2E7D6B", backgroundColor: "#CFE8DD" },
  { key: "completed", label: "Completed", icon: "checkmark-circle-outline", color: "#2E7D6B", backgroundColor: "#CFE8DD" },
  { key: "cancelled", label: "Cancelled", icon: "close-circle-outline", color: "#E57373", backgroundColor: "rgba(229, 115, 115, 0.14)" },
  { key: "rescheduled", label: "Rescheduled", icon: "calendar-number-outline", color: "#64B5F6", backgroundColor: "rgba(100, 181, 246, 0.16)" },
];

export default function ClinicMonthlySchedulesScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [selectedFilter, setSelectedFilter] = useState<MonthlyFilter>(() => normalizeFilter(params.filter));
  const [schedules, setSchedules] = useState<ClinicSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadSchedules = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(false);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const response = await fetch(`${API_URL}/vet-records/clinic-schedules`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
    } catch (loadError) {
      console.log("CLINIC MONTHLY SCHEDULES ERROR:", loadError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadSchedules(); }, [loadSchedules]));

  const counts = useMemo(() => ({
    added: schedules.filter((item) => item.is_added_this_month).length,
    completed: schedules.filter((item) => item.is_completed_this_month).length,
    cancelled: schedules.filter((item) => item.is_cancelled_this_month).length,
    rescheduled: schedules.filter((item) => item.is_rescheduled_this_month).length,
  }), [schedules]);

  const visibleSchedules = useMemo(() => {
    return schedules.filter((schedule) => matchesFilter(schedule, selectedFilter));
  }, [schedules, selectedFilter]);

  const selected = FILTERS.find((item) => item.key === selectedFilter) || FILTERS[0];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color="#2E3A34" />
        </Pressable>
        <Text style={styles.headerTitle}>This Month</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadSchedules(false); }} tintColor="#2E7D6B" />}
      >
        <Text style={styles.subtitle}>Monthly veterinary schedule activity</Text>

        <View style={styles.summaryGrid}>
          {FILTERS.map((item) => {
            const active = selectedFilter === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.summaryCard, active && { borderColor: item.color, backgroundColor: item.backgroundColor }]}
                onPress={() => setSelectedFilter(item.key)}
              >
                <View style={styles.summaryTopRow}>
                  <View style={[styles.summaryIcon, { backgroundColor: item.backgroundColor }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.summaryValue}>{loading ? "—" : counts[item.key]}</Text>
                </View>
                <Text style={[styles.summaryLabel, active && { color: item.color }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{selected.label}</Text>
          <Text style={styles.listCount}>{visibleSchedules.length} {visibleSchedules.length === 1 ? "schedule" : "schedules"}</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator color="#2E7D6B" /></View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={30} color="#E57373" />
            <Text style={styles.stateTitle}>Unable to load monthly schedules.</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadSchedules()}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : visibleSchedules.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={[styles.emptyIcon, { backgroundColor: selected.backgroundColor }]}>
              <Ionicons name={selected.icon} size={28} color={selected.color} />
            </View>
            <Text style={styles.stateTitle}>No {selected.label.toLowerCase()} schedules</Text>
            <Text style={styles.stateText}>No matching activity was recorded this month.</Text>
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {visibleSchedules.map((schedule) => (
              <MonthlyScheduleCard key={schedule.record_id} schedule={schedule} filter={selectedFilter} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MonthlyScheduleCard({ schedule, filter }: { schedule: ClinicSchedule; filter: MonthlyFilter }) {
  const imageUrl = getImageUrl(schedule.photo_url);
  const activityDate = filter === "added" ? schedule.booked_date : filter === "completed" ? schedule.completed_date : filter === "cancelled" ? schedule.cancelled_date : schedule.rescheduled_date;
  return (
    <View style={styles.scheduleCard}>
      <View style={styles.photoContainer}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.petPhoto} /> : <Ionicons name="paw" size={25} color="#2E7D6B" />}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.petName} numberOfLines={1}>{schedule.pet_name}</Text>
        <Text style={styles.ownerName} numberOfLines={1}>Owner: {schedule.owner_name || "—"}</Text>
        <Text style={styles.serviceType} numberOfLines={1}>{schedule.service_type}</Text>
        <Text style={styles.activityDate}>{getFilterLabel(filter)}: {formatDateOnly(activityDate)}</Text>
      </View>
    </View>
  );
}

function matchesFilter(schedule: ClinicSchedule, filter: MonthlyFilter) {
  if (filter === "added") return schedule.is_added_this_month;
  if (filter === "completed") return schedule.is_completed_this_month;
  if (filter === "cancelled") return schedule.is_cancelled_this_month;
  return schedule.is_rescheduled_this_month;
}

function normalizeFilter(value?: string): MonthlyFilter {
  return value === "completed" || value === "cancelled" || value === "rescheduled" ? value : "added";
}

function getFilterLabel(filter: MonthlyFilter) {
  if (filter === "added") return "Booked";
  if (filter === "completed") return "Completed";
  if (filter === "cancelled") return "Cancelled";
  return "Rescheduled";
}

function formatDateOnly(value: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").slice(0, 10));
  if (!match) return "Date unavailable";
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  header: { height: 60, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#CFE8DD" },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#2E3A34" },
  headerSpacer: { width: 44 },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: 20, paddingBottom: 48 },
  subtitle: { fontSize: 14, color: "#6B7C73" },
  summaryGrid: { marginTop: 17, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryCard: { flexBasis: "46%", flexGrow: 1, minWidth: 0, minHeight: 104, padding: 14, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CFE8DD", elevation: 1 },
  summaryTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 24, fontWeight: "900", color: "#2E3A34" },
  summaryLabel: { marginTop: 11, fontSize: 13, fontWeight: "900", color: "#6B7C73" },
  listHeader: { marginTop: 22, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listTitle: { fontSize: 19, fontWeight: "900", color: "#2E3A34" },
  listCount: { fontSize: 12, fontWeight: "700", color: "#6B7C73" },
  scheduleList: { gap: 11 },
  scheduleCard: { minHeight: 126, padding: 14, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CFE8DD", flexDirection: "row", alignItems: "center", elevation: 1 },
  photoContainer: { width: 60, height: 60, borderRadius: 19, overflow: "hidden", backgroundColor: "#CFE8DD", alignItems: "center", justifyContent: "center" },
  petPhoto: { width: "100%", height: "100%" },
  cardContent: { flex: 1, minWidth: 0, marginHorizontal: 13 },
  petName: { fontSize: 17, fontWeight: "900", color: "#2E3A34" },
  ownerName: { marginTop: 2, fontSize: 12, color: "#6B7C73" },
  serviceType: { marginTop: 8, fontSize: 14, fontWeight: "800", color: "#2E3A34" },
  activityDate: { marginTop: 4, fontSize: 12, color: "#6B7C73" },
  stateCard: { minHeight: 230, padding: 24, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CFE8DD", alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stateTitle: { marginTop: 13, fontSize: 16, fontWeight: "900", color: "#2E3A34", textAlign: "center" },
  stateText: { marginTop: 6, fontSize: 12, color: "#6B7C73", textAlign: "center" },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: "#2E7D6B" },
  retryText: { color: "#FFFFFF", fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
