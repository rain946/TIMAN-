import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL, getImageUrl } from "../../config/api";

type ClinicScheduleDetails = {
  record_id: number;
  pet_name: string;
  owner_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  service_type: string;
  next_due_date: string;
  follow_up_plan: string | null;
};

export default function ClinicScheduleDetailsScreen() {
  const params = useLocalSearchParams<{ recordId?: string }>();
  const recordId = Number(params.recordId);
  const [schedule, setSchedule] = useState<ClinicScheduleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    if (!Number.isInteger(recordId) || recordId <= 0) {
      setError("Schedule details are unavailable.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
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
        throw new Error(data.message || "Unable to load schedule details.");
      }

      const match = (Array.isArray(data.schedules) ? data.schedules : []).find(
        (item: ClinicScheduleDetails) => Number(item.record_id) === recordId,
      );
      if (!match) {
        throw new Error("Schedule details are unavailable.");
      }
      setSchedule(match);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load schedule details.",
      );
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const photoUrl = getImageUrl(schedule?.photo_url || null);

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
          <Ionicons name="arrow-back" size={23} color="#2E3A34" />
        </Pressable>
        <Text style={styles.headerTitle}>SCHEDULE DETAILS</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#2E7D6B" />
          <Text style={styles.stateText}>Loading schedule details...</Text>
        </View>
      ) : error || !schedule ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={34} color="#E57373" />
          <Text style={styles.errorText}>
            {error || "Schedule details are unavailable."}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
            onPress={() => void loadSchedule()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.petCard}>
            <View style={styles.photoContainer}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.petPhoto} />
              ) : (
                <Ionicons name="paw" size={31} color="#2E7D6B" />
              )}
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{schedule.pet_name}</Text>
              <Text style={styles.petDetail}>{schedule.species || "—"}</Text>
              <Text style={styles.petDetail}>{schedule.breed || "—"}</Text>
            </View>
          </View>

          <View style={styles.detailCard}>
            <DetailField label="Next Service" value={schedule.service_type} />
            <View style={styles.divider} />
            <DetailField
              label="Scheduled Date"
              value={formatDateOnly(schedule.next_due_date)}
            />
            <View style={styles.divider} />
            <DetailField label="Owner" value={schedule.owner_name} />
            <View style={styles.divider} />
            <DetailField
              label="Follow-up Plan"
              value={schedule.follow_up_plan}
            />
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value?.trim() || "—"}</Text>
    </View>
  );
}

function formatDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(value || "").slice(0, 10),
  );
  if (!match) return "Date unavailable";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "Date unavailable";
  }
  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  header: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#2E3A34",
  },
  headerSpacer: { width: 44, height: 44 },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 45,
  },
  petCard: {
    padding: 17,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
  },
  photoContainer: {
    width: 76,
    height: 76,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  petPhoto: { width: "100%", height: "100%" },
  petInfo: { flex: 1, marginLeft: 15 },
  petName: { fontSize: 20, fontWeight: "900", color: "#2E3A34" },
  petDetail: { marginTop: 4, fontSize: 13, color: "#6B7C73" },
  detailCard: {
    marginTop: 15,
    paddingHorizontal: 17,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  detailField: { paddingVertical: 15 },
  detailLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#6B7C73",
  },
  detailValue: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: "#2E3A34",
  },
  divider: { height: 1, backgroundColor: "#CFE8DD" },
  centerState: {
    flex: 1,
    padding: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: { marginTop: 12, fontSize: 13, color: "#6B7C73" },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7C73",
    textAlign: "center",
  },
  retryButton: {
    minWidth: 108,
    minHeight: 42,
    marginTop: 17,
    borderRadius: 12,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
