import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
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

type Pet = {
  pet_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
};

type VetRecord = {
  record_id: number;
  pet_id: number;

  visit_date: string;
  service_type: string;

  diagnosis: string | null;
  treatment: string | null;
  medication: string | null;
  notes: string | null;

  next_due_date: string | null;
  schedule_status: "Pending" | "Completed" | "Cancelled" | null;
  completed_at: string | null;
  created_at: string;

  clinic_contact_name: string;
  clinic_name: string | null;
};

export default function VetRecordsScreen() {
  const params = useLocalSearchParams<{
    petId?: string;
  }>();

  const petId = params.petId;

  const [pet, setPet] = useState<Pet | null>(null);

  const [records, setRecords] = useState<VetRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const loadRecords = useCallback(
    async (showLoading = true) => {
      if (!petId) {
        setLoading(false);

        Alert.alert("Pet Error", "No pet was selected.");

        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }

        const token = await AsyncStorage.getItem("token");

        if (!token) {
          Alert.alert("Session Expired", "Please log in again.");

          router.replace("/login");

          return;
        }

        const response = await fetch(`${API_URL}/vet-records/owner/${petId}`, {
          method: "GET",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        });

        const text = await response.text();

        let data: any = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {
            message: text,
          };
        }

        console.log("OWNER VET RECORDS STATUS:", response.status);

        console.log("OWNER VET RECORDS RESPONSE:", data);

        if (!response.ok) {
          Alert.alert(
            "Unable to Load",
            data.message || "Unable to load veterinary records.",
          );

          return;
        }

        setPet(data.pet || null);

        setRecords(Array.isArray(data.records) ? data.records : []);
      } catch (error) {
        console.log("LOAD OWNER VET RECORDS ERROR:", error);

        Alert.alert(
          "Connection Error",
          "Unable to connect to the TIMAN server.",
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
      loadRecords();

      return () => {};
    }, [loadRecords]),
  );

  const onRefresh = () => {
    setRefreshing(true);

    loadRecords(false);
  };

  const upcomingCount = records.filter((record) => {
    if (!record.next_due_date || record.schedule_status !== "Pending") {
      return false;
    }

    const date = parseDatabaseDate(record.next_due_date);

    if (!date) {
      return false;
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    date.setHours(0, 0, 0, 0);

    return date.getTime() >= today.getTime();
  }).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Loading pet health records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {pet && (
          <View style={styles.petCard}>
            {getImageUrl(pet.photo_url) ? (
              <Image
                source={{
                  uri: getImageUrl(pet.photo_url) || "",
                }}
                style={styles.petPhoto}
              />
            ) : (
              <View style={styles.petPlaceholder}>
                <Ionicons name="paw" size={31} color="#56B091" />
              </View>
            )}

            <View style={styles.petInfo}>
              <Text style={styles.petName}>{pet.pet_name}</Text>

              <Text style={styles.petDetails}>{pet.breed || pet.species}</Text>
            </View>

            <View style={styles.verifiedIcon}>
              <Ionicons name="shield-checkmark" size={23} color="#2E7D6B" />
            </View>
          </View>
        )}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor: "#CFE8DD",
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#2E7D6B"
              />
            </View>

            <View>
              <Text style={styles.summaryNumber}>{records.length}</Text>

              <Text style={styles.summaryLabel}>Total Records</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor: "rgba(229, 115, 115, 0.14)",
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={20} color="#F5A623" />
            </View>

            <View>
              <Text style={styles.summaryNumber}>{upcomingCount}</Text>

              <Text style={styles.summaryLabel}>Upcoming</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Veterinary History</Text>

          {records.length > 0 && (
            <Text style={styles.recordCountText}>
              {records.length} {records.length === 1 ? "record" : "records"}
            </Text>
          )}
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="medical-outline" size={35} color="#56B091" />
            </View>

            <Text style={styles.emptyTitle}>No Health Records Yet</Text>
          </View>
        ) : (
          records.map((record, index) => (
            <OwnerRecordCard
              key={record.record_id}
              record={record}
              latest={index === 0}
            />
          ))
        )}

        <View style={styles.privacyCard}>
          <Ionicons name="lock-closed-outline" size={19} color="#2E7D6B" />

          <Text style={styles.privacyText}>
            Only you and veterinary clinics with approved access can view
            protected veterinary information for this pet.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.headerPressed,
        ]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
      </Pressable>

      <Text style={styles.headerTitle}>Health Records</Text>

      <View style={styles.headerButton} />
    </View>
  );
}

