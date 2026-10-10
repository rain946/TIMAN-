import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useSegments,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { timanShadow } from "../../components/timan/theme";

import { API_URL, getImageUrl } from "../../config/api";

type ScheduleStatus = "Pending" | "Completed" | "Cancelled";
type TimingCategory = "Overdue" | "Today" | "Due Soon" | "Upcoming";
type DailyFilter = "scheduled" | "completed" | "cancelled" | "rescheduled";

type ClinicSchedule = {
  record_id: number;
  pet_id: number;
  visit_date: string;
  service_type: string;
  next_service_type: string | null;
  follow_up_plan: string | null;
  next_due_date: string;
  schedule_status: ScheduleStatus;
  completed_at: string | null;
  created_at: string;
  pet_name: string;
  owner_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  can_open: boolean;
  is_added_this_month: boolean;
  is_completed_this_month: boolean;
  is_cancelled_this_month: boolean;
  is_rescheduled_this_month: boolean;
  booked_date: string;
  completed_date: string | null;
  cancelled_date: string | null;
  cancellation_reason: string | null;
  rescheduled_date: string | null;
};

const DAILY_CARDS: {
  filter: DailyFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { filter: "scheduled", label: "Scheduled", icon: "calendar-outline" },
  { filter: "completed", label: "Completed", icon: "checkmark-circle-outline" },
  { filter: "cancelled", label: "Cancelled", icon: "close-circle-outline" },
  { filter: "rescheduled", label: "Rescheduled", icon: "calendar-number-outline" },
];

