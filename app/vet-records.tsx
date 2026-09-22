import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
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

import {
  API_URL,
  getImageUrl,
} from "../config/api";


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
  created_at: string;

  clinic_contact_name: string;
  clinic_name: string | null;
};


// SCREEN


export default function VetRecordsScreen() {
  const params =
    useLocalSearchParams<{
      petId?: string;
    }>();

  const petId = params.petId;

  const [pet, setPet] =
    useState<Pet | null>(null);

  const [records, setRecords] =
    useState<VetRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  // LOAD OWNER PET RECORDS


  const loadRecords = useCallback(
    async (showLoading = true) => {
      if (!petId) {
        setLoading(false);

        Alert.alert(
          "Pet Error",
          "No pet was selected."
        );

        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        if (!token) {
          Alert.alert(
            "Session Expired",
            "Please log in again."
          );

          router.replace("/login");

          return;
        }

        const response =
          await fetch(
            `${API_URL}/vet-records/owner/${petId}`,
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const text =
          await response.text();

        let data: any = {};

        try {
          data = text
            ? JSON.parse(text)
            : {};
        } catch {
          data = {
            message: text,
          };
        }

        console.log(
          "OWNER VET RECORDS STATUS:",
          response.status
        );

        console.log(
          "OWNER VET RECORDS RESPONSE:",
          data
        );

        if (!response.ok) {
          Alert.alert(
            "Unable to Load",
            data.message ||
              "Unable to load veterinary records."
          );

          return;
        }

        setPet(data.pet || null);

        setRecords(
          Array.isArray(data.records)
            ? data.records
            : []
        );
      } catch (error) {
        console.log(
          "LOAD OWNER VET RECORDS ERROR:",
          error
        );

        Alert.alert(
          "Connection Error",
          "Unable to connect to the TIMAN server."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [petId]
  );

  // AUTO REFRESH

  useFocusEffect(
    useCallback(() => {
      loadRecords();

      return () => {};
    }, [loadRecords])
  );

  // PULL TO REFRESH

  const onRefresh = () => {
    setRefreshing(true);

    loadRecords(false);
  };

  // COUNTS

  const upcomingCount =
    records.filter((record) => {
      if (!record.next_due_date) {
        return false;
      }

      const date =
        parseDatabaseDate(
          record.next_due_date
        );

      if (!date) {
        return false;
      }

      const today = new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      date.setHours(
        0,
        0,
        0,
        0
      );

      return (
        date.getTime() >=
        today.getTime()
      );
    }).length;


  // LOADING

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <Header />

        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text
            style={styles.loadingText}
          >
            Loading pet health
            records...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={styles.container}
    >
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* PET */}

        {pet && (
          <View style={styles.petCard}>
            {getImageUrl(
              pet.photo_url
            ) ? (
              <Image
                source={{
                  uri:
                    getImageUrl(
                      pet.photo_url
                    ) || "",
                }}
                style={styles.petPhoto}
              />
            ) : (
              <View style={styles.petPlaceholder}>
                <Ionicons
                  name="paw"
                  size={31}
                  color="#6E9179"
                />
              </View>
            )}

            <View style={styles.petInfo}>
              <Text style={styles.petName}>
                {pet.pet_name}
              </Text>

              <Text style={styles.petDetails}>
                {pet.breed ||
                  pet.species}
              </Text>
            </View>

            <View style={styles.verifiedIcon}>
              <Ionicons
                name="shield-checkmark"
                size={23}
                color="#176B3A"
              />
            </View>
          </View>
        )}

        {/* SUMMARY */}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor:
                    "#E7F2E8",
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#176B3A"
              />
            </View>

            <View>
              <Text style={styles.summaryNumber}>
                {records.length}
              </Text>

              <Text style={styles.summaryLabel}>
                Total Records
              </Text>
            </View>
          </View>

          <View
            style={styles.summaryCard}
          >
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor:
                    "#FFF0C7",
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color="#8A6818"
              />
            </View>

            <View>
              <Text style={styles.summaryNumber}>
                {upcomingCount}
              </Text>

              <Text style={styles.summaryLabel}>
                Upcoming
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Veterinary History
          </Text>

          {records.length > 0 && (
            <Text style={styles.recordCountText}>
              {records.length}{" "}
              {records.length === 1
                ? "record"
                : "records"}
            </Text>
          )}
        </View>

        {/* EMPTY */}

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="medical-outline"
                size={35}
                color="#779080"
              />
            </View>

            <Text style={styles.emptyTitle}>
              No Health Records Yet
            </Text>


          </View>
        ) : (
          records.map((record, index) => (
              <OwnerRecordCard
                key={
                  record.record_id
                }
                record={record}
                latest={
                  index === 0
                }
              />
            )
          )
        )}

        {/* PRIVACY */}

        <View style={styles.privacyCard}>
          <Ionicons
            name="lock-closed-outline"
            size={19}
            color="#176B3A"
          />

          <Text style={styles.privacyText}  >
            Only you and veterinary
            clinics with approved
            access can view protected
            veterinary information
            for this pet.
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
        style={styles.headerButton}
        onPress={() =>
          router.back()
        }>
        <Ionicons
          name="chevron-back"
          size={27}
          color="#173D2A"
        />
      </Pressable>

      <Text style={styles.headerTitle}>
        Health Records
      </Text>

      <View
        style={styles.headerButton}
      />
    </View>
  );
}


