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
} from "../../config/api";







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

  schedule_status:
    | "Pending"
    | "Completed"
    | "Cancelled";

  completed_at: string | null;

  created_at: string;

  clinic_contact_name: string;
  clinic_name: string | null;
};





export default function ClinicVetRecordsScreen() {
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
            `${API_URL}/vet-records/clinic/${petId}`,
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
          "CLINIC VET RECORDS STATUS:",
          response.status
        );

        console.log(
          "CLINIC VET RECORDS RESPONSE:",
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
          "LOAD CLINIC VET RECORDS ERROR:",
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


  useFocusEffect(
    useCallback(() => {
      loadRecords();

      return () => {};
    }, [loadRecords])
  );


  const onRefresh = () => {
    setRefreshing(true);

    loadRecords(false);
  };


  const completeSchedule = async (
    record: VetRecord
  ) => {
    try {
      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

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
        "COMPLETE SCHEDULE STATUS:",
        response.status
      );

      console.log(
        "COMPLETE SCHEDULE RESPONSE:",
        data
      );

      if (!response.ok) {
        Alert.alert(
          "Unable to Complete",
          data.message ||
            "Unable to complete this health schedule."
        );

        return;
      }

      Alert.alert(
        "Schedule Completed",
        data.message ||
          `${record.service_type} has been marked as completed.`
      );

      await loadRecords(false);
    } catch (error) {
      console.log(
        "COMPLETE SCHEDULE ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    }
  };


  const confirmCompleteSchedule = (
    record: VetRecord
  ) => {
    if (
      record.schedule_status ===
      "Completed"
    ) {
      Alert.alert(
        "Already Completed",
        "This health schedule has already been completed."
      );

      return;
    }

    if (
      record.schedule_status ===
      "Cancelled"
    ) {
      Alert.alert(
        "Schedule Cancelled",
        "A cancelled health schedule cannot be completed."
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
          onPress: () =>
            completeSchedule(record),
        },
      ]
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
      },
    });
  };


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
            Loading veterinary
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

        {pet && (
          <View
            style={styles.petCard}
          >
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
                style={
                  styles.petPhoto
                }
              />
            ) : (
              <View
                style={
                  styles.petPlaceholder
                }
              >
                <Ionicons
                  name="paw"
                  size={32}
                  color="#6F9179"
                />
              </View>
            )}

            <View
              style={styles.petInfo}
            >
              <Text
                style={styles.petLabel}
              >
                Veterinary History
              </Text>

              <Text
                style={styles.petName}
              >
                {pet.pet_name}
              </Text>

              <Text
                style={
                  styles.petDetails
                }
              >
                {pet.breed ||
                  pet.species}
              </Text>
            </View>

            <View
              style={
                styles.recordCount
              }
            >
              <Text
                style={
                  styles.recordNumber
                }
              >
                {records.length}
              </Text>

              <Text
                style={
                  styles.recordCountLabel
                }
              >
                Records
              </Text>
            </View>
          </View>
        )}


        <Pressable
          style={({ pressed }) => [
            styles.addButton,

            pressed &&
              styles.pressed,
          ]}
          onPress={addRecord}
        >
          <View
            style={
              styles.addButtonIcon
            }
          >
            <Ionicons
              name="add"
              size={22}
              color="#176B3A"
            />
          </View>

          <View
            style={
              styles.addButtonContent
            }
          >
            <Text
              style={
                styles.addButtonTitle
              }
            >
              Add Veterinary Record
            </Text>

            <Text
              style={
                styles.addButtonText
              }
            >
              Record a new visit,
              treatment, vaccination,
              or follow-up.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#FFFFFF"
          />
        </Pressable>


        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Medical History
          </Text>

          {records.length > 0 && (
            <View
              style={
                styles.totalBadge
              }
            >
              <Text
                style={
                  styles.totalBadgeText
                }
              >
                {records.length}{" "}
                {records.length === 1
                  ? "record"
                  : "records"}
              </Text>
            </View>
          )}
        </View>


        {records.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <View
              style={styles.emptyIcon}
            >
              <Ionicons
                name="document-text-outline"
                size={35}
                color="#76917E"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No Veterinary Records
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              This pet does not have
              any veterinary records
              yet. Add the first
              record after completing
              the veterinary service.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.emptyButton,

                pressed &&
                  styles.pressed,
              ]}
              onPress={addRecord}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.emptyButtonText
                }
              >
                Add First Record
              </Text>
            </Pressable>
          </View>
        ) : (
          records.map(
            (record, index) => (
              <VetRecordCard
                key={record.record_id}
                record={record}
                isLatest={index === 0}
                onComplete={() =>
                  confirmCompleteSchedule(record)
                }
              />
            )
          )
        )}


        <View
          style={
            styles.securityCard
          }
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color="#176B3A"
          />

          <Text
            style={
              styles.securityText
            }
          >
            Veterinary records are
            available because the pet
            owner has approved your
            clinic&apos;s access.
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
          pressed && styles.pressed,
        ]}
        onPress={() =>
          router.back()
        }
      >
        <Ionicons
          name="chevron-back"
          size={27}
          color="#173D2A"
        />
      </Pressable>

      <Text
        style={styles.headerTitle}
      >
        Veterinary Records
      </Text>

      <View
        style={styles.headerButton}
      />
    </View>
  );
}


