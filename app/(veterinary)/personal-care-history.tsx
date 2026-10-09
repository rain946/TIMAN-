import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { timanShadow } from "../../components/timan/theme";
import { API_URL } from "../../config/api";

type PersonalCareSchedule = {
  care_schedule_id: number;
  pet_id: number;
  pet_name: string;
  care_type: string;
  scheduled_date: string;
  repeat_type: "None" | "Weekly" | "Monthly";
  notes: string | null;
  status: "Pending" | "Completed" | "Cancelled";
  completed_at: string | null;
  cancelled_at: string | null;
};

export default function PersonalCareHistoryScreen() {
  const params = useLocalSearchParams<{ petId?: string; petName?: string }>();
  const petId = params.petId;
  const petName = params.petName || "Your pet";
  const [items, setItems] = useState<PersonalCareSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(
    async (showLoading = true) => {
      if (!petId) {
        setLoading(false);
        Alert.alert("Pet Error", "No pet was selected.");
        return;
      }

      try {
        if (showLoading) setLoading(true);

        const token = await AsyncStorage.getItem("token");
        if (!token) {
          Alert.alert("Session Expired", "Please log in again.");
          router.replace("/login");
          return;
        }

        const response = await fetch(
          `${API_URL}/pet-care-schedules?pet_id=${petId}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load personal care history.",
          );
        }

        const history = (Array.isArray(data.schedules)
          ? data.schedules
          : []
        ).filter(
          (item: PersonalCareSchedule) => item.status !== "Pending",
        ) as PersonalCareSchedule[];

        setItems(history.sort(compareHistoryItems));
      } catch (error) {
        Alert.alert(
          "Unable to Load",
          error instanceof Error
            ? error.message
            : "Unable to load personal care history.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [petId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const completedCount = useMemo(
    () => items.filter((item) => item.status === "Completed").length,
    [items],
  );
  const cancelledCount = items.length - completedCount;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to health schedule"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
        </Pressable>
        <Text style={styles.headerTitle}>Personal Care History</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E7D6B" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadHistory(false);
              }}
              tintColor="#2E7D6B"
              colors={["#2E7D6B"]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <Ionicons name="paw-outline" size={25} color="#2E7D6B" />
            </View>
            <View style={styles.introInfo}>
              <Text style={styles.eyebrow}>PERSONAL CARE</Text>
              <Text style={styles.petName}>{petName}</Text>
              <Text style={styles.introText}>
                Completed and cancelled care reminders are stored here.
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard
              color="#2E7D6B"
              icon="checkmark-circle-outline"
              label="Completed"
              number={completedCount}
            />
            <SummaryCard
              color="#C94B4B"
              icon="close-circle-outline"
              label="Cancelled"
              number={cancelledCount}
            />
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={30} color="#56B091" />
              </View>
              <Text style={styles.emptyTitle}>No History Yet</Text>
              <Text style={styles.emptyText}>
                Completed or cancelled personal care reminders will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Recent activity</Text>
              {items.map((item) => (
                <HistoryCard item={item} key={item.care_schedule_id} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SummaryCard({
  color,
  icon,
  label,
  number,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  number: number;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <View>
        <Text style={styles.summaryNumber}>{number}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

function HistoryCard({ item }: { item: PersonalCareSchedule }) {
  const completed = item.status === "Completed";
  const statusColor = completed ? "#2E7D6B" : "#C94B4B";
  const eventDate = completed ? item.completed_at : item.cancelled_at;

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View
          style={[
            styles.historyIcon,
            { backgroundColor: completed ? "#CFE8DD" : "#FCE8E6" },
          ]}
        >
          <Ionicons
            name={completed ? "checkmark" : "close"}
            size={20}
            color={statusColor}
          />
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.careType}>{item.care_type}</Text>
          <Text style={styles.scheduledDate}>
            Scheduled for {formatDate(item.scheduled_date)}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: completed ? "#EAF5F0" : "#FCE8E6" },
          ]}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailRow}>
        <Ionicons name="repeat-outline" size={16} color="#6B7C73" />
        <Text style={styles.detailText}>
          {item.repeat_type === "None" ? "One Time" : item.repeat_type}
        </Text>
      </View>
      {eventDate ? (
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#6B7C73" />
          <Text style={styles.detailText}>
            {completed ? "Completed" : "Cancelled"} {formatDate(eventDate)}
          </Text>
        </View>
      ) : null}
      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
    </View>
  );
}

function compareHistoryItems(
  first: PersonalCareSchedule,
  second: PersonalCareSchedule,
) {
  const firstValue =
    first.completed_at || first.cancelled_at || first.scheduled_date;
  const secondValue =
    second.completed_at || second.cancelled_at || second.scheduled_date;

  return secondValue.localeCompare(firstValue);
}

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: "900",
    color: "#2E3A34",
    textAlign: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7C73" },
  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 48,
  },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 19,
    backgroundColor: "#CFE8DD",
  },
  introIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  introInfo: { flex: 1, marginLeft: 12 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#56B091",
  },
  petName: { marginTop: 2, fontSize: 20, fontWeight: "900", color: "#2E3A34" },
  introText: { marginTop: 4, fontSize: 12, lineHeight: 17, color: "#6B7C73" },
  summaryRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  summaryCard: {
    ...timanShadow,
    flex: 1,
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryNumber: { fontSize: 20, fontWeight: "900", color: "#2E3A34" },
  summaryLabel: { marginTop: 1, fontSize: 11, color: "#6B7C73" },
  historySection: { marginTop: 24 },
  sectionTitle: { marginBottom: 11, fontSize: 16, fontWeight: "900", color: "#2E3A34" },
  historyCard: {
    ...timanShadow,
    marginBottom: 12,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  historyTop: { flexDirection: "row", alignItems: "center" },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  historyInfo: { flex: 1, marginHorizontal: 10 },
  careType: { fontSize: 15, fontWeight: "900", color: "#2E3A34" },
  scheduledDate: { marginTop: 3, fontSize: 11, color: "#6B7C73" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  statusText: { fontSize: 9, fontWeight: "900" },
  divider: { height: 1, marginVertical: 12, backgroundColor: "#E5EFEA" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  detailText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#6B7C73" },
  notes: {
    marginTop: 10,
    padding: 10,
    borderRadius: 11,
    backgroundColor: "#FFF5E9",
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7C73",
  },
  emptyCard: {
    marginTop: 24,
    padding: 28,
    borderRadius: 19,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF5F0",
  },
  emptyTitle: { marginTop: 13, fontSize: 18, fontWeight: "900", color: "#2E3A34" },
  emptyText: {
    marginTop: 6,
    maxWidth: 280,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: "#6B7C73",
  },
  pressed: { opacity: 0.72 },
});