// OWNER RECORD CARD

function OwnerRecordCard({
  record,
  latest,
}: {
  record: VetRecord;
  latest: boolean;
}) {
  const clinic =
    record.clinic_name ||
    record.clinic_contact_name ||
    "Veterinary Clinic";

  return (
    <View
      style={styles.recordCard}
    >
      <View style={styles.recordHeader}>
        <View style={styles.serviceIcon}>
          <Ionicons
            name={getServiceIcon(
              record.service_type
            )}
            size={22}
            color="#176B3A"
          />
        </View>

        <View style={styles.recordHeaderInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.serviceTitle}>
              {record.service_type}
            </Text>

            {latest && (
              <View style={styles.latestBadge}>
                <Text style={styles.latestText}>
                  Latest
                </Text>
              </View>
            )}
          </View>

          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color="#7D8981"
            />

            <Text style={styles.dateText}>
              {formatDate(
                record.visit_date
              )}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {record.diagnosis && (
        <RecordDetail
          icon="medkit-outline"
          label="Diagnosis"
          value={
            record.diagnosis
          }
        />
      )}

      {record.treatment && (
        <RecordDetail
          icon="medical-outline"
          label="Treatment / Procedure"
          value={
            record.treatment
          }
        />
      )}

      {record.medication && (
        <RecordDetail
          icon="bandage-outline"
          label="Medication"
          value={
            record.medication
          }
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
        <View style={styles.scheduleCard}>
          <View style={styles.scheduleIcon}>
            <Ionicons
              name="notifications-outline"
              size={19}
              color="#876518"
            />
          </View>

          <View style={styles.scheduleInfo}>
            <Text style={styles.scheduleLabel}>
              Next Due Date
            </Text>

            <Text style={styles.scheduleDate}>
              {formatDate(
                record.next_due_date
              )}
            </Text>
          </View>

          <DueBadge
            date={
              record.next_due_date
            }
          />
        </View>
      )}

      <View style={styles.clinicFooter}>
        <View style={styles.clinicIcon}>
          <Ionicons
            name="business-outline"
            size={16}
            color="#176B3A"
          />
        </View>

        <View style={styles.clinicInfo}>
          <Text style={styles.clinicLabel}>
            Veterinary Clinic
          </Text>

          <Text style={styles.clinicName}>
            {clinic}
          </Text>

          {record.clinic_name &&
            record.clinic_contact_name && (
              <Text style={styles.recordedBy}>
                Recorded by{" "}
                {
                  record.clinic_contact_name
                }
              </Text>
            )}
        </View>

        <Ionicons
          name="checkmark-circle"
          size={19}
          color="#176B3A"
        />
      </View>
    </View>
  );
}

