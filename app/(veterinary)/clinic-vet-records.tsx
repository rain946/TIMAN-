import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

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
import { timanShadow } from "../../components/timan/theme";

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
  clinic_user_id?: number;

  visit_date: string;
  service_type: string;

  diagnosis: string | null;
  treatment: string | null;
  medication: string | null;
  notes: string | null;

  next_due_date: string | null;
  next_service_type: string | null;
  follow_up_plan: string | null;

  schedule_status: "Pending" | "Completed" | "Cancelled";

  completed_at: string | null;

  created_at: string;

  clinic_contact_name: string;
  clinic_name: string | null;
};

export default function ClinicVetRecordsScreen() {
  const params = useLocalSearchParams<{
    petId?: string;
    recordId?: string;
    scanAccessToken?: string;
  }>();

  const petId = params.petId;
  const recordId = Number(params.recordId);
  const showsSingleRecord = Number.isInteger(recordId) && recordId > 0;
  const scanAccessToken = params.scanAccessToken || "";
  const hasScanAccess = Boolean(scanAccessToken);

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

        const response = await fetch(`${API_URL}/vet-records/clinic/${petId}`, {
          method: "GET",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,

            "X-TIMAN-Scan-Token": scanAccessToken,
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

        console.log("CLINIC VET RECORDS STATUS:", response.status);

        console.log("CLINIC VET RECORDS RESPONSE:", data);

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
        console.log("LOAD CLINIC VET RECORDS ERROR:", error);

        Alert.alert(
          "Connection Error",
          "Unable to connect to the TIMAN server.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [petId, scanAccessToken],
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

  const visibleRecords = showsSingleRecord
    ? records.filter((record) => record.record_id === recordId)
    : records;

  const completeSchedule = async (record: VetRecord) => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/vet-records/${record.record_id}/complete`,
        {
          method: "PATCH",

          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "X-TIMAN-Scan-Token": scanAccessToken,
          },
        },
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          message: text,
        };
      }

      console.log("COMPLETE SCHEDULE STATUS:", response.status);

      console.log("COMPLETE SCHEDULE RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Complete",
          data.message || "Unable to complete this health schedule.",
        );

        return;
      }

      Alert.alert(
        "Schedule Completed",
        data.message || `${record.service_type} has been marked as completed.`,
      );

      await loadRecords(false);
    } catch (error) {
      console.log("COMPLETE SCHEDULE ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    }
  };

  const confirmCompleteSchedule = (record: VetRecord) => {
    if (record.schedule_status === "Completed") {
      Alert.alert(
        "Already Completed",
        "This health schedule has already been completed.",
      );

      return;
    }

    if (record.schedule_status === "Cancelled") {
      Alert.alert(
        "Schedule Cancelled",
        "A cancelled health schedule cannot be completed.",
      );

      return;
    }

    Alert.alert(
      "Complete Schedule",
      `Confirm that ${record.service_type} has been completed for ${
        pet?.pet_name || "this pet"
      }?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: () => completeSchedule(record),
        },
      ],
    );
  };

  const addRecord = () => {
    if (!petId) {
      return;
    }

    router.push({
      pathname: "/add-vet-record",
      params: {
        petId: String(petId),
        scanAccessToken,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header singleRecord={showsSingleRecord} />

        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Loading veterinary records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header singleRecord={showsSingleRecord} />

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
                <Ionicons name="paw" size={32} color="#81C784" />
              </View>
            )}

            <View style={styles.petInfo}>
              <Text style={styles.petLabel}>
                {showsSingleRecord ? "Veterinary Record" : "Veterinary History"}
              </Text>

              <Text style={styles.petName}>{pet.pet_name}</Text>

              <Text style={styles.petDetails}>
                {[pet.species, pet.breed].filter(Boolean).join(" • ")}
              </Text>
            </View>

            {!showsSingleRecord && <View style={styles.recordCount}>
              <Text style={styles.recordNumber}>{visibleRecords.length}</Text>

              <Text style={styles.recordCountLabel}>Records</Text>
            </View>}
          </View>
        )}

        {hasScanAccess && <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={addRecord}
        >
          <View style={styles.addButtonIcon}>
            <Ionicons name="add" size={22} color="#2E7D6B" />
          </View>

          <View style={styles.addButtonContent}>
            <Text style={styles.addButtonTitle}>Add Veterinary Record</Text>

            <Text style={styles.addButtonText}>
              Record a new visit, treatment, vaccination, or follow-up.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {showsSingleRecord ? "Record Details" : "Medical History"}
          </Text>

          {!showsSingleRecord && visibleRecords.length > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>
                {visibleRecords.length} {visibleRecords.length === 1 ? "record" : "records"}
              </Text>
            </View>
          )}
        </View>

        {visibleRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="document-text-outline"
                size={35}
                color="#81C784"
              />
            </View>

            <Text style={styles.emptyTitle}>No Veterinary Records</Text>

            <Text style={styles.emptyText}>
              This pet does not have any veterinary records yet. Add the first
              record after completing the veterinary service.
            </Text>

            {hasScanAccess && <Pressable
              style={({ pressed }) => [
                styles.emptyButton,

                pressed && styles.pressed,
              ]}
              onPress={addRecord}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />

              <Text style={styles.emptyButtonText}>Add First Record</Text>
            </Pressable>}
          </View>
        ) : (
          visibleRecords.map((record, index) => (
            <VetRecordCard
              key={record.record_id}
              record={record}
              isLatest={!showsSingleRecord && index === 0}
              singleRecord={showsSingleRecord}
              onComplete={
                hasScanAccess
                  ? () => confirmCompleteSchedule(record)
                  : undefined
              }
            />
          ))
        )}

        {!showsSingleRecord && <View style={styles.securityCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#2E7D6B" />

          <Text style={styles.securityText}>
            Veterinary records are available because the pet owner has approved
            your clinic&apos;s access.
          </Text>
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ singleRecord = false }: { singleRecord?: boolean }) {
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.pressed,
        ]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
      </Pressable>

      <Text style={styles.headerTitle}>
        {singleRecord ? "Veterinary Record" : "Veterinary Records"}
      </Text>

      <View style={styles.headerButton} />
    </View>
  );
}