export default function ClinicSchedulesScreen() {
  const params = useLocalSearchParams<{
    date?: string;
    filter?: string;
    recordId?: string;
  }>();
  const segments = useSegments();
  const isTabScreen = segments.some((segment) => String(segment) === "(tabs)");
  const [schedules, setSchedules] = useState<ClinicSchedule[]>([]);
  const [selectedDailyFilter, setSelectedDailyFilter] =
    useState<DailyFilter>("scheduled");
  const [selectedDate, setSelectedDate] = useState(getManilaTodayDateOnly);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedRecordId, setFocusedRecordId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestInFlight = useRef(false);

  useEffect(() => {
    const requestedFilter = normalizeDailyFilter(params.filter);
    const requestedDate = normalizeDateOnly(params.date);
    const requestedRecordId = Number(params.recordId);

    if (requestedFilter) setSelectedDailyFilter(requestedFilter);
    if (requestedDate) setSelectedDate(requestedDate);
    setFocusedRecordId(
      Number.isInteger(requestedRecordId) && requestedRecordId > 0
        ? requestedRecordId
        : null,
    );
  }, [params.date, params.filter, params.recordId]);

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
      void loadSchedules();
    }, [loadSchedules]),
  );

  const dailyCounts = useMemo(
    () => ({
      scheduled: schedules.filter(
        (schedule) =>
          schedule.schedule_status === "Pending" &&
          schedule.next_due_date === selectedDate,
      ).length,
      completed: schedules.filter(
        (schedule) => schedule.completed_date === selectedDate,
      ).length,
      cancelled: schedules.filter(
        (schedule) => schedule.cancelled_date === selectedDate,
      ).length,
      rescheduled: schedules.filter(
        (schedule) => schedule.rescheduled_date === selectedDate,
      ).length,
    }),
    [schedules, selectedDate],
  );

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const statusSchedules = useMemo(
    () => {
      if (selectedDailyFilter === "scheduled") {
        return schedules.filter(
          (schedule) =>
            schedule.schedule_status === "Pending" &&
            schedule.next_due_date === selectedDate,
        );
      }
      if (selectedDailyFilter === "completed") {
        return schedules.filter(
          (schedule) => schedule.completed_date === selectedDate,
        );
      }
      if (selectedDailyFilter === "cancelled") {
        return schedules.filter(
          (schedule) => schedule.cancelled_date === selectedDate,
        );
      }
      return schedules.filter(
        (schedule) => schedule.rescheduled_date === selectedDate,
      );
    },
    [schedules, selectedDailyFilter, selectedDate],
  );
  const visibleSchedules = useMemo(
    () =>
      statusSchedules.filter((schedule) => {
        if (focusedRecordId && schedule.record_id !== focusedRecordId) {
          return false;
        }
        if (!normalizedSearch) return true;
        return [
          schedule.pet_name,
          schedule.owner_name,
          schedule.next_service_type,
          schedule.service_type,
          schedule.breed,
          schedule.species,
        ].some((value) =>
          String(value || "")
            .toLocaleLowerCase()
            .includes(normalizedSearch),
        );
      }),
    [focusedRecordId, normalizedSearch, statusSchedules],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void loadSchedules(false);
  }, [loadSchedules]);

  const openCalendar = () => {
    const current = dateFromDateOnly(selectedDate) || new Date();
    if (Platform.OS === "ios") {
      setShowIosDatePicker(true);
      return;
    }
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      onChange: (event, date) => {
        if (event.type === "set" && date) {
          setSelectedDate(formatDateValue(date));
        }
      },
    });
  };

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
            <Ionicons name="arrow-back" size={23} color="#2E3A34" />
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
            tintColor="#2E7D6B"
          />
        }
      >
        <Text style={styles.subtitle}>
          Pet health schedules managed by your clinic
        </Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#6B7C73" />
          <TextInput
            accessibilityLabel="Search schedules"
            value={search}
            onChangeText={setSearch}
            placeholder="Search pet or owner..."
            placeholderTextColor="#6B7C73"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSearch("")}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={19} color="#6B7C73" />
            </Pressable>
          )}
        </View>

        {!loading && !error && (
          <View style={styles.calendarSection}>
            <Text style={styles.calendarLabel}>View schedules by date</Text>
            <View style={styles.calendarRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose schedule date"
                style={({ pressed }) => [
                  styles.calendarButton,
                  pressed && styles.pressed,
                ]}
                onPress={openCalendar}
              >
                <Ionicons name="calendar-outline" size={20} color="#2E7D6B" />
                <Text style={styles.calendarDate}>
                  {formatDateOnly(selectedDate)}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7C73" />
              </Pressable>
              {selectedDate !== getManilaTodayDateOnly() && (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.todayButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setSelectedDate(getManilaTodayDateOnly())}
                >
                  <Text style={styles.todayButtonText}>Today</Text>
                </Pressable>
              )}
            </View>
            {showIosDatePicker && Platform.OS === "ios" && (
              <View style={styles.iosPickerCard}>
                <DateTimePicker
                  value={dateFromDateOnly(selectedDate) || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) =>
                    date && setSelectedDate(formatDateValue(date))
                  }
                />
                <Pressable
                  style={styles.iosPickerDone}
                  onPress={() => setShowIosDatePicker(false)}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {!loading && !error ? (
          <>
            <Text style={styles.todayTitle}>
              {selectedDate === getManilaTodayDateOnly()
                ? "Today"
                : formatDateOnly(selectedDate)}
            </Text>
            <View style={styles.summaryGrid}>
              {[DAILY_CARDS.slice(0, 2), DAILY_CARDS.slice(2, 4)].map(
                (row, rowIndex) => (
                  <View key={rowIndex} style={styles.summaryRow}>
                    {row.map((item) => (
                      <StatusCard
                        key={item.filter}
                        filter={item.filter}
                        label={item.label}
                        icon={item.icon}
                        count={dailyCounts[item.filter]}
                        selected={selectedDailyFilter === item.filter}
                        onPress={() => {
                          setFocusedRecordId(null);
                          setSelectedDailyFilter(item.filter);
                        }}
                      />
                    ))}
                  </View>
                ),
              )}
            </View>
          </>
        ) : null}

        {!loading && !error && (
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {getListTitle(selectedDailyFilter, selectedDate)}
            </Text>
            <Text style={styles.listCount}>
              {visibleSchedules.length}{" "}
              {visibleSchedules.length === 1 ? "schedule" : "schedules"}
            </Text>
          </View>
        )}

        {loading ? (
          <StateCard>
            <ActivityIndicator color="#2E7D6B" />
            <Text style={styles.loadingText}>Loading schedules...</Text>
          </StateCard>
        ) : error ? (
          <StateCard>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={29} color="#E57373" />
            </View>
            <Text style={styles.stateTitle}>Unable to load schedules.</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
              onPress={() => void loadSchedules()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </StateCard>
        ) : showSearchEmpty ? (
          <StateCard>
            <View style={styles.emptyIconMuted}>
              <Ionicons name="search-outline" size={29} color="#6B7C73" />
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
          <EmptyState
            filter={selectedDailyFilter}
            selectedDate={selectedDate}
          />
        ) : (
          <View style={styles.scheduleList}>
            {visibleSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.record_id}
                schedule={schedule}
                view={selectedDailyFilter}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusCard({
  filter,
  label,
  icon,
  count,
  selected,
  onPress,
}: {
  filter: DailyFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const tone = getDailyTone(filter);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryCard,
        selected && { borderColor: tone.color },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.summaryTopRow}>
        <View
          style={[styles.summaryIcon, { backgroundColor: tone.backgroundColor }]}
        >
          <Ionicons name={icon} size={20} color={tone.color} />
        </View>
        <Text style={styles.summaryValue}>{count}</Text>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.summaryLabel, selected && { color: tone.color }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ScheduleCard({
  schedule,
  view,
}: {
  schedule: ClinicSchedule;
  view: DailyFilter;
}) {
  const imageUrl = getImageUrl(schedule.photo_url);
  const nextService = schedule.next_service_type?.trim() || schedule.service_type;
  const timing = getTimingState(schedule.next_due_date);
  const historyTone =
    schedule.schedule_status === "Completed"
      ? { label: "COMPLETED", color: "#2E7D6B", backgroundColor: "#CFE8DD" }
      : {
          label: "CANCELLED",
          color: "#E57373",
          backgroundColor: "rgba(229, 115, 115, 0.14)",
        };
  const rescheduledTone = {
    label: "RESCHEDULED",
    color: "#F5A623",
    backgroundColor: "#FAD7A0",
  };
  const badge =
    view === "rescheduled"
      ? rescheduledTone
      : schedule.schedule_status === "Pending"
        ? timing
        : historyTone;

  return (
    <View style={styles.scheduleCard}>
      <View style={styles.photoContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.petPhoto} />
        ) : (
          <Ionicons name="paw" size={25} color="#2E7D6B" />
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.petName} numberOfLines={1}>
          {schedule.pet_name}
        </Text>
        <Text style={styles.serviceType} numberOfLines={1}>
          {nextService}
        </Text>
        <Text style={styles.ownerName} numberOfLines={1}>
          Owner: {schedule.owner_name || "—"}
        </Text>
        <View style={styles.scheduleMetaRow}>
          <Text style={styles.dueDate}>
            {formatDateOnly(schedule.next_due_date)}
          </Text>
          <View
            style={[styles.timingBadge, { backgroundColor: badge.backgroundColor }]}
          >
            <Text style={[styles.timingBadgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        </View>
        {view === "cancelled" ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Cancellation reason</Text>
            <Text style={styles.reasonText}>
              {schedule.cancellation_reason?.trim() ||
                "Reason not available for this earlier cancellation."}
            </Text>
          </View>
        ) : null}
      </View>

    </View>
  );
}

function EmptyState({
  filter,
  selectedDate,
}: {
  filter: DailyFilter;
  selectedDate: string;
}) {
  const content = {
    scheduled: {
      title: "No upcoming schedules",
      description: `No pending schedules are due on ${formatDateOnly(selectedDate)}.`,
      icon: "calendar-outline" as const,
    },
    completed: {
      title: "No completed schedules",
      description: `No schedules were completed on ${formatDateOnly(selectedDate)}.`,
      icon: "checkmark-circle-outline" as const,
    },
    cancelled: {
      title: "No cancelled schedules",
      description: `No schedules were cancelled on ${formatDateOnly(selectedDate)}.`,
      icon: "close-circle-outline" as const,
    },
    rescheduled: {
      title: "No rescheduled schedules",
      description: `No schedules were rescheduled on ${formatDateOnly(selectedDate)}.`,
      icon: "calendar-number-outline" as const,
    },
  }[filter];

  return (
    <StateCard>
      <View style={styles.emptyIcon}>
        <Ionicons name={content.icon} size={29} color="#2E7D6B" />
      </View>
      <Text style={styles.stateTitle}>{content.title}</Text>
      <Text style={styles.stateDescription}>{content.description}</Text>
    </StateCard>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.stateCard}>{children}</View>;
}

function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(value || "").slice(0, 10),
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const validationDate = new Date(year, month - 1, day);
  if (
    validationDate.getFullYear() !== year ||
    validationDate.getMonth() !== month - 1 ||
    validationDate.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function getListTitle(
  filter: DailyFilter,
  selectedDate: string,
) {
  const dateLabel =
    selectedDate === getManilaTodayDateOnly()
      ? "Today"
      : formatDateOnly(selectedDate);
  if (filter === "scheduled") return `Scheduled ${dateLabel}`;
  if (filter === "completed") return `Completed ${dateLabel}`;
  if (filter === "cancelled") return `Cancelled ${dateLabel}`;
  return `Rescheduled ${dateLabel}`;
}

function normalizeDailyFilter(value?: string): DailyFilter | null {
  return value === "scheduled" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "rescheduled"
    ? value
    : null;
}

function normalizeDateOnly(value?: string) {
  return value && parseDateParts(value) ? value.slice(0, 10) : null;
}

function getManilaTodayDateOnly() {
  const parts = getManilaTodayParts();
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dateFromDateOnly(value: string) {
  const parts = parseDateParts(value);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getManilaTodayParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function getDaysUntilDue(value: string) {
  const due = parseDateParts(value);
  if (!due) return null;
  const today = getManilaTodayParts();
  const dueDay = Date.UTC(due.year, due.month - 1, due.day) / 86_400_000;
  const todayDay =
    Date.UTC(today.year, today.month - 1, today.day) / 86_400_000;
  return Math.round(dueDay - todayDay);
}

function getTimingCategory(value: string): TimingCategory {
  const days = getDaysUntilDue(value);
  if (days === null || days > 7) return "Upcoming";
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  return "Due Soon";
}

function getCategoryTone(category: TimingCategory) {
  if (category === "Overdue") {
    return {
      color: "#E57373",
      backgroundColor: "rgba(229, 115, 115, 0.14)",
    };
  }
  if (category === "Today" || category === "Due Soon") {
    return { color: "#F5A623", backgroundColor: "#FAD7A0" };
  }
  return { color: "#2E7D6B", backgroundColor: "#CFE8DD" };
}

function getDailyTone(filter: DailyFilter) {
  if (filter === "cancelled") {
    return {
      color: "#E57373",
      backgroundColor: "rgba(229, 115, 115, 0.14)",
    };
  }
  if (filter === "completed") {
    return { color: "#2E7D6B", backgroundColor: "#CFE8DD" };
  }
  if (filter === "rescheduled") {
    return { color: "#64B5F6", backgroundColor: "rgba(100, 181, 246, 0.16)" };
  }
  return { color: "#F5A623", backgroundColor: "#FAD7A0" };
}

function getTimingState(value: string) {
  const days = getDaysUntilDue(value);
  const category = getTimingCategory(value);
  const tone = getCategoryTone(category);
  let label = "UPCOMING";

  if (days !== null && days < 0) label = "OVERDUE";
  else if (days === 0) label = "TODAY";
  else if (days !== null && days <= 7) label = "DUE SOON";

  return { label, ...tone };
}

function formatDateOnly(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return "Date unavailable";
  return new Date(parts.year, parts.month - 1, parts.day).toLocaleDateString([], {
    month: "short",
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
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#2E3A34" },
  headerSpacer: { width: 44, height: 44 },
  content: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },
  subtitle: { fontSize: 14, color: "#6B7C73" },
  searchContainer: {
    minHeight: 50,
    marginTop: 17,
    borderRadius: 15,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    marginHorizontal: 10,
    paddingVertical: 0,
    fontSize: 15,
    color: "#2E3A34",
  },
  calendarSection: { marginTop: 17 },
  calendarLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7C73",
  },
  calendarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  calendarButton: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  calendarDate: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#2E3A34",
  },
  todayButton: {
    minHeight: 50,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  todayButtonText: { fontSize: 12, fontWeight: "900", color: "#2E7D6B" },
  iosPickerCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  iosPickerDone: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#2E7D6B",
  },
  iosPickerDoneText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  summaryGrid: {
    marginTop: 12,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  todayTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "900",
    color: "#2E3A34",
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    height: 104,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2E3A34",
  },
  summaryLabel: {
    marginTop: 11,
    width: "100%",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#6B7C73",
    textAlign: "left",
  },
  listHeader: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: { fontSize: 19, fontWeight: "900", color: "#2E3A34" },
  listCount: { fontSize: 12, fontWeight: "700", color: "#6B7C73" },
  scheduleList: { gap: 11 },
  scheduleCard: {
    ...timanShadow,
    minHeight: 136,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  photoContainer: {
    width: 62,
    height: 62,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  petPhoto: { width: "100%", height: "100%" },
  cardContent: { flex: 1, minWidth: 0, marginLeft: 13, marginRight: 8 },
  petName: { fontSize: 17, fontWeight: "900", color: "#2E3A34" },
  ownerName: { marginTop: 2, fontSize: 12, color: "#6B7C73" },
  serviceType: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "#2E3A34",
  },
  dueDate: { marginTop: 3, fontSize: 12, color: "#6B7C73" },
  scheduleMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reasonBox: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(229, 115, 115, 0.10)",
  },
  reasonLabel: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#E57373",
  },
  reasonText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#2E3A34",
  },
  timingBadge: {
    minHeight: 23,
    borderRadius: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  timingBadgeText: { fontSize: 10, fontWeight: "900" },
  stateCard: {
    minHeight: 245,
    marginTop: 12,
    borderRadius: 19,
    padding: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, fontSize: 13, color: "#6B7C73" },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconMuted: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    marginTop: 13,
    fontSize: 16,
    fontWeight: "900",
    color: "#2E3A34",
    textAlign: "center",
  },
  stateDescription: {
    maxWidth: 280,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: "#6B7C73",
    textAlign: "center",
  },
  retryButton: {
    minWidth: 108,
    minHeight: 42,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#2E7D6B",
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
    borderColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { fontSize: 13, fontWeight: "900", color: "#2E7D6B" },
  pressed: { opacity: 0.72 },
});