function RecordDetail({
  icon,
  label,
  value,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons
          name={icon}
          size={17}
          color="#62756A"
        />
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>
          {label}
        </Text>

        <Text style={styles.detailValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}


// DUE BADGE

function DueBadge({
  date,
}: {
  date: string;
}) {
  const dueDate =
    parseDatabaseDate(date);

  if (!dueDate) {
    return null;
  }

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  dueDate.setHours(
    0,
    0,
    0,
    0
  );

  const milliseconds =
    dueDate.getTime() -
    today.getTime();

  const days =
    Math.ceil(
      milliseconds /
        (1000 * 60 * 60 * 24)
    );

  if (days < 0) {
    return (
      <View style={[
          styles.dueBadge,
          styles.overdueBadge,
        ]}
      >
        <Text style={styles.overdueText}>
          Overdue
        </Text>
      </View>
    );
  }

  if (days === 0) {
    return (
      <View
        style={[
          styles.dueBadge,
          styles.todayBadge,
        ]}
      >
        <Text style={styles.todayText}>
          Due Today
        </Text>
      </View>
    );
  }

  if (days <= 30) {
    return (
      <View
        style={[
          styles.dueBadge,
          styles.upcomingBadge,
        ]}
      >
        <Text style={styles.upcomingText}>
          {days}d left
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.dueBadge,
        styles.scheduledBadge,
      ]}
    >
      <Text style={styles.scheduledText}>
        Scheduled
      </Text>
    </View>
  );
}


function getServiceIcon(
  service: string
): keyof typeof Ionicons.glyphMap {
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


// DATE


function parseDatabaseDate(
  value: string
) {
  if (!value) {
    return null;
  }

  const dateOnly =
    value.substring(0, 10);

  const parts =
    dateOnly.split("-");

  if (parts.length !== 3) {
    return null;
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);

  if (
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  return new Date(
    year,
    month - 1,
    day
  );
}

function formatDate(
  value: string
) {
  const date =
    parseDatabaseDate(value);

  if (!date) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#758279",
  },

  header: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EE",
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E2D24",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },

  // ===================================================
  // PET
  // ===================================================

  petCard: {
    padding: 16,
    borderRadius: 19,
    backgroundColor: "#EAF4EB",
    flexDirection: "row",
    alignItems: "center",
  },

  petPhoto: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#DCEADF",
  },

  petPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#DCEADF",
    alignItems: "center",
    justifyContent: "center",
  },

  petInfo: {
    flex: 1,
    marginLeft: 14,
  },

  petLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6F8175",
  },

  petName: {
    marginTop: 2,
    fontSize: 23,
    fontWeight: "900",
    color: "#23442F",
  },

  petDetails: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    color: "#6C7D72",
  },

  verifiedIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  // ===================================================
  // SUMMARY
  // ===================================================

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
    borderColor: "#E1E7E2",
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
    fontSize: 21,
    fontWeight: "900",
    color: "#2B3C32",
  },

  summaryLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: "#7E8982",
  },

  // ===================================================
  // INFO
  // ===================================================

  infoCard: {
    marginTop: 15,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F0F6F1",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#617167",
  },

  // ===================================================
  // SECTION
  // ===================================================

  sectionHeader: {
    marginTop: 27,
    marginBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#26352B",
  },

  recordCountText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#738078",
  },

  // ===================================================
  // RECORD CARD
  // ===================================================

  recordCard: {
    marginBottom: 14,
    padding: 17,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7E2",
  },

  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  serviceIcon: {
    width: 51,
    height: 51,
    borderRadius: 16,
    backgroundColor: "#E7F2E8",
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
    fontSize: 18,
    fontWeight: "900",
    color: "#2D4035",
  },

  latestBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#E5F2E7",
  },

  latestText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#176B3A",
  },

  dateRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  dateText: {
    fontSize: 14,
    color: "#7D8981",
  },

  divider: {
    height: 1,
    marginVertical: 15,
    backgroundColor: "#EDF1EE",
  },

  // ===================================================
  // DETAILS
  // ===================================================

  detailRow: {
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#F0F4F1",
    alignItems: "center",
    justifyContent: "center",
  },

  detailContent: {
    flex: 1,
    marginLeft: 11,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#849088",
  },

  detailValue: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 21,
    color: "#394A40",
  },

  // ===================================================
  // SCHEDULE
  // ===================================================

  scheduleCard: {
    marginTop: 3,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#FFF7DC",
    flexDirection: "row",
    alignItems: "center",
  },

  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFEDB6",
    alignItems: "center",
    justifyContent: "center",
  },

  scheduleInfo: {
    flex: 1,
    marginLeft: 10,
  },

  scheduleLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A743B",
  },

  scheduleDate: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#715819",
  },

  dueBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },

  overdueBadge: {
    backgroundColor: "#F7DDDA",
  },

  overdueText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#A3453C",
  },

  todayBadge: {
    backgroundColor: "#FFE6A2",
  },

  todayText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#876415",
  },

  upcomingBadge: {
    backgroundColor: "#FFF0C4",
  },

  upcomingText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#876415",
  },

  scheduledBadge: {
    backgroundColor: "#E7F2E8",
  },

  scheduledText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#176B3A",
  },

  // ===================================================
  // CLINIC
  // ===================================================

  clinicFooter: {
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EDF1EE",
    flexDirection: "row",
    alignItems: "center",
  },

  clinicIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  clinicInfo: {
    flex: 1,
    marginLeft: 10,
  },

  clinicLabel: {
    fontSize: 12,
    color: "#8A958E",
  },

  clinicName: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#415348",
  },

  recordedBy: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#8A958E",
  },

  // ===================================================
  // EMPTY
  // ===================================================

  emptyCard: {
    padding: 29,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7E2",
    alignItems: "center",
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#EDF4EE",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "900",
    color: "#31453A",
  },

  emptyText: {
    marginTop: 7,
    maxWidth: 290,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#7D8981",
  },

  // ===================================================
  // PRIVACY
  // ===================================================

  privacyCard: {
    marginTop: 13,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#EFF6F0",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  privacyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#617167",
  },
});
