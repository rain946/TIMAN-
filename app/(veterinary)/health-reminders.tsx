import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL } from "../../config/api";





type HealthSchedule = {
  record_id: number;
  pet_id: number;
  pet_name: string;
  species?: string | null;
  breed?: string | null;
  photo_url?: string | null;
  service_type: string;
  visit_date?: string | null;
  next_due_date: string;
  days_until_due: number | string;
};

type HealthOverviewResponse = {
  success: boolean;
  allSchedules?: HealthSchedule[];
  message?: string;
};

type ReminderStatus =
  | "Overdue"
  | "Due Soon"
  | "Upcoming";

type HealthFilter =
  | "overdue"
  | "dueSoon"
  | "upcoming";





export default function HealthRemindersScreen() {
  const { filter } = useLocalSearchParams<{
    filter?: string;
  }>();

  const routeFilter: HealthFilter | null =
    filter === "overdue" ||
    filter === "dueSoon" ||
    filter === "upcoming"
      ? filter
      : null;

  const [selectedFilter, setSelectedFilter] =
    useState<HealthFilter | null>(routeFilter);

  useEffect(() => {
    setSelectedFilter(routeFilter);
  }, [routeFilter]);

  const [reminders, setReminders] = useState<
    HealthSchedule[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);





  const loadReminders = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

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
          `${API_URL}/vet-records/owner-health-overview`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data: HealthOverviewResponse =
          await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Unable to load health reminders."
          );
        }

        setReminders(
          Array.isArray(data.allSchedules)
            ? data.allSchedules
            : []
        );
      } catch (error) {
        console.error(
          "LOAD HEALTH REMINDERS ERROR:",
          error
        );

        Alert.alert(
          "Health Reminders",
          error instanceof Error
            ? error.message
            : "Unable to load health reminders."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  useFocusEffect(
    useCallback(() => {
      loadReminders(true);
    }, [loadReminders])
  );


  const handleRefresh = () => {
    setRefreshing(true);
    loadReminders(false);
  };


  const overdue = useMemo(() => {
    return reminders.filter(
      (item) =>
        Number(item.days_until_due) < 0
    );
  }, [reminders]);

  const dueSoon = useMemo(() => {
    return reminders.filter((item) => {
      const days =
        Number(item.days_until_due);

      return days >= 0 && days <= 7;
    });
  }, [reminders]);

  const upcoming = useMemo(() => {
    return reminders.filter(
      (item) =>
        Number(item.days_until_due) > 7
    );
  }, [reminders]);

  const visibleReminderCount = selectedFilter
    ? selectedFilter === "overdue"
      ? overdue.length
      : selectedFilter === "dueSoon"
      ? dueSoon.length
      : upcoming.length
    : reminders.length;


  const openReminder = (
    reminder: HealthSchedule
  ) => {
    router.push({
      pathname: "/schedules",
      params: {
        petId: String(reminder.pet_id),
      },
    });
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text style={styles.loadingText}>
            Loading health reminders...
          </Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >

        <View style={styles.summaryRow}>
          <SummaryCard
            icon="alert-circle-outline"
            count={overdue.length}
            label="Overdue"
            type="overdue"
            onPress={() =>
              setSelectedFilter("overdue")
            }
          />

          <SummaryCard
            icon="time-outline"
            count={dueSoon.length}
            label="Due Soon"
            type="due"
            onPress={() =>
              setSelectedFilter("dueSoon")
            }
          />

          <SummaryCard
            icon="calendar-outline"
            count={upcoming.length}
            label="Upcoming"
            type="upcoming"
            onPress={() =>
              setSelectedFilter("upcoming")
            }
          />
        </View>


        {visibleReminderCount === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="checkmark-circle-outline"
                size={38}
                color="#176B3A"
              />
            </View>

            <Text style={styles.emptyTitle}>
              No Health Reminders
            </Text>

            <Text style={styles.emptyText}>
              There are currently no pending
              health schedules for your pets.
            </Text>
          </View>
        )}


        {(!selectedFilter ||
          selectedFilter === "overdue") &&
          overdue.length > 0 && (
          <ReminderSection
            title="Overdue"
            subtitle="Schedules that have passed their due date."
            icon="alert-circle"
            status="Overdue"
            reminders={overdue}
            onPress={openReminder}
          />
        )}


        {(!selectedFilter ||
          selectedFilter === "dueSoon") &&
          dueSoon.length > 0 && (
          <ReminderSection
            title="Due Soon"
            subtitle="Due today or within the next 7 days."
            icon="time"
            status="Due Soon"
            reminders={dueSoon}
            onPress={openReminder}
          />
        )}


        {(!selectedFilter ||
          selectedFilter === "upcoming") &&
          upcoming.length > 0 && (
          <ReminderSection
            title="Upcoming"
            subtitle="Health schedules due after 7 days."
            icon="calendar"
            status="Upcoming"
            reminders={upcoming}
            onPress={openReminder}
          />
        )}
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
        onPress={() => router.back()}
      >
        <Ionicons
          name="chevron-back"
          size={27}
          color="#173D2A"
        />
      </Pressable>

      <Text style={styles.headerTitle}>
        Health Reminders
      </Text>

      <View style={styles.headerButton} />
    </View>
  );
}