function VetRecordCard({
  record,
  isLatest,
  singleRecord,
  onComplete,
}: {
  record: VetRecord;
  isLatest: boolean;
  singleRecord: boolean;
  onComplete?: () => void;
}) {
  const clinic =
    record.clinic_name || record.clinic_contact_name || "Veterinary Clinic";

  const hasSchedule = Boolean(record.next_due_date);

  const isPending = record.schedule_status === "Pending";

  const isCompleted = record.schedule_status === "Completed";

  const isCancelled = record.schedule_status === "Cancelled";

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View
          style={[
            styles.serviceIcon,
            {
              backgroundColor: getServiceBackground(record.service_type),
            },
          ]}
        >
          <Ionicons
            name={getServiceIcon(record.service_type)}
            size={22}
            color="#2E7D6B"
          />
        </View>

        <View style={styles.recordHeaderInfo}>
          <View style={styles.serviceTitleRow}>
            <Text style={styles.serviceTitle}>{record.service_type}</Text>

            {isLatest && (
              <View style={styles.latestBadge}>
                <Text style={styles.latestText}>Latest</Text>
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

      <Text style={styles.medicalSectionTitle}>MEDICAL DETAILS</Text>

      {(singleRecord || record.diagnosis) && (
        <DetailRow
          icon="medkit-outline"
          label="Diagnosis"
          value={record.diagnosis || "—"}
        />
      )}

      {(singleRecord || record.treatment) && (
        <DetailRow
          icon="medical-outline"
          label="Treatment / Procedure"
          value={record.treatment || "—"}
        />
      )}

      {(singleRecord || record.medication) && (
        <DetailRow
          icon="bandage-outline"
          label="Medication"
          value={record.medication || "—"}
        />
      )}

      {(singleRecord || record.notes) && (
        <DetailRow
          icon="document-text-outline"
          label="Notes"
          value={record.notes || "—"}
        />
      )}

      {hasSchedule && (
        <>
          <View style={styles.followUpSection}>
            <View style={styles.followUpHeader}>
              <Text style={styles.followUpTitle}>FOLLOW-UP</Text>
              {isPending && <DueStatus value={record.next_due_date!} />}
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>Completed</Text>
                </View>
              )}
              {isCancelled && (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledBadgeText}>Cancelled</Text>
                </View>
              )}
            </View>
            <DetailRow
              icon="calendar-outline"
              label="Next Due Date"
              value={formatDate(record.next_due_date!)}
            />
            <DetailRow
              icon="medical-outline"
              label="Next Service"
              value={record.next_service_type || "—"}
            />
            <DetailRow
              icon="document-text-outline"
              label="Follow-up Plan / Instructions"
              value={record.follow_up_plan || "—"}
            />
          </View>

          {isPending && onComplete && (
            <Pressable
              style={({ pressed }) => [
                styles.completeButton,
                pressed && styles.pressed,
              ]}
              onPress={onComplete}
            >
              <View style={styles.completeButtonIcon}>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </View>

              <View style={styles.completeButtonInfo}>
                <Text style={styles.completeButtonTitle}>
                  Mark as Completed
                </Text>

                <Text style={styles.completeButtonText}>
                  Confirm that this scheduled service has been completed.
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </>
      )}

      {!singleRecord && <View style={styles.clinicFooter}>
        <View style={styles.clinicIcon}>
          <Ionicons name="business-outline" size={15} color="#2E7D6B" />
        </View>

        <View style={styles.clinicInfo}>
          <Text style={styles.clinicLabel}>Recorded by</Text>

          <Text style={styles.clinicName}>{clinic}</Text>
        </View>
      </View>}
    </View>
  );
}

