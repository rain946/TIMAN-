import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  default as DateTimePicker,
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import {
  timanColors,
  timanRadii,
  timanShadow,
  timanSpacing,
} from "../../components/timan/theme";

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
  next_service_type: string | null;
  follow_up_plan: string | null;
  schedule_status: "Pending" | "Completed" | "Cancelled";

  completed_at: string | null;
  rescheduled_at: string | null;
  created_at: string;
  clinic_contact_name: string;
  clinic_name: string | null;
};

type ScheduleItem = VetRecord & {
  next_due_date: string;
  daysRemaining: number;
};

type ScheduleStatus = "Overdue" | "Due Soon" | "Upcoming";
type ScheduleTab = "Medical" | "Personal Care";
type MedicalFilter = "All" | ScheduleStatus;

type PersonalCareSchedule = {
  care_schedule_id: number;
  pet_id: number;
  pet_name: string;
  care_type: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  repeat_type: "None" | "Weekly" | "Monthly";
  series_id?: string | null;
  notes: string | null;
  status: "Pending" | "Completed" | "Cancelled";
  completed_at: string | null;
  cancelled_at: string | null;
};

export default function SchedulesScreen() {
  const params = useLocalSearchParams<{
    petId?: string;
  }>();

  const petId = params.petId;

  const [pet, setPet] = useState<Pet | null>(null);

  const [records, setRecords] = useState<VetRecord[]>([]);
  const [personalCare, setPersonalCare] = useState<PersonalCareSchedule[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ScheduleTab>("Medical");
  const [medicalFilter, setMedicalFilter] = useState<MedicalFilter>("All");

  const [updatingCareId, setUpdatingCareId] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const tabsOffsetRef = useRef(0);

  const [updatingScheduleId, setUpdatingScheduleId] = useState<number | null>(
    null,
  );

  const [iosRescheduleSchedule, setIosRescheduleSchedule] =
    useState<ScheduleItem | null>(null);
  const [iosRescheduleDate, setIosRescheduleDate] = useState<Date>(() =>
    getTomorrowStart(),
  );
  const [cancelSchedule, setCancelSchedule] = useState<ScheduleItem | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");

  const loadSchedules = useCallback(
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
        setLoadError(null);

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

        console.log("OWNER SCHEDULE STATUS:", response.status);

        console.log("OWNER SCHEDULE RESPONSE:", data);

        if (!response.ok) {
          const message = data.message || "Unable to load pet schedules.";
          setLoadError(message);
          Alert.alert(
            "Unable to Load",
            message,
          );

          return;
        }

        setPet(data.pet || null);

        setRecords(Array.isArray(data.records) ? data.records : []);

        const careResponse = await fetch(
          `${API_URL}/pet-care-schedules?pet_id=${petId}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const careData = await careResponse.json();
        if (!careResponse.ok)
          throw new Error(
            careData.message || "Unable to load personal care schedules.",
          );
        setPersonalCare(
          Array.isArray(careData.schedules) ? careData.schedules : [],
        );
      } catch (error) {
        console.log("LOAD SCHEDULE ERROR:", error);

        const message =
          error instanceof Error
            ? error.message
            : "Unable to connect to the TIMAN server.";
        setLoadError(message);

        Alert.alert(
          "Connection Error",
          message,
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
      loadSchedules();

      return () => {};
    }, [loadSchedules]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSchedules(false);
  };

  const updatePersonalCare = async (
    schedule: PersonalCareSchedule,
    action: "complete" | "cancel",
    scope?: "occurrence" | "series",
  ) => {
    if (updatingCareId !== null) return;
    setUpdatingCareId(schedule.care_schedule_id);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const response = await fetch(
        `${API_URL}/pet-care-schedules/${schedule.care_schedule_id}/${action}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: action === "cancel" ? JSON.stringify({ scope }) : undefined,
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || "Unable to update personal care schedule.",
        );
      await loadSchedules(false);
      Alert.alert(
        action === "complete" ? "Care Marked Done" : "Care Cancelled",
        data.message,
      );
    } catch (error) {
      Alert.alert(
        "Unable to Update",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUpdatingCareId(null);
    }
  };

  const openPersonalCareEditor = (
    item: PersonalCareSchedule,
    scope: "occurrence" | "series" = "occurrence",
  ) => {
    router.push({
      pathname: "/(veterinary)/pet-care-schedule-form",
      params: {
        petId: String(item.pet_id),
        petName: item.pet_name,
        scheduleId: String(item.care_schedule_id),
        scope,
      },
    });
  };

  const choosePersonalCareEditScope = (item: PersonalCareSchedule) => {
    if (item.repeat_type === "None") return openPersonalCareEditor(item);
    Alert.alert(
      "Reschedule Recurring Care",
      "Should this change apply only to this occurrence or to the recurring series?",
      [
        { text: "Keep", style: "cancel" },
        { text: "This Occurrence", onPress: () => openPersonalCareEditor(item, "occurrence") },
        { text: "Entire Series", onPress: () => openPersonalCareEditor(item, "series") },
      ],
    );
  };

  const confirmPersonalCareCancel = (item: PersonalCareSchedule) => {
    if (item.repeat_type === "None") {
      Alert.alert("Cancel Personal Care?", "This reminder will remain in history.", [
        { text: "Keep", style: "cancel" },
        { text: "Cancel Schedule", style: "destructive", onPress: () => void updatePersonalCare(item, "cancel", "occurrence") },
      ]);
      return;
    }
    Alert.alert(
      "Cancel Recurring Care?",
      "Cancel only this occurrence or stop the entire recurring series? Cancelled care remains in history.",
      [
        { text: "Keep", style: "cancel" },
        { text: "This Occurrence", onPress: () => void updatePersonalCare(item, "cancel", "occurrence") },
        { text: "Entire Series", style: "destructive", onPress: () => void updatePersonalCare(item, "cancel", "series") },
      ],
    );
  };

  const updateSchedule = useCallback(
    async (
      schedule: ScheduleItem,
      action: "cancel" | "reschedule",
      nextDueDate?: string,
      cancellationReason?: string,
    ) => {
      if (updatingScheduleId !== null) return;
      setUpdatingScheduleId(schedule.record_id);
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }
        const response = await fetch(
          `${API_URL}/vet-records/${schedule.record_id}/${action}`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body:
              action === "reschedule"
                ? JSON.stringify({ next_due_date: nextDueDate })
                : JSON.stringify({ reason: cancellationReason }),
          },
        );
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
          throw new Error(data.message || `Unable to ${action} the schedule.`);
        }
        await loadSchedules(false);
        Alert.alert(
          action === "cancel" ? "Schedule Cancelled" : "Treatment Rescheduled",
          data.message,
        );
      } catch (error) {
        Alert.alert(
          action === "cancel" ? "Unable to Cancel" : "Unable to Reschedule",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setUpdatingScheduleId(null);
      }
    },
    [loadSchedules, updatingScheduleId],
  );

  const confirmCancel = useCallback(
    (schedule: ScheduleItem) => {
      if (schedule.daysRemaining <= 3) {
        Alert.alert(
          "Reschedule Required",
          "This schedule is already within 3 days of its due date and can no longer be cancelled. Please reschedule it instead.",
        );
        return;
      }
      setCancelReason("");
      setCancelSchedule(schedule);
    },
    [],
  );

  const closeCancelDialog = useCallback(() => {
    if (updatingScheduleId !== null) return;
    setCancelSchedule(null);
    setCancelReason("");
  }, [updatingScheduleId]);

  const submitCancellation = useCallback(() => {
    if (!cancelSchedule || updatingScheduleId !== null) return;
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      Alert.alert(
        "Reason Required",
        "Please enter a short reason for the clinic (at least 5 characters).",
      );
      return;
    }
    const schedule = cancelSchedule;
    setCancelSchedule(null);
    setCancelReason("");
    void updateSchedule(schedule, "cancel", undefined, reason);
  }, [cancelReason, cancelSchedule, updateSchedule, updatingScheduleId]);

  const confirmReschedule = useCallback(
    (schedule: ScheduleItem, selectedDate: Date) => {
      const nextDueDate = formatDateValue(selectedDate);
      Alert.alert(
        "Reschedule Treatment",
        `Current: ${formatDate(schedule.next_due_date)}\n\nNew Date: ${formatDate(nextDueDate)}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm Reschedule",
            onPress: () =>
              void updateSchedule(schedule, "reschedule", nextDueDate),
          },
        ],
      );
    },
    [updateSchedule],
  );

  const openReschedulePicker = useCallback(
    (schedule: ScheduleItem) => {
      if (Platform.OS !== "android") {
        setIosRescheduleDate(getInitialRescheduleDate(schedule.next_due_date));
        setIosRescheduleSchedule(schedule);
        return;
      }
      const tomorrow = getTomorrowStart();
      const initialDate = getInitialRescheduleDate(schedule.next_due_date);
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: "date",
        minimumDate: tomorrow,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === "set" && selectedDate) {
            confirmReschedule(schedule, selectedDate);
          }
        },
      });
    },
    [confirmReschedule],
  );

  const schedules = useMemo<ScheduleItem[]>(() => {
    const today = getTodayStart();

    return records
      .filter(
        (
          record,
        ): record is VetRecord & {
          next_due_date: string;
        } =>
          Boolean(record.next_due_date) && record.schedule_status === "Pending",
      )
      .map((record) => {
        const dueDate = parseDatabaseDate(record.next_due_date);

        if (!dueDate) {
          return null;
        }

        dueDate.setHours(0, 0, 0, 0);

        const difference = dueDate.getTime() - today.getTime();

        const daysRemaining = Math.round(difference / (1000 * 60 * 60 * 24));

        return {
          ...record,
          daysRemaining,
        };
      })
      .filter((item): item is ScheduleItem => item !== null)
      .sort((a, b) => {
        const dateA = parseDatabaseDate(a.next_due_date);

        const dateB = parseDatabaseDate(b.next_due_date);

        if (!dateA || !dateB) {
          return 0;
        }

        return dateA.getTime() - dateB.getTime();
      });
  }, [records]);

  const overdue = schedules.filter((item) => item.daysRemaining < 0);

  const dueSoon = schedules.filter(
    (item) => item.daysRemaining >= 0 && item.daysRemaining <= 30,
  );

  const upcoming = schedules.filter((item) => item.daysRemaining > 30);

  const cancelledSchedules = useMemo<ScheduleItem[]>(
    () =>
      records
        .filter(
          (record): record is VetRecord & { next_due_date: string } =>
            Boolean(record.next_due_date) &&
            record.schedule_status === "Cancelled",
        )
        .map((record) => ({ ...record, daysRemaining: 0 }))
        .sort((a, b) => b.record_id - a.record_id),
    [records],
  );

  const pendingPersonalCare = personalCare.filter(
    (item) => item.status === "Pending",
  );
  const nextSchedule =
    schedules.find((item) => item.daysRemaining >= 0) || null;

  const filteredMedicalSchedules = useMemo(() => {
    if (medicalFilter === "Overdue") return overdue;
    if (medicalFilter === "Due Soon") return dueSoon;
    if (medicalFilter === "Upcoming") return upcoming;
    return schedules;
  }, [dueSoon, medicalFilter, overdue, schedules, upcoming]);

  const openMedicalFilter = (filter: MedicalFilter) => {
    setActiveTab("Medical");
    setMedicalFilter(filter);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(tabsOffsetRef.current - timanSpacing.md, 0),
        animated: true,
      });
    });
  };

  const openMedicalList = () => openMedicalFilter("All");

  const openPersonalCareHistory = () => {
    router.push({
      pathname: "/(veterinary)/personal-care-history",
      params: {
        petId: String(petId),
        petName: pet?.pet_name || "",
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Loading pet schedules...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />

      <ScrollView
        ref={scrollRef}
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
              <Text style={styles.petLabel}>Health Schedule</Text>

              <Text numberOfLines={1} style={styles.petName}>
                {pet.pet_name}
              </Text>

              <Text numberOfLines={1} style={styles.petDetails}>
                {pet.breed || pet.species}
              </Text>
            </View>

            <View style={styles.calendarIcon}>
              <Ionicons name="calendar" size={23} color="#2E7D6B" />
            </View>
          </View>
        )}

        {loadError && (
          <View style={styles.loadErrorCard}>
            <Ionicons name="cloud-offline-outline" size={21} color={timanColors.danger} />
            <View style={styles.loadErrorInfo}>
              <Text style={styles.loadErrorTitle}>Couldn&apos;t refresh schedules</Text>
              <Text style={styles.loadErrorText}>{loadError}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadSchedules()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        <View
          onLayout={(event) => {
            tabsOffsetRef.current = event.nativeEvent.layout.y;
          }}
          style={styles.tabs}
        >
          {(["Medical", "Personal Care"] as ScheduleTab[]).map((tab) => {
            const selected = activeTab === tab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={({ pressed }) => [
                  styles.tabButton,
                  selected && styles.tabButtonSelected,
                  pressed && styles.tabButtonPressed,
                ]}
              >
                <Ionicons
                  name={tab === "Medical" ? "medical-outline" : "heart-outline"}
                  size={18}
                  color={selected ? timanColors.white : timanColors.muted}
                />
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "Medical" && (
          <MedicalOverview
            dueSoonCount={dueSoon.length}
          nextSchedule={nextSchedule}
          onSelectFilter={openMedicalFilter}
          onViewAll={openMedicalList}
          selectedFilter={medicalFilter}
            overdueCount={overdue.length}
            upcomingCount={upcoming.length}
          />
        )}

        {activeTab === "Personal Care" && (
          <>

        <View style={styles.personalHeaderRow}>
          <View style={styles.personalHeading}>
            <Text style={styles.personalEyebrow}>OWNER-CREATED</Text>
            <Text style={styles.personalTitle}>Personal Care</Text>
          </View>
          <View style={styles.personalHeaderActions}>
            <Pressable
              style={({ pressed }) => [
                styles.addCareButton,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/(veterinary)/pet-care-schedule-form",
                  params: { petId: String(petId), petName: pet?.pet_name || "" },
                })
              }
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addCareText}>Add Pet Care</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={openPersonalCareHistory}
              style={({ pressed }) => [
                styles.historyTextLinkPressable,
                pressed && styles.historyTextLinkPressed,
              ]}
            >
              <Text style={styles.historyTextLink}>Personal Care History</Text>
            </Pressable>
          </View>
        </View>

        {pendingPersonalCare.length === 0 ? (
          <View style={styles.personalEmpty}>
            <Text style={styles.personalEmptyText}>
              No upcoming personal care reminders.
            </Text>
          </View>
        ) : (
          pendingPersonalCare.map((item) => (
            <PersonalCareCard
              actionsDisabled={updatingCareId !== null}
              key={item.care_schedule_id}
              item={item}
              updating={updatingCareId === item.care_schedule_id}
              onEdit={() => choosePersonalCareEditScope(item)}
              onComplete={() =>
                Alert.alert(
                  "Mark Personal Care Done?",
                  `${item.care_type} will be marked completed.`,
                  [
                    { text: "Not Yet", style: "cancel" },
                    {
                      text: "Mark Done",
                      onPress: () => void updatePersonalCare(item, "complete"),
                    },
                  ],
                )
              }
              onCancel={() => confirmPersonalCareCancel(item)}
            />
          ))
        )}

          </>
        )}

        <View style={[styles.medicalHeader, styles.hidden]}>
          <Text style={styles.medicalEyebrow}>CLINIC-CREATED</Text>
          <Text style={styles.medicalTitle}>Veterinary / Medical</Text>
        </View>

        {nextSchedule && (
          <View style={[styles.nextCard, styles.hidden]}>
            <View style={styles.nextTop}>
              <View style={styles.nextIcon}>
                <Ionicons name="notifications" size={21} color="#F5A623" />
              </View>

              <View style={styles.nextInfo}>
                <Text style={styles.nextLabel}>NEXT SCHEDULE</Text>

                <Text style={styles.nextService}>
                  {getScheduleService(nextSchedule)}
                </Text>
              </View>

              <View style={styles.nextDays}>
                <Text style={styles.nextDaysNumber}>
                  {nextSchedule.daysRemaining === 0
                    ? "Today"
                    : nextSchedule.daysRemaining}
                </Text>

                {nextSchedule.daysRemaining > 0 && (
                  <Text style={styles.nextDaysLabel}>days</Text>
                )}
              </View>
            </View>

            <View style={styles.nextDivider} />

            <View style={styles.nextDateRow}>
              <Ionicons name="calendar-outline" size={17} color="#F5A623" />

              <Text style={styles.nextDate}>
                {formatDate(nextSchedule.next_due_date)}
              </Text>
            </View>

            <Text style={styles.nextClinic}>
              Planned follow-up from a veterinary record
              {getClinicName(nextSchedule)
                ? ` by ${getClinicName(nextSchedule)}`
                : ""}
              .
            </Text>
            {nextSchedule.follow_up_plan && (
              <Text style={styles.nextClinic}>
                Planned follow-up: {nextSchedule.follow_up_plan}
              </Text>
            )}
          </View>
        )}

        <View style={[styles.summaryRow, styles.hidden]}>
          <SummaryCard
            icon="alert-circle-outline"
            number={overdue.length}
            label="Overdue"
            background="rgba(229, 115, 115, 0.14)"
            iconColor="#E57373"
          />

          <SummaryCard
            icon="time-outline"
            number={dueSoon.length}
            label="Due Soon"
            background="rgba(229, 115, 115, 0.14)"
            iconColor="#F5A623"
          />

          <SummaryCard
            icon="calendar-outline"
            number={upcoming.length}
            label="Upcoming"
            background="#CFE8DD"
            iconColor="#2E7D6B"
          />
        </View>

        <View style={[styles.infoCard, styles.hidden]}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#64B5F6"
          />

          <Text style={styles.infoText}>
            Active schedules are based on next due dates recorded by authorized
            veterinary clinics. Completed schedules are available in Health
            Records.
          </Text>
        </View>

        {activeTab === "Medical" && (
          <View style={styles.medicalListHeader}>
            <View style={styles.medicalListTitleRow}>
              <View>
                <Text style={styles.medicalListTitle}>
                  {medicalFilter === "All" ? "Medical schedules" : medicalFilter}
                </Text>
                <Text style={styles.medicalListSubtitle}>
                  {filteredMedicalSchedules.length} active{" "}
                  {filteredMedicalSchedules.length === 1 ? "schedule" : "schedules"}
                </Text>
              </View>
              <View style={styles.medicalListCount}>
                <Text style={styles.medicalListCountText}>
                  {filteredMedicalSchedules.length}
                </Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === "Medical" && filteredMedicalSchedules.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={36} color="#56B091" />
            </View>

            <Text style={styles.emptyTitle}>
              {medicalFilter === "All"
                ? "No Active Schedules"
                : `No ${medicalFilter} Schedules`}
            </Text>

            <Text style={styles.emptyText}>
              {medicalFilter === "All"
                ? "There are currently no pending health schedules for this pet. Completed schedules can be viewed in Health Records."
                : `There are no medical schedules in the ${medicalFilter.toLowerCase()} category.`}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.recordsButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                if (!petId) {
                  return;
                }

                router.push({
                  pathname: "/(veterinary)/pet-health-records",
                  params: {
                    petId: String(petId),
                  },
                });
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.recordsButtonText}>View Health Records</Text>
            </Pressable>
          </View>
        )}

        {activeTab === "Medical" &&
          (medicalFilter === "All" || medicalFilter === "Overdue") &&
          overdue.length > 0 && (
          <ScheduleSection
            title="Overdue"
            subtitle="These schedules have passed their due date."
            icon="alert-circle"
            items={overdue}
            status="Overdue"
            updatingScheduleId={updatingScheduleId}
            onReschedule={openReschedulePicker}
            onCancel={confirmCancel}
          />
        )}

        {activeTab === "Medical" &&
          (medicalFilter === "All" || medicalFilter === "Due Soon") &&
          dueSoon.length > 0 && (
          <ScheduleSection
            title="Due Soon"
            subtitle="Due today or within the next 30 days."
            icon="time"
            items={dueSoon}
            status="Due Soon"
            updatingScheduleId={updatingScheduleId}
            onReschedule={openReschedulePicker}
            onCancel={confirmCancel}
          />
        )}

        {activeTab === "Medical" &&
          (medicalFilter === "All" || medicalFilter === "Upcoming") &&
          upcoming.length > 0 && (
          <ScheduleSection
            title="Upcoming"
            subtitle="Future pet health schedules."
            icon="calendar"
            items={upcoming}
            status="Upcoming"
            updatingScheduleId={updatingScheduleId}
            onReschedule={openReschedulePicker}
            onCancel={confirmCancel}
          />
        )}

        {activeTab === "Medical" && medicalFilter === "All" && cancelledSchedules.length > 0 && (
          <View style={styles.scheduleSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={19}
                  color="#E57373"
                />
                <Text style={styles.sectionTitle}>Cancelled</Text>
                <View style={[styles.countBadge, styles.cancelledCountBadge]}>
                  <Text
                    style={[styles.countBadgeText, styles.cancelledCountText]}
                  >
                    {cancelledSchedules.length}
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                Cancelled treatments remain here for reference.
              </Text>
            </View>
            {cancelledSchedules.map((item) => (
              <CancelledScheduleCard key={item.record_id} item={item} />
            ))}
          </View>
        )}

        {activeTab === "Medical" && schedules.length > 0 && (
          <View style={styles.reminderCard}>
            <View style={styles.reminderIcon}>
              <Ionicons
                name="notifications-outline"
                size={21}
                color="#2E7D6B"
              />
            </View>

            <View style={styles.reminderInfo}>
              <Text style={styles.reminderTitle}>Health Reminders</Text>

              <Text style={styles.reminderText}>
                TIMAN uses pending schedules to track vaccination, deworming,
                follow-up, and other veterinary due dates.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={iosRescheduleSchedule !== null}
        onRequestClose={() => setIosRescheduleSchedule(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.rescheduleModal}>
            <Text style={styles.rescheduleModalTitle}>Reschedule Treatment</Text>
            <Text style={styles.rescheduleDateLabel}>Current</Text>
            <Text style={styles.rescheduleDateValue}>
              {iosRescheduleSchedule
                ? formatDate(iosRescheduleSchedule.next_due_date)
                : ""}
            </Text>
            <Text style={styles.rescheduleDateLabel}>New Date</Text>
            <Text style={styles.rescheduleDateValue}>
              {formatDate(formatDateValue(iosRescheduleDate))}
            </Text>
            {Platform.OS === "ios" && (
              <DateTimePicker
                value={iosRescheduleDate}
                mode="date"
                display="spinner"
                minimumDate={getTomorrowStart()}
                onChange={(_, date) => date && setIosRescheduleDate(date)}
              />
            )}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setIosRescheduleSchedule(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.modalConfirmButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (!iosRescheduleSchedule) return;
                  const schedule = iosRescheduleSchedule;
                  setIosRescheduleSchedule(null);
                  void updateSchedule(
                    schedule,
                    "reschedule",
                    formatDateValue(iosRescheduleDate),
                  );
                }}
              >
                <Text style={styles.modalConfirmText}>Confirm Reschedule</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={cancelSchedule !== null}
        onRequestClose={closeCancelDialog}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.rescheduleModal}>
            <View style={styles.cancelModalIcon}>
              <Ionicons name="close-circle-outline" size={24} color="#C94C4C" />
            </View>
            <Text style={styles.rescheduleModalTitle}>Cancel Schedule?</Text>
            <Text style={styles.cancelModalDescription}>
              Tell the clinic why you need to cancel this scheduled treatment.
            </Text>
            <Text style={styles.cancelReasonLabel}>Reason</Text>
            <TextInput
              accessibilityLabel="Cancellation reason"
              editable={updatingScheduleId === null}
              maxLength={500}
              multiline
              onChangeText={setCancelReason}
              placeholder="Enter your reason for cancellation"
              placeholderTextColor="#8A9891"
              style={styles.cancelReasonInput}
              textAlignVertical="top"
              value={cancelReason}
            />
            <Text style={styles.cancelReasonHint}>
              This reason will be included in the clinic notification.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={updatingScheduleId !== null}
                onPress={closeCancelDialog}
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  updatingScheduleId !== null && styles.actionDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalCancelText}>Keep Schedule</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: cancelReason.trim().length < 5,
                }}
                disabled={
                  cancelReason.trim().length < 5 ||
                  updatingScheduleId !== null
                }
                onPress={submitCancellation}
                style={({ pressed }) => [
                  styles.cancelConfirmButton,
                  (cancelReason.trim().length < 5 ||
                    updatingScheduleId !== null) &&
                    styles.actionDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelConfirmText}>Cancel Schedule</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
        <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
      </Pressable>

      <Text style={styles.headerTitle}>Health Schedule</Text>

      <View style={styles.headerButton} />
    </View>
  );
}

function PersonalCareCard({
  item,
  updating,
  actionsDisabled,
  onEdit,
  onComplete,
  onCancel,
}: {
  item: PersonalCareSchedule;
  updating: boolean;
  actionsDisabled: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.personalCard}>
      <View style={styles.personalCardTop}>
        <View style={styles.personalCareIcon}>
          <Ionicons name="heart-outline" size={20} color="#2E7D6B" />
        </View>
        <View style={styles.personalCardInfo}>
          <Text style={styles.personalCareType}>{item.care_type}</Text>
          <Text style={styles.personalCareDate}>
            {formatDate(item.scheduled_date)}
            {item.scheduled_time ? ` · ${formatTime(item.scheduled_time)}` : ""} ·{" "}
            {item.repeat_type === "None" ? "One Time" : item.repeat_type}
          </Text>
        </View>
        <View style={styles.personalBadge}>
          <Text style={styles.personalBadgeText}>Personal Care</Text>
        </View>
      </View>
      {item.notes && <Text style={styles.personalNotes}>{item.notes}</Text>}
      <View style={styles.personalActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: actionsDisabled }}
          disabled={actionsDisabled}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.personalSecondaryButton,
            actionsDisabled && styles.actionDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.personalSecondaryText}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: actionsDisabled }}
          disabled={actionsDisabled}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.personalSecondaryButton,
            actionsDisabled && styles.actionDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.personalCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: updating, disabled: actionsDisabled }}
          disabled={actionsDisabled}
          onPress={onComplete}
          style={({ pressed }) => [
            styles.personalDoneButton,
            actionsDisabled && styles.actionDisabled,
            pressed && styles.pressed,
          ]}
        >
          {updating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="checkmark" size={16} color="#FFF" />
          )}
          <Text style={styles.personalDoneText}>Mark Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MedicalOverview({
  dueSoonCount,
  nextSchedule,
  onSelectFilter,
  onViewAll,
  overdueCount,
  selectedFilter,
  upcomingCount,
}: {
  dueSoonCount: number;
  nextSchedule: ScheduleItem | null;
  onSelectFilter: (filter: MedicalFilter) => void;
  onViewAll: () => void;
  overdueCount: number;
  selectedFilter: MedicalFilter;
  upcomingCount: number;
}) {
  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewHeader}>
        <View style={styles.overviewHeadingCopy}>
          <Text style={styles.overviewEyebrow}>MEDICAL OVERVIEW</Text>
          <Text style={styles.overviewTitle}>Schedule summary</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onViewAll}
          style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="arrow-forward" size={15} color={timanColors.primary} />
        </Pressable>
      </View>

      {nextSchedule ? (
        <View style={styles.overviewNextCard}>
          <View style={styles.overviewNextIcon}>
            <Ionicons name="calendar-outline" size={21} color={timanColors.warning} />
          </View>
          <View style={styles.overviewNextInfo}>
            <Text style={styles.overviewNextLabel}>NEXT MEDICAL SCHEDULE</Text>
            <Text numberOfLines={1} style={styles.overviewNextTitle}>
              {getScheduleService(nextSchedule)}
            </Text>
            <Text style={styles.overviewNextMeta}>
              {formatDate(nextSchedule.next_due_date)}
              {getClinicName(nextSchedule) ? ` · ${getClinicName(nextSchedule)}` : ""}
            </Text>
          </View>
          <StatusBadge item={nextSchedule} status={getScheduleStatus(nextSchedule)} />
        </View>
      ) : (
        <View style={styles.noNextSchedule}>
          <Ionicons name="checkmark-circle-outline" size={20} color={timanColors.secondary} />
          <Text style={styles.noNextScheduleText}>
            No upcoming medical schedule is currently recorded.
          </Text>
        </View>
      )}

      <View style={styles.summaryRow}>
        <SummaryCard
          background="rgba(229, 115, 115, 0.14)"
          icon="alert-circle-outline"
          iconColor={timanColors.danger}
          label="Overdue"
          number={overdueCount}
          onPress={() => onSelectFilter("Overdue")}
          selected={selectedFilter === "Overdue"}
        />
        <SummaryCard
          background="rgba(245, 166, 35, 0.16)"
          icon="time-outline"
          iconColor={timanColors.warning}
          label="Due Soon"
          number={dueSoonCount}
          onPress={() => onSelectFilter("Due Soon")}
          selected={selectedFilter === "Due Soon"}
        />
        <SummaryCard
          background={timanColors.lightMint}
          icon="calendar-outline"
          iconColor={timanColors.primary}
          label="Upcoming"
          number={upcomingCount}
          onPress={() => onSelectFilter("Upcoming")}
          selected={selectedFilter === "Upcoming"}
        />
      </View>
    </View>
  );
}

function SummaryCard({
  icon,
  number,
  label,
  background,
  iconColor,
  onPress,
  selected = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  number: number;
  label: string;
  background: string;
  iconColor: string;
  onPress?: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryCard,
        selected && styles.summaryCardSelected,
        pressed && styles.summaryCardPressed,
      ]}
    >
      <View
        style={[
          styles.summaryIcon,
          {
            backgroundColor: background,
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <Text style={styles.summaryNumber}>{number}</Text>

      <Text style={styles.summaryLabel}>{label}</Text>
    </Pressable>
  );
}

function ScheduleSection({
  title,
  subtitle,
  icon,
  items,
  status,
  updatingScheduleId,
  onReschedule,
  onCancel,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: ScheduleItem[];
  status: ScheduleStatus;
  updatingScheduleId: number | null;
  onReschedule: (item: ScheduleItem) => void;
  onCancel: (item: ScheduleItem) => void;
}) {
  return (
    <View style={styles.scheduleSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name={icon} size={19} color={getStatusColor(status)} />

          <Text style={styles.sectionTitle}>{title}</Text>

          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: getStatusBackground(status),
              },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                {
                  color: getStatusColor(status),
                },
              ]}
            >
              {items.length}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      {items.map((item) => (
        <ScheduleCard
          key={item.record_id}
          item={item}
          status={status}
          updating={updatingScheduleId === item.record_id}
          actionsDisabled={updatingScheduleId !== null}
          onReschedule={() => onReschedule(item)}
          onCancel={() => onCancel(item)}
        />
      ))}
    </View>
  );
}

function ScheduleCard({
  item,
  status,
  updating,
  actionsDisabled,
  onReschedule,
  onCancel,
}: {
  item: ScheduleItem;
  status: ScheduleStatus;
  updating: boolean;
  actionsDisabled: boolean;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const canCancel = item.daysRemaining > 3;

  return (
    <View style={styles.scheduleCard}>
      <View style={styles.scheduleTop}>
        <View
          style={[
            styles.serviceIcon,
            {
              backgroundColor: getStatusBackground(status),
            },
          ]}
        >
          <Ionicons
            name={getServiceIcon(getScheduleService(item))}
            size={22}
            color={getStatusColor(status)}
          />
        </View>

        <View style={styles.scheduleInfo}>
          <Text style={styles.serviceTitle}>{getScheduleService(item)}</Text>

          <View style={styles.scheduleDateRow}>
            <Ionicons name="calendar-outline" size={13} color="#6B7C73" />

            <Text style={styles.scheduleDate}>
              {formatDate(item.next_due_date)}
            </Text>
          </View>
        </View>

        <StatusBadge item={item} status={status} />
      </View>

      <View style={styles.scheduleDivider} />

      {item.follow_up_plan && (
        <Text style={styles.followUpPlan}>
          Planned follow-up: {item.follow_up_plan}
        </Text>
      )}

      {item.notes && (
        <Text style={styles.clinicalNotes}>Clinical notes: {item.notes}</Text>
      )}

      <View style={styles.sourceRow}>
        <View style={styles.sourceIcon}>
          <Ionicons name="medical-outline" size={15} color="#2E7D6B" />
        </View>

        <View style={styles.sourceInfo}>
          <Text style={styles.sourceLabel}>Based on veterinary record</Text>

          <Text numberOfLines={2} style={styles.sourceText}>
            {item.visit_date
              ? `Visit: ${formatDate(item.visit_date)}`
              : "Visit date unavailable"}
            {getClinicName(item) ? ` • ${getClinicName(item)}` : ""}
          </Text>
        </View>
      </View>

      {item.daysRemaining < 0 ? (
        <View style={styles.lockedScheduleBadge}>
          <Ionicons name="lock-closed-outline" size={16} color="#C94C4C" />
          <Text style={styles.overdueLockedText}>
            Overdue schedules can no longer be rescheduled
          </Text>
        </View>
      ) : item.rescheduled_at ? (
        <View style={styles.lockedScheduleBadge}>
          <Ionicons name="lock-closed-outline" size={16} color="#6B7C73" />
          <Text style={styles.lockedScheduleText}>
            Rescheduled — no further changes allowed
          </Text>
        </View>
      ) : (
        <View style={styles.scheduleActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: actionsDisabled }}
            disabled={actionsDisabled}
            style={({ pressed }) => [
              styles.rescheduleButton,
              actionsDisabled && styles.actionDisabled,
              pressed && styles.pressed,
            ]}
            onPress={onReschedule}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#2E7D6B" />
            ) : (
              <Ionicons name="calendar-outline" size={16} color="#2E7D6B" />
            )}
            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
          </Pressable>
          {canCancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: actionsDisabled }}
              disabled={actionsDisabled}
              style={({ pressed }) => [
                styles.cancelButton,
                actionsDisabled && styles.actionDisabled,
                pressed && styles.pressed,
              ]}
              onPress={onCancel}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#E57373" />
              ) : (
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color="#E57373"
                />
              )}
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          ) : (
            <View style={styles.rescheduleOnlyBadge}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#F5A623"
              />
              <Text style={styles.rescheduleOnlyText}>Reschedule only</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function CancelledScheduleCard({ item }: { item: ScheduleItem }) {
  return (
    <View style={styles.scheduleCard}>
      <View style={styles.scheduleTop}>
        <View style={[styles.serviceIcon, styles.cancelledIcon]}>
          <Ionicons
            name={getServiceIcon(getScheduleService(item))}
            size={22}
            color="#E57373"
          />
        </View>
        <View style={styles.scheduleInfo}>
          <Text style={styles.serviceTitle}>{getScheduleService(item)}</Text>
          <View style={styles.scheduleDateRow}>
            <Ionicons name="calendar-outline" size={13} color="#6B7C73" />
            <Text style={styles.scheduleDate}>
              {formatDate(item.next_due_date)}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, styles.cancelledCountBadge]}>
          <Text style={[styles.statusText, styles.cancelledCountText]}>
            Cancelled
          </Text>
        </View>
      </View>
      <View style={styles.scheduleDivider} />
      <Text style={styles.cancelledHistoryText}>
        This scheduled treatment was cancelled and cannot be changed.
      </Text>
    </View>
  );
}

function StatusBadge({
  item,
  status,
}: {
  item: ScheduleItem;
  status: ScheduleStatus;
}) {
  let text = "";

  if (status === "Overdue") {
    const days = Math.abs(item.daysRemaining);

    text = days === 1 ? "1 day overdue" : `${days} days overdue`;
  }

  if (status === "Due Soon") {
    if (item.daysRemaining === 0) {
      text = "Due today";
    } else if (item.daysRemaining === 1) {
      text = "1 day";
    } else {
      text = `${item.daysRemaining} days`;
    }
  }

  if (status === "Upcoming") {
    text = item.daysRemaining === 1 ? "1 day" : `${item.daysRemaining} days`;
  }

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: getStatusBackground(status),
        },
      ]}
    >
      <Text
        style={[
          styles.statusText,
          {
            color: getStatusColor(status),
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function getTodayStart() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function getTomorrowStart() {
  const tomorrow = getTodayStart();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
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

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
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

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialRescheduleDate(currentValue: string) {
  const tomorrow = getTomorrowStart();
  const currentDate = parseDatabaseDate(currentValue);
  return currentDate && currentDate > tomorrow ? currentDate : tomorrow;
}

function getClinicName(record: VetRecord) {
  return record.clinic_name || record.clinic_contact_name || "";
}

function getScheduleService(record: VetRecord) {
  return record.next_service_type?.trim() || record.service_type;
}

function getScheduleStatus(item: ScheduleItem): ScheduleStatus {
  if (item.daysRemaining < 0) return "Overdue";
  if (item.daysRemaining <= 30) return "Due Soon";
  return "Upcoming";
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

function getStatusColor(status: ScheduleStatus) {
  switch (status) {
    case "Overdue":
      return "#E57373";

    case "Due Soon":
      return "#F5A623";

    case "Upcoming":
      return "#2E7D6B";
  }
}

function getStatusBackground(status: ScheduleStatus) {
  switch (status) {
    case "Overdue":
      return "rgba(229, 115, 115, 0.14)";

    case "Due Soon":
      return "rgba(245, 166, 35, 0.16)";

    case "Upcoming":
      return "#CFE8DD";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: timanColors.cream,
  },

  hidden: { display: "none" },

  loadErrorCard: {
    marginTop: timanSpacing.md,
    padding: timanSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: timanSpacing.sm,
    borderWidth: 1,
    borderColor: "#F2C9C5",
    borderRadius: timanRadii.card,
    backgroundColor: "#FFF8F6",
  },
  loadErrorInfo: { flex: 1 },
  loadErrorTitle: { fontSize: 13, fontWeight: "900", color: timanColors.dark },
  loadErrorText: { marginTop: 2, fontSize: 11, lineHeight: 16, color: timanColors.muted },
  retryButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: timanRadii.control,
    backgroundColor: timanColors.primary,
  },
  retryButtonText: { fontSize: 12, fontWeight: "900", color: timanColors.white },

  overviewCard: {
    ...timanShadow,
    marginTop: timanSpacing.lg,
    padding: timanSpacing.lg,
    borderRadius: timanRadii.large,
    borderWidth: 1,
    borderColor: timanColors.lightMint,
    backgroundColor: timanColors.white,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: timanSpacing.md,
  },
  overviewHeadingCopy: { flex: 1 },
  overviewEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: timanColors.secondary,
  },
  overviewTitle: { marginTop: 3, fontSize: 19, fontWeight: "900", color: timanColors.dark },
  viewAllButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 11,
    borderRadius: timanRadii.control,
    backgroundColor: "#EAF5F0",
  },
  viewAllText: { fontSize: 12, fontWeight: "900", color: timanColors.primary },
  overviewNextCard: {
    marginTop: timanSpacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: timanRadii.card,
    backgroundColor: "#FFF8EC",
    borderWidth: 1,
    borderColor: timanColors.softAccent,
  },
  overviewNextIcon: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "rgba(245, 166, 35, 0.14)",
  },
  overviewNextInfo: { flex: 1, minWidth: 0 },
  overviewNextLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.6, color: "#B46A10" },
  overviewNextTitle: { marginTop: 2, fontSize: 14, fontWeight: "900", color: timanColors.dark },
  overviewNextMeta: { marginTop: 3, fontSize: 10, lineHeight: 14, color: timanColors.muted },
  noNextSchedule: {
    marginTop: timanSpacing.lg,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: timanRadii.card,
    backgroundColor: "#EAF5F0",
  },
  noNextScheduleText: { flex: 1, fontSize: 12, lineHeight: 17, color: timanColors.muted },

  tabs: {
    marginTop: timanSpacing.xl,
    padding: 4,
    flexDirection: "row",
    gap: 4,
    borderRadius: timanRadii.card,
    backgroundColor: "#E7EFEA",
  },
  tabButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: timanRadii.control,
  },
  tabButtonSelected: { backgroundColor: timanColors.primary },
  tabButtonPressed: { opacity: 0.76 },
  tabText: { fontSize: 13, fontWeight: "800", color: timanColors.muted },
  tabTextSelected: { color: timanColors.white },

  medicalListHeader: { marginTop: timanSpacing.lg },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filterChip: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: timanRadii.pill,
    borderWidth: 1,
    borderColor: timanColors.lightMint,
    backgroundColor: timanColors.white,
  },
  filterChipSelected: { borderColor: timanColors.primary, backgroundColor: timanColors.primary },
  filterChipPressed: { opacity: 0.72 },
  filterText: { fontSize: 11, fontWeight: "800", color: timanColors.muted },
  filterTextSelected: { color: timanColors.white },
  medicalListTitleRow: {
    marginTop: timanSpacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  medicalListTitle: { fontSize: 20, fontWeight: "900", color: timanColors.dark },
  medicalListSubtitle: { marginTop: 3, fontSize: 12, color: timanColors.muted },
  medicalListCount: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: timanColors.lightMint,
  },
  medicalListCountText: { fontSize: 12, fontWeight: "900", color: timanColors.primary },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
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

  headerTitle: {
    fontSize: 22,
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

  personalHeaderRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  personalHeading: { marginTop: 4 },
  personalHeaderActions: { alignItems: "center", gap: 7 },
  historyTextLinkPressable: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  historyTextLink: {
    color: timanColors.primary,
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  historyTextLinkPressed: { opacity: 0.55 },
  personalEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#6B7C73",
  },
  personalTitle: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: "900",
    color: "#2E3A34",
  },
  addCareButton: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: "#2E7D6B",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  addCareText: { fontSize: 11, fontWeight: "900", color: "#FFF" },
  personalEmpty: {
    marginTop: 12,
    padding: 18,
    borderRadius: 15,
    backgroundColor: "#FFF5E9",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  personalEmptyText: { textAlign: "center", fontSize: 12, color: "#6B7C73" },
  personalCard: {
    marginTop: 11,
    padding: 15,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  personalCardTop: { flexDirection: "row", alignItems: "center" },
  personalCareIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  personalCardInfo: { flex: 1, marginLeft: 10 },
  personalCareType: { fontSize: 15, fontWeight: "900", color: "#2E3A34" },
  personalCareDate: { marginTop: 3, fontSize: 11, color: "#6B7C73" },
  personalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "#CFE8DD",
  },
  personalBadgeText: { fontSize: 9, fontWeight: "900", color: "#2E7D6B" },
  personalNotes: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 17,
    color: "#6B7C73",
  },
  personalActions: { marginTop: 13, flexDirection: "row", gap: 7 },
  personalSecondaryButton: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  personalSecondaryText: { fontSize: 11, fontWeight: "800", color: "#56B091" },
  personalCancelText: { fontSize: 11, fontWeight: "800", color: "#E57373" },
  personalDoneButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: "#2E7D6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  personalDoneText: { fontSize: 11, fontWeight: "900", color: "#FFF" },
  personalHistoryLink: {
    ...timanShadow,
    minHeight: 76,
    marginTop: 16,
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  personalHistoryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  personalHistoryInfo: { flex: 1, marginLeft: 12 },
  personalHistoryTitle: { fontSize: 14, fontWeight: "900", color: "#2E3A34" },
  personalHistorySummary: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: "#6B7C73",
  },
  personalHistoryArrow: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#EAF5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  medicalHeader: { marginTop: 30, marginBottom: 4 },
  medicalEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#6B7C73",
  },
  medicalTitle: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: "900",
    color: "#2E3A34",
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
    minWidth: 0,
    marginLeft: 14,
  },

  petLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#56B091",
  },

  petName: {
    marginTop: 2,
    fontSize: 23,
    fontWeight: "900",
    color: "#2E3A34",
  },

  petDetails: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    color: "#6B7C73",
  },

  calendarIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  nextCard: {
    marginTop: 15,
    padding: 17,
    borderRadius: 18,
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    borderWidth: 1,
    borderColor: "#FAD7A0",
  },

  nextTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  nextIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  nextInfo: {
    flex: 1,
    marginLeft: 12,
  },

  nextLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#F5A623",
  },

  nextService: {
    marginTop: 3,
    fontSize: 19,
    fontWeight: "900",
    color: "#F5A623",
  },

  nextDays: {
    alignItems: "center",
    marginLeft: 8,
  },

  nextDaysNumber: {
    fontSize: 21,
    fontWeight: "900",
    color: "#F5A623",
  },

  nextDaysLabel: {
    marginTop: 1,
    fontSize: 13,
    color: "#E57373",
  },

  nextDivider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: "#FAD7A0",
  },

  nextDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  nextDate: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F5A623",
  },

  nextClinic: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 20,
    color: "#E57373",
  },

  summaryRow: {
    marginTop: 15,
    flexDirection: "row",
    gap: 8,
  },

  summaryCard: {
    flex: 1,
    minHeight: 105,
    paddingVertical: 13,
    paddingHorizontal: 7,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryCardSelected: {
    borderColor: timanColors.primary,
    backgroundColor: "#F4FAF7",
  },

  summaryCardPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },

  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryNumber: {
    marginTop: 7,
    fontSize: 21,
    fontWeight: "900",
    color: "#2E3A34",
  },

  summaryLabel: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7C73",
    textAlign: "center",
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
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7C73",
  },

  scheduleSection: {
    marginTop: 28,
  },

  sectionHeader: {
    marginBottom: 13,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#2E3A34",
  },

  countBadge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },

  sectionSubtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 19,
    color: "#6B7C73",
  },

  scheduleCard: {
    ...timanShadow,
    marginBottom: 13,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },

  scheduleTop: {
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

  scheduleInfo: {
    flex: 1,
    marginLeft: 12,
  },

  serviceTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2E3A34",
  },

  scheduleDateRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  scheduleDate: {
    fontSize: 14,
    lineHeight: 19,
    color: "#6B7C73",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },

  scheduleDivider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: "#CFE8DD",
  },
  followUpPlan: {
    marginBottom: 13,
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7C73",
  },
  clinicalNotes: {
    marginBottom: 13,
    padding: 10,
    borderRadius: 11,
    backgroundColor: timanColors.cream,
    fontSize: 12,
    lineHeight: 17,
    color: timanColors.muted,
  },

  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  sourceIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  sourceInfo: {
    flex: 1,
    marginLeft: 10,
  },

  sourceLabel: {
    fontSize: 12,
    color: "#6B7C73",
  },

  sourceText: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    color: "#56B091",
  },

  scheduleActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
  },

  lockedScheduleBadge: {
    minHeight: 42,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFF5E9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
  },

  lockedScheduleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7C73",
  },

  rescheduleButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2E7D6B",
    backgroundColor: "#FFF5E9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  rescheduleButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2E7D6B",
  },

  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E57373",
    backgroundColor: "#FFF5E9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  cancelButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E57373",
  },

  rescheduleOnlyBadge: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FAD7A0",
    backgroundColor: "#6B7C73",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  rescheduleOnlyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#8A5A19",
  },

  actionDisabled: {
    opacity: 0.55,
  },

  cancelledCountBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  cancelledCountText: {
    color: "#E57373",
  },

  cancelledIcon: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  cancelledHistoryText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#E57373",
  },

  modalBackdrop: {
    flex: 1,
    paddingHorizontal: 22,
    backgroundColor: "rgba(46, 58, 52, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  rescheduleModal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#FFF5E9",
  },

  rescheduleModalTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#2E3A34",
    marginBottom: 15,
  },

  rescheduleDateLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7C73",
    textTransform: "uppercase",
    marginTop: 8,
  },

  rescheduleDateValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2E3A34",
    marginTop: 3,
  },

  modalActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
  },

  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCancelText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B7C73",
  },

  modalConfirmButton: {
    flex: 1.5,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
  },

  modalConfirmText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  cancelModalIcon: {
    width: 46,
    height: 46,
    marginBottom: 12,
    borderRadius: 23,
    backgroundColor: "rgba(201, 76, 76, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelModalDescription: {
    marginTop: -7,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7C73",
  },

  cancelReasonLabel: {
    marginBottom: 7,
    fontSize: 13,
    fontWeight: "800",
    color: "#2E3A34",
  },

  cancelReasonInput: {
    minHeight: 104,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    color: "#2E3A34",
  },

  cancelReasonHint: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7C73",
  },

  cancelConfirmButton: {
    flex: 1.5,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#C94C4C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  cancelConfirmText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },

  overdueLockedText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: "#C94C4C",
    textAlign: "center",
  },
  completedSection: {
    marginTop: 28,
  },

  completedSectionHeader: {
    marginBottom: 13,
  },

  completedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  completedSectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#2E3A34",
  },

  completedCountBadge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  completedCountText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#81C784",
  },

  completedSectionSubtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 19,
    color: "#6B7C73",
  },

  completedScheduleCard: {
    marginBottom: 13,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#CFE8DD",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },

  completedScheduleTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  completedServiceIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  completedScheduleInfo: {
    flex: 1,
    marginLeft: 12,
  },

  completedServiceTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2E3A34",
  },

  completedScheduleDate: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 19,
    color: "#6B7C73",
  },

  completedStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: "#CFE8DD",
  },

  completedStatusText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#81C784",
  },

  completedScheduleDivider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: "#CFE8DD",
  },

  completedDetailRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  completedDetailInfo: {
    flex: 1,
    marginLeft: 10,
  },

  completedDetailLabel: {
    fontSize: 12,
    color: "#6B7C73",
  },

  completedDetailValue: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#2E3A34",
  },

  completedClinicRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  completedClinicText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: "#6B7C73",
  },

  emptyCard: {
    marginTop: 22,
    padding: 28,
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
    fontSize: 20,
    fontWeight: "900",
    color: "#2E3A34",
  },

  emptyText: {
    marginTop: 7,
    maxWidth: 285,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    color: "#6B7C73",
  },

  recordsButton: {
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: "#2E7D6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  recordsButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  reminderCard: {
    marginTop: 16,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  reminderIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  reminderInfo: {
    flex: 1,
    marginLeft: 11,
  },

  reminderTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E3A34",
  },

  reminderText: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7C73",
  },

  pressed: {
    opacity: 0.75,
  },
});