function VetRecordCard({
  record,
  isLatest,
  onComplete,
}: {
  record: VetRecord;
  isLatest: boolean;
  onComplete: () => void;
}) {
  const clinic =
    record.clinic_name ||
    record.clinic_contact_name ||
    "Veterinary Clinic";

  const hasSchedule =
    Boolean(record.next_due_date);

  const isPending =
    record.schedule_status === "Pending";

  const isCompleted =
    record.schedule_status ===
    "Completed";

  const isCancelled =
    record.schedule_status ===
    "Cancelled";

  return (
    <View style={styles.recordCard}>

      <View style={styles.recordHeader}>
        <View
          style={[
            styles.serviceIcon,
            {
              backgroundColor:
                getServiceBackground(
                  record.service_type
                ),
            },
          ]}
        >
          <Ionicons
            name={getServiceIcon(
              record.service_type
            )}
            size={22}
            color="#176B3A"
          />
        </View>

        <View
          style={styles.recordHeaderInfo}
        >
          <View
            style={styles.serviceTitleRow}
          >
            <Text
              style={styles.serviceTitle}
            >
              {record.service_type}
            </Text>

            {isLatest && (
              <View
                style={styles.latestBadge}
              >
                <Text
                  style={styles.latestText}
                >
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
        <DetailRow
          icon="medkit-outline"
          label="Diagnosis"
          value={record.diagnosis}
        />
      )}

      {record.treatment && (
        <DetailRow
          icon="medical-outline"
          label="Treatment / Procedure"
          value={record.treatment}
        />
      )}

      {record.medication && (
        <DetailRow
          icon="bandage-outline"
          label="Medication"
          value={record.medication}
        />
      )}

      {record.notes && (
        <DetailRow
          icon="document-text-outline"
          label="Notes"
          value={record.notes}
        />
      )}


      {hasSchedule && (
        <>
          <View
            style={[
              styles.nextDueCard,

              isCompleted &&
                styles.completedDueCard,

              isCancelled &&
                styles.cancelledDueCard,
            ]}
          >
            <View
              style={[
                styles.nextDueIcon,

                isCompleted &&
                  styles.completedDueIcon,

                isCancelled &&
                  styles.cancelledDueIcon,
              ]}
            >
              <Ionicons
                name={
                  isCompleted
                    ? "checkmark-circle-outline"
                    : isCancelled
                    ? "close-circle-outline"
                    : "notifications-outline"
                }
                size={18}
                color={
                  isCompleted
                    ? "#176B3A"
                    : isCancelled
                    ? "#9A5550"
                    : "#896819"
                }
              />
            </View>

            <View
              style={styles.nextDueInfo}
            >
              <Text
                style={[
                  styles.nextDueLabel,

                  isCompleted &&
                    styles.completedDueLabel,

                  isCancelled &&
                    styles.cancelledDueLabel,
                ]}
              >
                {isCompleted
                  ? "Completed Schedule"
                  : isCancelled
                  ? "Cancelled Schedule"
                  : "Next Due Date"}
              </Text>

              <Text
                style={[
                  styles.nextDueDate,

                  isCompleted &&
                    styles.completedDueDate,

                  isCancelled &&
                    styles.cancelledDueDate,
                ]}
              >
                {isCompleted &&
                record.completed_at
                  ? `Completed ${formatDateTime(
                      record.completed_at
                    )}`
                  : formatDate(
                      record.next_due_date!
                    )}
              </Text>
            </View>

            {isPending && (
              <DueStatus
                value={
                  record.next_due_date!
                }
              />
            )}

            {isCompleted && (
              <View
                style={
                  styles.completedBadge
                }
              >
                <Text
                  style={
                    styles.completedBadgeText
                  }
                >
                  Completed
                </Text>
              </View>
            )}

            {isCancelled && (
              <View
                style={
                  styles.cancelledBadge
                }
              >
                <Text
                  style={
                    styles.cancelledBadgeText
                  }
                >
                  Cancelled
                </Text>
              </View>
            )}
          </View>


          {isPending && (
            <Pressable
              style={({ pressed }) => [
                styles.completeButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={onComplete}
            >
              <View
                style={
                  styles.completeButtonIcon
                }
              >
                <Ionicons
                  name="checkmark"
                  size={18}
                  color="#FFFFFF"
                />
              </View>

              <View
                style={
                  styles.completeButtonInfo
                }
              >
                <Text
                  style={
                    styles.completeButtonTitle
                  }
                >
                  Mark as Completed
                </Text>

                <Text
                  style={
                    styles.completeButtonText
                  }
                >
                  Confirm that this scheduled
                  service has been completed.
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          )}
        </>
      )}


      <View
        style={styles.clinicFooter}
      >
        <View style={styles.clinicIcon}>
          <Ionicons
            name="business-outline"
            size={15}
            color="#176B3A"
          />
        </View>

        <View style={styles.clinicInfo}>
          <Text
            style={styles.clinicLabel}
          >
            Recorded by
          </Text>

          <Text
            style={styles.clinicName}
          >
            {clinic}
          </Text>
        </View>
      </View>
    </View>
  );
}


function DetailRow({
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
    <View
      style={styles.detailRow}
    >
      <View
        style={
          styles.detailIcon
        }
      >
        <Ionicons
          name={icon}
          size={17}
          color="#61766A"
        />
      </View>

      <View
        style={
          styles.detailContent
        }
      >
        <Text
          style={
            styles.detailLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.detailValue
          }
        >
          {value}
        </Text>
      </View>
    </View>
  );
}


function DueStatus({
  value,
}: {
  value: string;
}) {
  const dueDate =
    parseDatabaseDate(value);

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  if (!dueDate) {
    return null;
  }

  dueDate.setHours(
    0,
    0,
    0,
    0
  );

  const difference =
    dueDate.getTime() -
    today.getTime();

  const days =
    Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    );

  if (days < 0) {
    return (
      <View
        style={[
          styles.dueBadge,
          styles.overdueBadge,
        ]}
      >
        <Text
          style={
            styles.overdueText
          }
        >
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
        <Text
          style={styles.todayText}
        >
          Today
        </Text>
      </View>
    );
  }

  if (days <= 30) {
    return (
      <View
        style={[
          styles.dueBadge,
          styles.soonBadge,
        ]}
      >
        <Text
          style={styles.soonText}
        >
          {days}d
        </Text>
      </View>
    );
  }

  return null;
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

function getServiceBackground(
  service: string
) {
  switch (service) {
    case "Vaccination":
      return "#E6F3E8";

    case "Deworming":
      return "#FFF2D5";

    case "Treatment":
      return "#F4EDE3";

    case "Surgery":
      return "#F5E8E6";

    case "Checkup":
      return "#E8F1EB";

    default:
      return "#EEF2EF";
  }
}


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

function formatDateTime(
  value: string
) {
  if (!value) {
    return "";
  }

  const date = new Date(
    value.replace(" ", "T")
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}


const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#FFFDF7",
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },

    loadingText: {
      marginTop: 12,
      fontSize: 11,
      color: "#76837B",
    },

    header: {
      height: 60,
      paddingHorizontal: 20,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",

      borderBottomWidth: 1,
      borderBottomColor:
        "#EDF0EE",
    },

    headerButton: {
      width: 42,
      height: 42,

      alignItems: "center",
      justifyContent:
        "center",
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: "#1E2D24",
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 45,
    },


    petCard: {
      padding: 15,

      borderRadius: 19,

      backgroundColor:
        "#EAF4EB",

      flexDirection: "row",
      alignItems: "center",
    },

    petPhoto: {
      width: 64,
      height: 64,

      borderRadius: 19,

      backgroundColor:
        "#DCEBDF",
    },

    petPlaceholder: {
      width: 64,
      height: 64,

      borderRadius: 19,

      backgroundColor:
        "#DCEBDF",

      alignItems: "center",
      justifyContent:
        "center",
    },

    petInfo: {
      flex: 1,
      marginLeft: 13,
    },

    petLabel: {
      fontSize: 8,
      fontWeight: "700",
      color: "#6E8174",
    },

    petName: {
      marginTop: 2,

      fontSize: 18,
      fontWeight: "900",
      color: "#23442F",
    },

    petDetails: {
      marginTop: 3,

      fontSize: 9,
      color: "#6C7D72",
    },

    recordCount: {
      alignItems: "center",

      paddingHorizontal: 10,
    },

    recordNumber: {
      fontSize: 20,
      fontWeight: "900",
      color: "#176B3A",
    },

    recordCountLabel: {
      marginTop: 1,

      fontSize: 7,
      color: "#718078",
    },


    addButton: {
      marginTop: 14,

      minHeight: 67,

      paddingHorizontal: 14,

      borderRadius: 17,

      backgroundColor:
        "#176B3A",

      flexDirection: "row",
      alignItems: "center",
    },

    addButtonIcon: {
      width: 40,
      height: 40,

      borderRadius: 13,

      backgroundColor:
        "#FFFFFF",

      alignItems: "center",
      justifyContent:
        "center",
    },

    addButtonContent: {
      flex: 1,

      marginLeft: 11,
      marginRight: 8,
    },

    addButtonTitle: {
      fontSize: 12,
      fontWeight: "900",
      color: "#FFFFFF",
    },

    addButtonText: {
      marginTop: 3,

      fontSize: 8,
      lineHeight: 12,
      color: "#D9EADF",
    },


    sectionHeader: {
      marginTop: 25,
      marginBottom: 11,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    sectionTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: "#26352B",
    },

    totalBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,

      borderRadius: 12,

      backgroundColor:
        "#E8F2E9",
    },

    totalBadgeText: {
      fontSize: 8,
      fontWeight: "800",
      color: "#176B3A",
    },


    recordCard: {
      marginBottom: 13,

      padding: 16,

      borderRadius: 19,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor:
        "#E1E7E2",
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
      justifyContent:
        "center",
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
      fontSize: 14,
      fontWeight: "900",
      color: "#2D4035",
    },

    latestBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,

      borderRadius: 10,

      backgroundColor:
        "#E5F2E7",
    },

    latestText: {
      fontSize: 7,
      fontWeight: "800",
      color: "#176B3A",
    },

    dateRow: {
      marginTop: 5,

      flexDirection: "row",
      alignItems: "center",

      gap: 4,
    },

    dateText: {
      fontSize: 9,
      color: "#7D8981",
    },

    divider: {
      height: 1,

      marginVertical: 14,

      backgroundColor:
        "#EDF1EE",
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

      backgroundColor:
        "#F0F4F1",

      alignItems: "center",
      justifyContent:
        "center",
    },

    detailContent: {
      flex: 1,

      marginLeft: 10,
    },

    detailLabel: {
      fontSize: 8,
      fontWeight: "700",
      color: "#849088",
    },

    detailValue: {
      marginTop: 3,

      fontSize: 10,
      lineHeight: 15,

      color: "#394A40",
    },


    nextDueCard: {
      marginTop: 3,

      padding: 11,

      borderRadius: 13,

      backgroundColor:
        "#FFF7DC",

      flexDirection: "row",
      alignItems: "center",
    },

    nextDueIcon: {
      width: 35,
      height: 35,

      borderRadius: 11,

      backgroundColor:
        "#FFEDB6",

      alignItems: "center",
      justifyContent:
        "center",
    },

    nextDueInfo: {
      flex: 1,

      marginLeft: 9,
    },

    nextDueLabel: {
      fontSize: 7,
      fontWeight: "700",
      color: "#8A743B",
    },

    nextDueDate: {
      marginTop: 2,

      fontSize: 10,
      fontWeight: "800",
      color: "#715819",
    },

    dueBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,

      borderRadius: 10,
    },

    overdueBadge: {
      backgroundColor:
        "#F7DDDA",
    },

    overdueText: {
      fontSize: 7,
      fontWeight: "900",
      color: "#A3453C",
    },

    todayBadge: {
      backgroundColor:
        "#FFE8A6",
    },

    todayText: {
      fontSize: 7,
      fontWeight: "900",
      color: "#876415",
    },

    soonBadge: {
      backgroundColor:
        "#FFF0C4",
    },

    soonText: {
      fontSize: 7,
      fontWeight: "900",
      color: "#876415",
    },


    clinicFooter: {
      marginTop: 14,
      paddingTop: 13,

      borderTopWidth: 1,
      borderTopColor:
        "#EDF1EE",

      flexDirection: "row",
      alignItems: "center",
    },

    clinicIcon: {
      width: 32,
      height: 32,

      borderRadius: 10,

      backgroundColor:
        "#EAF4EB",

      alignItems: "center",
      justifyContent:
        "center",
    },

    clinicInfo: {
      flex: 1,

      marginLeft: 9,
    },

    clinicLabel: {
      fontSize: 7,
      color: "#8A958E",
    },

    clinicName: {
      marginTop: 2,

      fontSize: 9,
      fontWeight: "800",
      color: "#415348",
    },


    emptyCard: {
      padding: 27,

      borderRadius: 19,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor:
        "#E1E7E2",

      alignItems: "center",
    },

    emptyIcon: {
      width: 67,
      height: 67,

      borderRadius: 22,

      backgroundColor:
        "#EDF4EE",

      alignItems: "center",
      justifyContent:
        "center",
    },

    emptyTitle: {
      marginTop: 13,

      fontSize: 15,
      fontWeight: "900",
      color: "#31453A",
    },

    emptyText: {
      marginTop: 6,

      maxWidth: 270,

      fontSize: 9,
      lineHeight: 15,

      textAlign: "center",

      color: "#7D8981",
    },

    emptyButton: {
      marginTop: 17,

      height: 43,

      paddingHorizontal: 17,

      borderRadius: 13,

      backgroundColor:
        "#176B3A",

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",

      gap: 6,
    },

    emptyButtonText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#FFFFFF",
    },


    securityCard: {
      marginTop: 12,

      padding: 14,

      borderRadius: 15,

      backgroundColor:
        "#EFF6F0",

      flexDirection: "row",
      alignItems: "flex-start",

      gap: 9,
    },

    securityText: {
      flex: 1,

      fontSize: 9,
      lineHeight: 15,

      color: "#617167",
    },


    completeButton: {
      marginTop: 10,
      minHeight: 58,
      paddingHorizontal: 13,
      paddingVertical: 10,

      borderRadius: 14,

      backgroundColor: "#176B3A",

      flexDirection: "row",
      alignItems: "center",
    },

    completeButtonIcon: {
      width: 34,
      height: 34,

      borderRadius: 11,

      backgroundColor:
        "rgba(255,255,255,0.16)",

      alignItems: "center",
      justifyContent: "center",
    },

    completeButtonInfo: {
      flex: 1,

      marginLeft: 10,
      marginRight: 6,
    },

    completeButtonTitle: {
      fontSize: 10,
      fontWeight: "900",
      color: "#FFFFFF",
    },

    completeButtonText: {
      marginTop: 2,

      fontSize: 7,
      lineHeight: 11,

      color: "#D9EADF",
    },

    completedDueCard: {
      backgroundColor: "#EAF5EC",
    },

    completedDueIcon: {
      backgroundColor: "#D5EBD9",
    },

    completedDueLabel: {
      color: "#5D8067",
    },

    completedDueDate: {
      color: "#176B3A",
    },

    completedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,

      borderRadius: 10,

      backgroundColor: "#D5EBD9",
    },

    completedBadgeText: {
      fontSize: 7,
      fontWeight: "900",
      color: "#176B3A",
    },

    cancelledDueCard: {
      backgroundColor: "#F8EEEE",
    },

    cancelledDueIcon: {
      backgroundColor: "#EFDADA",
    },

    cancelledDueLabel: {
      color: "#93645F",
    },

    cancelledDueDate: {
      color: "#8E4E49",
    },

    cancelledBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,

      borderRadius: 10,

      backgroundColor: "#EFDADA",
    },

    cancelledBadgeText: {
      fontSize: 7,
      fontWeight: "900",
      color: "#8E4E49",
    },

    pressed: {
      opacity: 0.75,
    },
  });