function OwnerRecordCard({
  record,
  latest,
}: {
  record: VetRecord;
  latest: boolean;
}) {
  const clinic =
    record.clinic_name || record.clinic_contact_name || "Veterinary Clinic";

  const isCompleted = record.schedule_status === "Completed";

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.serviceIcon}>
          <Ionicons
            name={getServiceIcon(record.service_type)}
            size={22}
            color="#2E7D6B"
          />
        </View>

        <View style={styles.recordHeaderInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.serviceTitle}>{record.service_type}</Text>

            {latest && (
              <View style={styles.latestBadge}>
                <Text style={styles.latestText}>Latest</Text>
              </View>
            )}

            {isCompleted && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>Completed</Text>
              </View>
            )}
          </View>

          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color="#6B7C73" />

            <Text style={styles.dateText}>{formatDate(record.visit_date)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {record.diagnosis && (
        <RecordDetail
          icon="medkit-outline"
          label="Diagnosis"
          value={record.diagnosis}
        />
      )}

      {record.treatment && (
        <RecordDetail
          icon="medical-outline"
          label="Treatment / Procedure"
          value={record.treatment}
        />
      )}

      {record.medication && (
        <RecordDetail
          icon="bandage-outline"
          label="Medication"
          value={record.medication}
        />
      )}

      {record.notes && (
        <RecordDetail
          icon="document-text-outline"
          label="Notes"
          value={record.notes}
        />
      )}

      {record.next_due_date && (
        <View
          style={[
            styles.scheduleCard,
            isCompleted && styles.completedScheduleCard,
          ]}
        >
          <View
            style={[
              styles.scheduleIcon,
              isCompleted && styles.completedScheduleIcon,
            ]}
          >
            <Ionicons
              name={
                isCompleted ? "checkmark-done-outline" : "notifications-outline"
              }
              size={19}
              color={isCompleted ? "#81C784" : "#F5A623"}
            />
          </View>

          <View style={styles.scheduleInfo}>
            <Text
              style={[
                styles.scheduleLabel,
                isCompleted && styles.completedScheduleLabel,
              ]}
            >
              {isCompleted ? "Completed on" : "Next Due Date"}
            </Text>

            <Text
              style={[
                styles.scheduleDate,
                isCompleted && styles.completedScheduleDate,
              ]}
            >
              {isCompleted && record.completed_at
                ? formatDateTime(record.completed_at)
                : formatDate(record.next_due_date)}
            </Text>
          </View>

          {!isCompleted && <DueBadge date={record.next_due_date} />}
        </View>
      )}

      <View style={styles.clinicFooter}>
        <View style={styles.clinicIcon}>
          <Ionicons name="business-outline" size={16} color="#2E7D6B" />
        </View>

        <View style={styles.clinicInfo}>
          <Text style={styles.clinicLabel}>Veterinary Clinic</Text>

          <Text style={styles.clinicName}>{clinic}</Text>

          {record.clinic_name && record.clinic_contact_name && (
            <Text style={styles.recordedBy}>
              Recorded by {record.clinic_contact_name}
            </Text>
          )}
        </View>

        <Ionicons name="checkmark-circle" size={19} color="#2E7D6B" />
      </View>
    </View>
  );
}