function SummaryCard({
  icon,
  count,
  label,
  type,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  label: string;
  type: "overdue" | "due" | "upcoming";
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.summaryCard,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.summaryIcon,
          type === "overdue" &&
            styles.overdueIcon,
          type === "due" && styles.dueIcon,
          type === "upcoming" &&
            styles.upcomingIcon,
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={
            type === "overdue"
              ? "#B84C4C"
              : type === "due"
              ? "#A56812"
              : "#176B3A"
          }
        />
      </View>

      <Text
        style={[
          styles.summaryCount,
          type === "overdue" &&
            styles.overdueCount,
          type === "due" &&
            styles.dueCount,
        ]}
      >
        {count}
      </Text>

      <Text style={styles.summaryLabel}>
        {label}
      </Text>
    </Pressable>
  );
}


function ReminderSection({
  title,
  subtitle,
  icon,
  status,
  reminders,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: ReminderStatus;
  reminders: HealthSchedule[];
  onPress: (
    reminder: HealthSchedule
  ) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons
            name={icon}
            size={20}
            color={getStatusColor(status)}
          />

          <Text style={styles.sectionTitle}>
            {title}
          </Text>

          <View
            style={[
              styles.countBadge,
              {
                backgroundColor:
                  getStatusBackground(status),
              },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                {
                  color:
                    getStatusColor(status),
                },
              ]}
            >
              {reminders.length}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>
          {subtitle}
        </Text>
      </View>

      {reminders.map((reminder) => (
        <ReminderCard
          key={reminder.record_id}
          reminder={reminder}
          status={status}
          onPress={() =>
            onPress(reminder)
          }
        />
      ))}
    </View>
  );
}


function ReminderCard({
  reminder,
  status,
  onPress,
}: {
  reminder: HealthSchedule;
  status: ReminderStatus;
  onPress: () => void;
}) {
  const days =
    Number(reminder.days_until_due);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.reminderCard,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.serviceIcon,
          {
            backgroundColor:
              getStatusBackground(status),
          },
        ]}
      >
        <Ionicons
          name={getServiceIcon(
            reminder.service_type
          )}
          size={23}
          color={getStatusColor(status)}
        />
      </View>

      <View style={styles.reminderInfo}>
        <Text
          style={styles.serviceTitle}
          numberOfLines={1}
        >
          {reminder.service_type}
        </Text>

        <View style={styles.petRow}>
          <Ionicons
            name="paw-outline"
            size={13}
            color="#176B3A"
          />

          <Text style={styles.petName}>
            {reminder.pet_name}
          </Text>
        </View>

        <View style={styles.dateRow}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color="#7B8880"
          />

          <Text style={styles.dateText}>
            {formatDueText(
              days,
              reminder.next_due_date
            )}
          </Text>
        </View>
      </View>

      <View style={styles.rightSide}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                getStatusBackground(status),
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  getStatusColor(status),
              },
            ]}
          >
            {getStatusText(
              status,
              days
            )}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color="#A0AAA4"
        />
      </View>
    </Pressable>
  );
}


