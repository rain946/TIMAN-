import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  ImageSourcePropType,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";

import { API_URL } from "../../config/api";

type Pet = {
  pet_id: number;
  owner_id?: number;
  pet_name: string;
  species: string;
  breed?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  color?: string | null;
  identifying_marks?: string | null;
  photo_url?: string | null;
  qr_code?: string | null;
  pet_status?: "Safe" | "Missing" | "Found" | string;
};

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

type HealthSummary = {
  overdue: number;
  dueSoon: number;
  upcoming: number;
  total: number;
};

type HealthOverviewResponse = {
  success: boolean;
  summary?: HealthSummary;
  schedules?: {
    overdue?: HealthSchedule[];
    dueSoon?: HealthSchedule[];
    upcoming?: HealthSchedule[];
  };
  allSchedules?: HealthSchedule[];
  message?: string;
};

type PersonalCareSchedule = {
  care_schedule_id: number;
  pet_id: number;
  pet_name: string;
  care_type: string;
  scheduled_date: string;
  status: "Pending" | "Completed" | "Cancelled";
};

const DEFAULT_SUMMARY: HealthSummary = {
  overdue: 0,
  dueSoon: 0,
  upcoming: 0,
  total: 0,
};

export default function DashboardScreen() {
  const [ownerName, setOwnerName] = useState("Pet Owner");

  const [pets, setPets] = useState<Pet[]>([]);

  const [summary, setSummary] = useState<HealthSummary>(DEFAULT_SUMMARY);

  const [reminders, setReminders] = useState<HealthSchedule[]>([]);

  const [personalCare, setPersonalCare] = useState<PersonalCareSchedule[]>([]);
  const [personalCareLoading, setPersonalCareLoading] = useState(true);
  const [personalCareError, setPersonalCareError] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPersonalCare = useCallback(async (token: string) => {
    try {
      setPersonalCareLoading(true);
      setPersonalCareError(null);

      const response = await fetch(`${API_URL}/pet-care-schedules`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load personal care reminders.",
        );
      }

      const today = getPhilippineDate();
      const upcoming = (Array.isArray(data.schedules) ? data.schedules : [])
        .filter(
          (schedule: PersonalCareSchedule) =>
            schedule.status === "Pending" &&
            schedule.scheduled_date >= today,
        )
        .sort((a: PersonalCareSchedule, b: PersonalCareSchedule) =>
          a.scheduled_date.localeCompare(b.scheduled_date),
        )
        .slice(0, 3);

      setPersonalCare(upcoming);
    } catch (error) {
      console.error("LOAD PERSONAL CARE DASHBOARD ERROR:", error);
      setPersonalCareError(
        error instanceof Error
          ? error.message
          : "Unable to load personal care reminders.",
      );
    } finally {
      setPersonalCareLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem("token");

      const storedUser = await AsyncStorage.getItem("user");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      void loadPersonalCare(token);

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);

          const name =
            parsedUser.full_name || parsedUser.fullName || parsedUser.name;

          if (name) {
            const firstName = String(name).trim().split(" ")[0];

            setOwnerName(firstName);
          }
        } catch (error) {
          console.log("PARSE USER ERROR:", error);
        }
      }

      const [petsResponse, overviewResponse] = await Promise.all([
        fetch(`${API_URL}/pets`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/vet-records/owner-health-overview`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const petsData = await petsResponse.json();

      if (!petsResponse.ok) {
        throw new Error(petsData.message || "Unable to load pets.");
      }

      let loadedPets: Pet[] = [];

      if (Array.isArray(petsData)) {
        loadedPets = petsData;
      } else if (Array.isArray(petsData.pets)) {
        loadedPets = petsData.pets;
      } else if (Array.isArray(petsData.data)) {
        loadedPets = petsData.data;
      }
      setPets(loadedPets);

      const overviewData: HealthOverviewResponse =
        await overviewResponse.json();

      if (!overviewResponse.ok) {
        throw new Error(
          overviewData.message || "Unable to load health overview.",
        );
      }

      setSummary(overviewData.summary || DEFAULT_SUMMARY);

      const allSchedules = overviewData.allSchedules || [];

      setReminders(allSchedules.slice(0, 4));
    } catch (error) {
      console.error("LOAD DASHBOARD ERROR:", error);

      Alert.alert(
        "Dashboard Error",
        error instanceof Error ? error.message : "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadPersonalCare]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard(true);

      const onBackPress = () => {
        setRefreshing(true);
        loadDashboard(false);

        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => {
        subscription.remove();
      };
    }, [loadDashboard]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard(false);
  };

  const openPet = (petId: number) => {
    router.push({
      pathname: "/pet-profile",
      params: {
        petId: String(petId),
      },
    });
  };

  const openSchedule = (petId: number) => {
    router.push({
      pathname: "/(veterinary)/schedules",
      params: {
        petId: String(petId),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.smallText}>Good day,</Text>

            <Text style={styles.ownerName}>{ownerName} 👋</Text>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <View pointerEvents="none" style={styles.welcomeCreamShape} />
          <View pointerEvents="none" style={styles.welcomeCoralShape} />

          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeTitle}>
              Keep your pets{"\n"}healthy & safe.
            </Text>

            <Text style={styles.welcomeSubtitle}>
              Monitor their health records and important schedules.
            </Text>
          </View>

          <Text style={styles.bigPaw}>🐾</Text>
          <Image
            source={require("../../assets/images/owner-dashboard-pets.png")}
            style={styles.welcomePetImage}
            resizeMode="contain"
            accessible={false}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Health Overview</Text>
        </View>

        {loading ? (
          <View style={styles.overviewLoadingContainer}>
            <ActivityIndicator size="small" color="#2E7D6B" />

            <Text style={styles.loadingText}>Loading health schedules...</Text>
          </View>
        ) : (
          <View style={styles.overviewRow}>
            <OverviewCard
              count={summary.overdue}
              label="Overdue"
              icon="alert-circle-outline"
              type="overdue"
              onPress={() =>
                router.push({
                  pathname: "/health-reminders",
                  params: {
                    filter: "overdue",
                  },
                })
              }
            />

            <OverviewCard
              count={summary.dueSoon}
              label="Due Soon"
              icon="time-outline"
              type="due"
              onPress={() =>
                router.push({
                  pathname: "/health-reminders",
                  params: {
                    filter: "dueSoon",
                  },
                })
              }
            />

            <OverviewCard
              count={summary.upcoming}
              label="Upcoming"
              icon="calendar-outline"
              type="upcoming"
              onPress={() =>
                router.push({
                  pathname: "/health-reminders",
                  params: {
                    filter: "upcoming",
                  },
                })
              }
            />
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Pets</Text>

          <Pressable
            style={({ pressed }) => [
              styles.seeAllButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/pets")}
          >
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        {!loading && pets.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="paw-outline" size={28} color="#2E7D6B" />
            </View>

            <Text style={styles.emptyTitle}>No pets registered</Text>

            <Text style={styles.emptyDescription}>
              Add your first pet to start monitoring health records and
              schedules.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.addPetButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/add-pet")}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />

              <Text style={styles.addPetText}>Add Pet</Text>
            </Pressable>
          </View>
        ) : (
          pets
            .slice(0, 2)
            .map((pet) => (
              <PetCard
                key={pet.pet_id}
                pet={pet}
                onPress={() => openPet(pet.pet_id)}
              />
            ))
        )}

        <View style={[styles.sectionHeader, styles.remindersSectionHeader]}>
          <Text style={styles.sectionTitle}>Health Reminders</Text>

          <Pressable
            style={({ pressed }) => [
              styles.seeAllButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/health-reminders")}
          >
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        {!loading && reminders.length === 0 ? (
          <View style={styles.emptyReminder}>
            <View style={styles.emptyReminderIcon}>
              <Ionicons
                name="checkmark-circle-outline"
                size={27}
                color="#2E7D6B"
              />
            </View>

            <View style={styles.emptyReminderText}>
              <Text style={styles.emptyReminderTitle}>No health reminders</Text>

              <Text style={styles.emptyReminderDescription}>
                Upcoming veterinary schedules will appear here.
              </Text>
            </View>
          </View>
        ) : (
          reminders.map((schedule) => (
            <ReminderCard
              key={schedule.record_id}
              schedule={schedule}
              onPress={() => openSchedule(schedule.pet_id)}
            />
          ))
        )}

        {(personalCareLoading ||
          personalCareError ||
          personalCare.length > 0) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personal Care</Text>
            </View>

            {personalCareLoading ? (
              <View style={styles.personalCareLoading}>
                <ActivityIndicator size="small" color="#2E7D6B" />
                <Text style={styles.loadingText}>
                  Loading personal care reminders...
                </Text>
              </View>
            ) : personalCareError ? (
              <Pressable
                style={({ pressed }) => [
                  styles.personalCareError,
                  pressed && styles.pressed,
                ]}
                onPress={async () => {
                  const token = await AsyncStorage.getItem("token");
                  if (token) void loadPersonalCare(token);
                }}
              >
                <Ionicons name="refresh-outline" size={20} color="#2E7D6B" />
                <View style={styles.personalCareErrorText}>
                  <Text style={styles.personalCareErrorTitle}>
                    Personal Care unavailable
                  </Text>
                  <Text style={styles.personalCareErrorDescription}>
                    Tap to try again.
                  </Text>
                </View>
              </Pressable>
            ) : (
              personalCare.map((schedule) => (
                <PersonalCareCard
                  key={schedule.care_schedule_id}
                  schedule={schedule}
                  onPress={() => openSchedule(schedule.pet_id)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewCard({
  count,
  label,
  icon,
  type,
  onPress,
}: {
  count: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: "overdue" | "due" | "upcoming";
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.overviewCard,
        type === "overdue" && styles.overdueCard,
        type === "due" && styles.dueCard,
        type === "upcoming" && styles.upcomingCard,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.overviewIcon,
          type === "overdue" && styles.overdueIcon,
          type === "due" && styles.dueIcon,
          type === "upcoming" && styles.upcomingIcon,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            type === "overdue"
              ? "#E57373"
              : type === "due"
                ? "#F5A623"
                : "#2E7D6B"
          }
        />
      </View>

      <Text
        style={[
          styles.overviewCount,
          type === "overdue" && styles.overdueCount,
          type === "due" && styles.dueCount,
        ]}
      >
        {count}
      </Text>

      <Text style={styles.overviewLabel}>{label}</Text>
    </Pressable>
  );
}

function PetCard({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const imageSource = getPetImageSource(pet.photo_url);

  const status = pet.pet_status || "Safe";

  const isMissing = status.toLowerCase() === "missing";

  const details = [pet.breed || pet.species, pet.sex]
    .filter(Boolean)
    .join(" • ");

  return (
    <Pressable
      style={({ pressed }) => [styles.petCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.petImageContainer}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.petImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.petPlaceholder}>
            <Ionicons name="paw" size={30} color="#2E7D6B" />
          </View>
        )}
      </View>

      <View style={styles.petInfo}>
        <View style={styles.petNameRow}>
          <Text style={styles.petName} numberOfLines={1}>
            {pet.pet_name}
          </Text>

          <View style={[styles.safeBadge, isMissing && styles.missingBadge]}>
            <View style={[styles.safeDot, isMissing && styles.missingDot]} />

            <Text style={[styles.safeText, isMissing && styles.missingText]}>
              {status}
            </Text>
          </View>
        </View>

        <Text style={styles.petBreed}>{details || pet.species || "Pet"}</Text>

        <View style={styles.petDetail}>
          <Ionicons name="medical-outline" size={16} color="#2E7D6B" />

          <Text style={styles.petDetailText}>
            View health records & schedules
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={22} color="#6B7C73" />
    </Pressable>
  );
}

function ReminderCard({
  schedule,
  onPress,
}: {
  schedule: HealthSchedule;
  onPress: () => void;
}) {
  const days = Number(schedule.days_until_due);

  const statusInfo = getScheduleStatus(days);

  return (
    <Pressable
      style={({ pressed }) => [styles.reminderCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View
        style={[
          styles.reminderIcon,
          statusInfo.type === "overdue" && styles.overdueReminderIcon,
          statusInfo.type === "due" && styles.warningIcon,
        ]}
      >
        <Ionicons
          name={getServiceIcon(schedule.service_type)}
          size={23}
          color={
            statusInfo.type === "overdue"
              ? "#E57373"
              : statusInfo.type === "due"
                ? "#F5A623"
                : "#2E7D6B"
          }
        />
      </View>

      <View style={styles.reminderInfo}>
        <Text style={styles.reminderTitle} numberOfLines={1}>
          {schedule.service_type}
        </Text>

        <Text style={styles.reminderPet}>{schedule.pet_name}</Text>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="#6B7C73" />

          <Text style={styles.dateText}>
            {formatDueText(days, schedule.next_due_date)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.statusBadge,
          statusInfo.type === "overdue"
            ? styles.overdueBadge
            : statusInfo.type === "due"
              ? styles.warningBadge
              : styles.upcomingBadge,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            statusInfo.type === "overdue"
              ? styles.overdueText
              : statusInfo.type === "due"
                ? styles.warningText
                : styles.upcomingText,
          ]}
        >
          {statusInfo.label}
        </Text>
      </View>
    </Pressable>
  );
}

function PersonalCareCard({
  schedule,
  onPress,
}: {
  schedule: PersonalCareSchedule;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.reminderCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.reminderIcon, styles.personalCareIcon]}>
        <Ionicons name="sparkles-outline" size={23} color="#2E7D6B" />
      </View>

      <View style={styles.reminderInfo}>
        <Text style={styles.reminderTitle} numberOfLines={1}>
          {schedule.care_type}
        </Text>
        <Text style={styles.reminderPet}>{schedule.pet_name}</Text>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="#6B7C73" />
          <Text style={styles.dateText}>
            {formatDate(schedule.scheduled_date)}
          </Text>
        </View>
      </View>

      <View style={styles.personalCareBadge}>
        <Text style={styles.personalCareBadgeText}>Personal Care</Text>
      </View>
    </Pressable>
  );
}

function getPetImageSource(
  photoUrl?: string | null,
): ImageSourcePropType | null {
  if (!photoUrl) {
    return null;
  }

  if (
    photoUrl.startsWith("http://") ||
    photoUrl.startsWith("https://") ||
    photoUrl.startsWith("file://") ||
    photoUrl.startsWith("content://")
  ) {
    return {
      uri: photoUrl,
    };
  }

  return {
    uri: `${API_URL.replace("/api", "")}/${photoUrl.replace(/^\/+/, "")}`,
  };
}

function getScheduleStatus(days: number) {
  if (days < 0) {
    return {
      label: "Overdue",
      type: "overdue" as const,
    };
  }

  if (days <= 7) {
    return {
      label: "Due Soon",
      type: "due" as const,
    };
  }

  return {
    label: "Upcoming",
    type: "upcoming" as const,
  };
}

function formatDueText(days: number, date: string) {
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
    return `Overdue by ${Math.abs(days)} days`;
  }

  return formatDate(date);
}

function formatDate(date: string) {
  if (!date) {
    return "No due date";
  }

  const cleanDate = String(date).split("T")[0];

  const parts = cleanDate.split("-");

  if (parts.length !== 3) {
    return cleanDate;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const localDate = new Date(year, month - 1, day);

  return localDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPhilippineDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getServiceIcon(serviceType: string): keyof typeof Ionicons.glyphMap {
  const service = serviceType.toLowerCase();

  if (service.includes("vacc")) {
    return "medical";
  }

  if (service.includes("deworm")) {
    return "fitness";
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
    backgroundColor: "#FFF5E9",
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 16,
  },

  smallText: {
    fontSize: 16,
    color: "#6B7C73",
  },

  ownerName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2E3A34",
    marginTop: 2,
  },

  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F5A623",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  welcomeCard: {
    minHeight: 168,
    borderRadius: 22,
    backgroundColor: "#CFE8DD",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    padding: 20,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },

  welcomeTextContainer: {
    width: "58%",
    zIndex: 3,
  },

  welcomeTitle: {
    fontSize: 25,
    lineHeight: 31,
    color: "#2E7D6B",
    fontWeight: "800",
  },

  welcomeSubtitle: {
    marginTop: 8,
    color: "#56B091",
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 210,
  },

  welcomeCreamShape: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -34,
    top: -43,
    backgroundColor: "#FFF5E9",
    opacity: 0.92,
  },

  welcomeCoralShape: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    right: 118,
    bottom: 17,
    backgroundColor: "#E57373",
    opacity: 0.22,
  },

  welcomePetImage: {
    position: "absolute",
    width: "45%",
    height: 168,
    right: -3,
    bottom: -5,
    zIndex: 2,
  },

  bigPaw: {
    position: "absolute",
    fontSize: 82,
    right: 91,
    bottom: -23,
    opacity: 0.05,
    zIndex: 1,
  },

  sectionHeader: {
    marginTop: 22,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#2E3A34",
  },

  seeAll: {
    fontSize: 15,
    color: "#2E7D6B",
    fontWeight: "700",
  },

  remindersSectionHeader: {
    marginTop: 8,
  },

  seeAllButton: {
    minHeight: 44,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  overviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  overviewCard: {
    flex: 1,
    minWidth: 92,
    minHeight: 116,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  overdueCard: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    borderColor: "rgba(229, 115, 115, 0.28)",
  },

  dueCard: {
    backgroundColor: "rgba(245, 166, 35, 0.12)",
    borderColor: "rgba(245, 166, 35, 0.28)",
  },

  upcomingCard: {
    backgroundColor: "rgba(129, 199, 132, 0.12)",
    borderColor: "rgba(86, 176, 145, 0.28)",
  },

  overviewIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },

  overdueIcon: {
    backgroundColor: "rgba(229, 115, 115, 0.18)",
  },

  dueIcon: {
    backgroundColor: "rgba(245, 166, 35, 0.18)",
  },

  upcomingIcon: {
    backgroundColor: "#CFE8DD",
  },

  overviewCount: {
    fontSize: 27,
    fontWeight: "900",
    color: "#2E7D6B",
  },

  overdueCount: {
    color: "#E57373",
  },

  dueCount: {
    color: "#F5A623",
  },

  overviewLabel: {
    fontSize: 13,
    color: "#6B7C73",
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
  },

  overviewLoadingContainer: {
    minHeight: 100,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  loadingText: {
    fontSize: 14,
    color: "#6B7C73",
  },

  petCard: {
    minHeight: 105,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  petImageContainer: {
    width: 78,
    height: 78,
    borderRadius: 16,
    backgroundColor: "#FFF5E9",
    overflow: "hidden",
  },

  petImage: {
    width: "100%",
    height: "100%",
  },

  petPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF5E9",
  },

  petInfo: {
    flex: 1,
    marginLeft: 14,
  },

  petNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  petName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#2E3A34",
    maxWidth: "65%",
  },

  safeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#CFE8DD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },

  safeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#81C784",
  },

  safeText: {
    color: "#81C784",
    fontSize: 12,
    fontWeight: "700",
  },

  missingBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  missingDot: {
    backgroundColor: "#E57373",
  },

  missingText: {
    color: "#E57373",
  },

  petBreed: {
    fontSize: 14,
    color: "#6B7C73",
    marginTop: 3,
  },

  petDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 5,
  },

  petDetailText: {
    fontSize: 13,
    color: "#2E7D6B",
    fontWeight: "600",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    padding: 22,
    alignItems: "center",
  },

  emptyIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2E3A34",
    marginTop: 12,
  },

  emptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7C73",
    textAlign: "center",
    marginTop: 5,
  },

  addPetButton: {
    marginTop: 14,
    height: 42,
    borderRadius: 13,
    paddingHorizontal: 18,
    backgroundColor: "#2E7D6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  addPetText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  reminderCard: {
    minHeight: 95,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    padding: 13,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },

  reminderIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#FFF5E9",
    justifyContent: "center",
    alignItems: "center",
  },

  warningIcon: {
    backgroundColor: "#FAD7A0",
  },

  overdueReminderIcon: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  personalCareIcon: {
    backgroundColor: "#CFE8DD",
  },

  reminderInfo: {
    flex: 1,
    marginLeft: 12,
  },

  reminderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2E3A34",
  },

  reminderPet: {
    fontSize: 14,
    color: "#6B7C73",
    marginTop: 2,
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },

  dateText: {
    fontSize: 13,
    color: "#6B7C73",
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 5,
  },

  overdueBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  warningBadge: {
    backgroundColor: "#FAD7A0",
  },

  upcomingBadge: {
    backgroundColor: "#CFE8DD",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },

  overdueText: {
    color: "#E57373",
  },

  warningText: {
    color: "#F5A623",
  },

  upcomingText: {
    color: "#56B091",
  },

  personalCareBadge: {
    maxWidth: 76,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 5,
    backgroundColor: "#CFE8DD",
  },

  personalCareBadgeText: {
    color: "#2E7D6B",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  personalCareLoading: {
    minHeight: 70,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  personalCareError: {
    borderRadius: 17,
    backgroundColor: "#FFF5E9",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  personalCareErrorText: {
    marginLeft: 10,
  },

  personalCareErrorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2E3A34",
  },

  personalCareErrorDescription: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7C73",
  },

  emptyReminder: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 17,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  emptyReminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyReminderText: {
    flex: 1,
    marginLeft: 12,
  },

  emptyReminderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2E3A34",
  },

  emptyReminderDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6B7C73",
    marginTop: 3,
  },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#CFE8DD",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 5,
  },

  navItem: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
  },

  navText: {
    fontSize: 12,
    color: "#6B7C73",
    marginTop: 4,
    fontWeight: "600",
  },

  activeNavText: {
    color: "#2E7D6B",
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.7,
  },
});