function RecordDetail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={17} color="#6B7C73" />
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>

        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function DueBadge({ date }: { date: string }) {
  const dueDate = parseDatabaseDate(date);

  if (!dueDate) {
    return null;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  dueDate.setHours(0, 0, 0, 0);

  const milliseconds = dueDate.getTime() - today.getTime();

  const days = Math.ceil(milliseconds / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return (
      <View style={[styles.dueBadge, styles.overdueBadge]}>
        <Text style={styles.overdueText}>Overdue</Text>
      </View>
    );
  }

  if (days === 0) {
    return (
      <View style={[styles.dueBadge, styles.todayBadge]}>
        <Text style={styles.todayText}>Due Today</Text>
      </View>
    );
  }

  if (days <= 30) {
    return (
      <View style={[styles.dueBadge, styles.upcomingBadge]}>
        <Text style={styles.upcomingText}>{days}d left</Text>
      </View>
    );
  }

  return (
    <View style={[styles.dueBadge, styles.scheduledBadge]}>
      <Text style={styles.scheduledText}>Scheduled</Text>
    </View>
  );
}

function getServiceIcon(service: string): keyof typeof Ionicons.glyphMap {
  if (service.startsWith("Vaccination - ")) {
    return "shield-checkmark-outline";
  }

  switch (service) {
    case "Checkup":
      return "medical-outline";

    case "Vaccination":
      return "shield-checkmark-outline";

    case "Deworming":
      return "fitness-outline";

    case "Treatment":
      return "bandage-outline";

    case "Surgery":
      return "pulse-outline";

    default:
      return "document-text-outline";
  }
}

function parseDatabaseDate(value: string) {
  if (!value) {
    return null;
  }

  const dateOnly = value.substring(0, 10);

  const parts = dateOnly.split("-");

  if (parts.length !== 3) {
    return null;
  }

  const year = Number(parts[0]);

  const month = Number(parts[1]);

  const day = Number(parts[2]);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  const date = parseDatabaseDate(value);

  if (!date) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5E9",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 17,
    color: "#6B7C73",
  },

  header: {
    height: 64,
    paddingHorizontal: 20,
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

  headerPressed: {
    opacity: 0.72,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2E3A34",
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },

  petCard: {
    padding: 16,
    borderRadius: 19,
    backgroundColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
  },

  petPhoto: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#CFE8DD",
  },

  petPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  petInfo: {
    flex: 1,
    marginLeft: 14,
  },

  petLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#56B091",
  },

  petName: {
    marginTop: 2,
    fontSize: 25,
    fontWeight: "900",
    color: "#2E3A34",
  },

  petDetails: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 19,
    color: "#6B7C73",
  },

  verifiedIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryRow: {
    marginTop: 15,
    flexDirection: "row",
    gap: 10,
  },

  summaryCard: {
    flex: 1,
    minHeight: 78,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryNumber: {
    fontSize: 23,
    fontWeight: "900",
    color: "#2E3A34",
  },

  summaryLabel: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 16,
    color: "#6B7C73",
  },

  infoCard: {
    marginTop: 15,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  infoText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: "#6B7C73",
  },

  sectionHeader: {
    marginTop: 27,
    marginBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#2E3A34",
  },

  recordCountText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7C73",
  },

  recordCard: {
    marginBottom: 14,
    padding: 17,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },

  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  serviceIcon: {
    width: 51,
    height: 51,
    borderRadius: 16,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  recordHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  serviceTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2E3A34",
  },

  latestBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#CFE8DD",
  },

  latestText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2E7D6B",
  },

  completedBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#CFE8DD",
  },

  completedBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#81C784",
  },

  dateRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  dateText: {
    fontSize: 16,
    color: "#6B7C73",
  },

  divider: {
    height: 1,
    marginVertical: 15,
    backgroundColor: "#CFE8DD",
  },

  detailRow: {
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
  },

  detailContent: {
    flex: 1,
    marginLeft: 11,
  },

  detailLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7C73",
  },

  detailValue: {
    marginTop: 3,
    fontSize: 17,
    lineHeight: 21,
    color: "#2E3A34",
  },

  scheduleCard: {
    marginTop: 3,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#FAD7A0",
    flexDirection: "row",
    alignItems: "center",
  },

  completedScheduleCard: {
    backgroundColor: "#CFE8DD",
  },

  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FAD7A0",
    alignItems: "center",
    justifyContent: "center",
  },

  completedScheduleIcon: {
    backgroundColor: "#FFF5E9",
  },

  scheduleInfo: {
    flex: 1,
    marginLeft: 10,
  },

  scheduleLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E57373",
  },

  completedScheduleLabel: {
    color: "#81C784",
  },

  scheduleDate: {
    marginTop: 3,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "800",
    color: "#E57373",
  },

  completedScheduleDate: {
    color: "#81C784",
  },

  dueBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },

  overdueBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  overdueText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#E57373",
  },

  todayBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  todayText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#F5A623",
  },

  upcomingBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  upcomingText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#F5A623",
  },

  scheduledBadge: {
    backgroundColor: "#CFE8DD",
  },

  scheduledText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2E7D6B",
  },

  clinicFooter: {
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
  },

  clinicIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  clinicInfo: {
    flex: 1,
    marginLeft: 10,
  },

  clinicLabel: {
    fontSize: 14,
    color: "#6B7C73",
  },

  clinicName: {
    marginTop: 2,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "800",
    color: "#2E3A34",
  },

  recordedBy: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 17,
    color: "#6B7C73",
  },

  emptyCard: {
    padding: 29,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "900",
    color: "#2E3A34",
  },

  emptyText: {
    marginTop: 7,
    maxWidth: 290,
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center",
    color: "#6B7C73",
  },

  privacyCard: {
    marginTop: 13,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  privacyText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: "#6B7C73",
  },
});