function getStatusColor(
  status: ReminderStatus
) {
  if (status === "Overdue") {
    return "#B84C4C";
  }

  if (status === "Due Soon") {
    return "#A56812";
  }

  return "#176B3A";
}

function getStatusBackground(
  status: ReminderStatus
) {
  if (status === "Overdue") {
    return "#FDE5E2";
  }

  if (status === "Due Soon") {
    return "#FFF0D5";
  }

  return "#E8F5EA";
}

function getStatusText(
  status: ReminderStatus,
  days: number
) {
  if (status === "Overdue") {
    const lateDays = Math.abs(days);

    return lateDays === 1
      ? "1 day late"
      : `${lateDays} days late`;
  }

  if (status === "Due Soon") {
    if (days === 0) {
      return "Today";
    }

    if (days === 1) {
      return "Tomorrow";
    }

    return `${days} days`;
  }

  return "Scheduled";
}

function formatDueText(
  days: number,
  date: string
) {
  if (days === 0) {
    return "Due today";
  }

  if (days === 1) {
    return "Due tomorrow";
  }

  if (days > 1 && days <= 7) {
    return `Due in ${days} days`;
  }

  if (days === -1) {
    return "Overdue by 1 day";
  }

  if (days < -1) {
    return `Overdue by ${Math.abs(
      days
    )} days`;
  }

  return `Due ${formatDate(date)}`;
}

function formatDate(value: string) {
  if (!value) {
    return "No due date";
  }

  const cleanDate =
    String(value).split("T")[0];

  const parts =
    cleanDate.split("-");

  if (parts.length !== 3) {
    return cleanDate;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const date = new Date(
    year,
    month - 1,
    day
  );

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function getServiceIcon(
  serviceType: string
): keyof typeof Ionicons.glyphMap {
  const service =
    serviceType.toLowerCase();

  if (service.includes("vacc")) {
    return "shield-checkmark-outline";
  }

  if (service.includes("deworm")) {
    return "fitness-outline";
  }

  if (service.includes("surgery")) {
    return "bandage-outline";
  }

  if (service.includes("check")) {
    return "heart-outline";
  }

  if (service.includes("treatment")) {
    return "medkit-outline";
  }

  return "medical-outline";
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EE",
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
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

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 11,
    fontSize: 11,
    color: "#758279",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },

  summaryCard: {
    flex: 1,
    minHeight: 108,
    paddingVertical: 12,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7E2",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  overdueIcon: {
    backgroundColor: "#FDE5E2",
  },

  dueIcon: {
    backgroundColor: "#FFF0D5",
  },

  upcomingIcon: {
    backgroundColor: "#E8F5EA",
  },

  summaryCount: {
    marginTop: 6,
    fontSize: 21,
    fontWeight: "900",
    color: "#176B3A",
  },

  overdueCount: {
    color: "#B84C4C",
  },

  dueCount: {
    color: "#A56812",
  },

  summaryLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "700",
    color: "#7A877F",
  },

  emptyCard: {
    marginTop: 25,
    padding: 28,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7E2",
    alignItems: "center",
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
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
    textAlign: "center",
    fontSize: 10,
    lineHeight: 16,
    color: "#7D8981",
  },

  section: {
    marginTop: 27,
  },

  sectionHeader: {
    marginBottom: 11,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2B3D32",
  },

  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    fontSize: 9,
    fontWeight: "900",
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 9,
    color: "#7C8981",
  },

  reminderCard: {
    minHeight: 100,
    marginBottom: 11,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7E2",
    flexDirection: "row",
    alignItems: "center",
  },

  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  reminderInfo: {
    flex: 1,
    marginLeft: 12,
  },

  serviceTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#2E4036",
  },

  petRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  petName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#176B3A",
  },

  dateRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  dateText: {
    fontSize: 10,
    color: "#7B8880",
  },

  rightSide: {
    marginLeft: 7,
    alignItems: "flex-end",
    gap: 10,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },

  statusText: {
    fontSize: 8,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.7,
  },
});