function DetailRow({
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

function DueStatus({ value }: { value: string }) {
  const dueDate = parseDatabaseDate(value);

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  if (!dueDate) {
    return null;
  }

  dueDate.setHours(0, 0, 0, 0);

  const difference = dueDate.getTime() - today.getTime();

  const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

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
        <Text style={styles.todayText}>Today</Text>
      </View>
    );
  }

  if (days <= 30) {
    return (
      <View style={[styles.dueBadge, styles.soonBadge]}>
        <Text style={styles.soonText}>{days}d</Text>
      </View>
    );
  }

  return null;
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

function getServiceBackground(service: string) {
  if (service.startsWith("Vaccination - ")) {
    return "#CFE8DD";
  }

  switch (service) {
    case "Vaccination":
      return "#CFE8DD";

    case "Deworming":
      return "#FAD7A0";

    case "Treatment":
      return "#FFF5E9";

    case "Surgery":
      return "#FFF5E9";

    case "Checkup":
      return "#FFF5E9";

    default:
      return "#CFE8DD";
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
    fontSize: 13,
    color: "#6B7C73",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },

  headerButton: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2E3A34",
  },

  content: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 45,
  },

  petCard: {
    padding: 15,

    borderRadius: 19,

    backgroundColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "center",
  },

  petPhoto: {
    width: 64,
    height: 64,

    borderRadius: 19,

    backgroundColor: "#FFF5E9",
  },

  petPlaceholder: {
    width: 64,
    height: 64,

    borderRadius: 19,

    backgroundColor: "#FFF5E9",

    alignItems: "center",
    justifyContent: "center",
  },

  petInfo: {
    flex: 1,
    marginLeft: 13,
  },

  petLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7C73",
  },

  petName: {
    marginTop: 2,

    fontSize: 20,
    fontWeight: "900",
    color: "#2E3A34",
  },

  petDetails: {
    marginTop: 3,

    fontSize: 11,
    color: "#6B7C73",
  },

  recordCount: {
    alignItems: "center",

    paddingHorizontal: 10,
  },

  recordNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2E7D6B",
  },

  recordCountLabel: {
    marginTop: 1,

    fontSize: 11,
    color: "#6B7C73",
  },

  addButton: {
    marginTop: 14,

    minHeight: 67,

    paddingHorizontal: 14,

    borderRadius: 17,

    backgroundColor: "#2E7D6B",

    flexDirection: "row",
    alignItems: "center",
  },

  addButtonIcon: {
    width: 40,
    height: 40,

    borderRadius: 13,

    backgroundColor: "#FFFFFF",

    alignItems: "center",
    justifyContent: "center",
  },

  addButtonContent: {
    flex: 1,

    marginLeft: 11,
    marginRight: 8,
  },

  addButtonTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  addButtonText: {
    marginTop: 3,

    fontSize: 11,
    lineHeight: 12,
    color: "#CFE8DD",
  },

  sectionHeader: {
    marginTop: 25,
    marginBottom: 11,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2E3A34",
  },

  totalBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,

    borderRadius: 12,

    backgroundColor: "#CFE8DD",
  },

  totalBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D6B",
  },

  recordCard: {
    ...timanShadow,
    marginBottom: 13,

    padding: 16,

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
    width: 48,
    height: 48,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",
  },

  recordHeaderInfo: {
    flex: 1,

    marginLeft: 11,
  },

  serviceTitleRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 7,
  },

  serviceTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E3A34",
  },

  latestBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,

    borderRadius: 10,

    backgroundColor: "#CFE8DD",
  },

  latestText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D6B",
  },

  dateRow: {
    marginTop: 5,

    flexDirection: "row",
    alignItems: "center",

    gap: 4,
  },

  dateText: {
    fontSize: 11,
    color: "#6B7C73",
  },

  divider: {
    height: 1,

    marginVertical: 14,

    backgroundColor: "#CFE8DD",
  },

  detailRow: {
    marginBottom: 13,

    flexDirection: "row",
    alignItems: "flex-start",
  },

  detailIcon: {
    width: 31,
    height: 31,

    borderRadius: 10,

    backgroundColor: "#FFF5E9",

    alignItems: "center",
    justifyContent: "center",
  },

  detailContent: {
    flex: 1,

    marginLeft: 10,
  },

  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7C73",
  },

  detailValue: {
    marginTop: 3,

    fontSize: 12,
    lineHeight: 15,

    color: "#2E3A34",
  },

  nextDueCard: {
    marginTop: 3,

    padding: 11,

    borderRadius: 13,

    backgroundColor: "#FAD7A0",

    flexDirection: "row",
    alignItems: "center",
  },
  followUpSection: {
    marginTop: 18,
    padding: 15,
    borderRadius: 17,
    backgroundColor: "#FFF5E9",
    borderWidth: 1,
    borderColor: "#FAD7A0",
  },
  followUpHeader: {
    marginBottom: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  followUpTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#2E3A34",
  },
  medicalSectionTitle: {
    marginTop: 15,
    marginBottom: 3,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#2E3A34",
  },

  nextDueIcon: {
    width: 35,
    height: 35,

    borderRadius: 11,

    backgroundColor: "#FAD7A0",

    alignItems: "center",
    justifyContent: "center",
  },

  nextDueInfo: {
    flex: 1,

    marginLeft: 9,
  },

  nextDueLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F5A623",
  },

  nextDueDate: {
    marginTop: 2,

    fontSize: 12,
    fontWeight: "800",
    color: "#E57373",
  },

  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 10,
  },

  overdueBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  overdueText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#E57373",
  },

  todayBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  todayText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#F5A623",
  },

  soonBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  soonText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#F5A623",
  },

  clinicFooter: {
    marginTop: 14,
    paddingTop: 13,

    borderTopWidth: 1,
    borderTopColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "center",
  },

  clinicIcon: {
    width: 32,
    height: 32,

    borderRadius: 10,

    backgroundColor: "#CFE8DD",

    alignItems: "center",
    justifyContent: "center",
  },

  clinicInfo: {
    flex: 1,

    marginLeft: 9,
  },

  clinicLabel: {
    fontSize: 11,
    color: "#6B7C73",
  },

  clinicName: {
    marginTop: 2,

    fontSize: 11,
    fontWeight: "800",
    color: "#2E3A34",
  },

  emptyCard: {
    padding: 27,

    borderRadius: 19,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    alignItems: "center",
  },

  emptyIcon: {
    width: 67,
    height: 67,

    borderRadius: 22,

    backgroundColor: "#CFE8DD",

    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 13,

    fontSize: 17,
    fontWeight: "900",
    color: "#2E3A34",
  },

  emptyText: {
    marginTop: 6,

    maxWidth: 270,

    fontSize: 11,
    lineHeight: 15,

    textAlign: "center",

    color: "#6B7C73",
  },

  emptyButton: {
    marginTop: 17,

    height: 43,

    paddingHorizontal: 17,

    borderRadius: 13,

    backgroundColor: "#2E7D6B",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 6,
  },

  emptyButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  securityCard: {
    marginTop: 12,

    padding: 14,

    borderRadius: 15,

    backgroundColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "flex-start",

    gap: 9,
  },

  securityText: {
    flex: 1,

    fontSize: 11,
    lineHeight: 15,

    color: "#6B7C73",
  },

  completeButton: {
    marginTop: 10,
    minHeight: 58,
    paddingHorizontal: 13,
    paddingVertical: 10,

    borderRadius: 14,

    backgroundColor: "#2E7D6B",

    flexDirection: "row",
    alignItems: "center",
  },

  completeButtonIcon: {
    width: 34,
    height: 34,

    borderRadius: 11,

    backgroundColor: "rgba(255,255,255,0.16)",

    alignItems: "center",
    justifyContent: "center",
  },

  completeButtonInfo: {
    flex: 1,

    marginLeft: 10,
    marginRight: 6,
  },

  completeButtonTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  completeButtonText: {
    marginTop: 2,

    fontSize: 11,
    lineHeight: 11,

    color: "#CFE8DD",
  },

  completedDueCard: {
    backgroundColor: "#FFF5E9",
  },

  completedDueIcon: {
    backgroundColor: "#CFE8DD",
  },

  completedDueLabel: {
    color: "#2E7D6B",
  },

  completedDueDate: {
    color: "#81C784",
  },

  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 10,

    backgroundColor: "#CFE8DD",
  },

  completedBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#81C784",
  },

  cancelledDueCard: {
    backgroundColor: "#FFF5E9",
  },

  cancelledDueIcon: {
    backgroundColor: "#FFF5E9",
  },

  cancelledDueLabel: {
    color: "#E57373",
  },

  cancelledDueDate: {
    color: "#E57373",
  },

  cancelledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 10,

    backgroundColor: "#FFF5E9",
  },

  cancelledBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#E57373",
  },

  pressed: {
    opacity: 0.75,
  },
});
