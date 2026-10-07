import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

import { API_URL, getImageUrl } from "../config/api";


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

  schedule_status:
    | "Pending"
    | "Completed"
    | "Cancelled";

  completed_at: string | null;
  created_at: string;
  clinic_contact_name: string;
  clinic_name: string | null;
};

type ScheduleItem = VetRecord & {
  next_due_date: string;
  daysRemaining: number;
};

type CompletedScheduleItem = VetRecord & {
  next_due_date: string;
};

type ScheduleStatus =
  | "Overdue"
  | "Due Soon"
  | "Upcoming";


// SCREEN

export default function SchedulesScreen() {
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

  // LOAD DATA


  const loadSchedules = useCallback(
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

        const response = await fetch(
          `${API_URL}/vet-records/owner/${petId}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
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
          "OWNER SCHEDULE STATUS:",
          response.status
        );

        console.log(
          "OWNER SCHEDULE RESPONSE:",
          data
        );

        if (!response.ok) {
          Alert.alert(
            "Unable to Load",
            data.message ||
              "Unable to load pet schedules."
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
          "LOAD SCHEDULE ERROR:",
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
      loadSchedules();

      return () => {};
    }, [loadSchedules])
  );


  // PULL REFRESH


  const onRefresh = () => {
    setRefreshing(true);
    loadSchedules(false);
  };


  // ACTIVE SCHEDULES
  // Pending schedules only


  const schedules =
    useMemo<ScheduleItem[]>(() => {
      const today =
        getTodayStart();

      return records
        .filter(
          (
            record
          ): record is VetRecord & {
            next_due_date: string;
          } =>
            Boolean(
              record.next_due_date
            ) &&
            record.schedule_status ===
              "Pending"
        )
        .map((record) => {
          const dueDate =
            parseDatabaseDate(
              record.next_due_date
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

          const daysRemaining =
            Math.round(
              difference /
                (1000 *
                  60 *
                  60 *
                  24)
            );

          return {
            ...record,
            daysRemaining,
          };
        })
        .filter(
          (
            item
          ): item is ScheduleItem =>
            item !== null
        )
        .sort((a, b) => {
          const dateA =
            parseDatabaseDate(
              a.next_due_date
            );

          const dateB =
            parseDatabaseDate(
              b.next_due_date
            );

          if (!dateA || !dateB) {
            return 0;
          }

          return (
            dateA.getTime() -
            dateB.getTime()
          );
        });
    }, [records]);


  // COMPLETED SCHEDULES


  const completedSchedules =
    useMemo<
      CompletedScheduleItem[]
    >(() => {
      return records
        .filter(
          (
            record
          ): record is CompletedScheduleItem =>
            Boolean(
              record.next_due_date
            ) &&
            record.schedule_status ===
              "Completed"
        )
        .sort((a, b) => {
          const dateA =
            a.completed_at
              ? new Date(
                  a.completed_at
                ).getTime()
              : 0;

          const dateB =
            b.completed_at
              ? new Date(
                  b.completed_at
                ).getTime()
              : 0;

          return dateB - dateA;
        });
    }, [records]);

  // ACTIVE GROUPS


  const overdue =
    schedules.filter(
      (item) =>
        item.daysRemaining < 0
    );

  const dueSoon =
    schedules.filter(
      (item) =>
        item.daysRemaining >= 0 &&
        item.daysRemaining <= 30
    );

  const upcoming =
    schedules.filter(
      (item) =>
        item.daysRemaining > 30
    );


  // NEXT ACTIVE SCHEDULE


  const nextSchedule =
    schedules.find(
      (item) =>
        item.daysRemaining >= 0
    ) || null;

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <Header />

        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#2E7D6B"
          />

          <Text
            style={styles.loadingText}
          >
            Loading pet schedules...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===================================================
  // UI
  // ===================================================

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
                  size={31}
                  color="#56B091"
                />
              </View>
            )}

            <View
              style={styles.petInfo}
            >
              <Text
                style={
                  styles.petLabel
                }
              >
                Health Schedule
              </Text>

              <Text
                style={
                  styles.petName
                }
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
                styles.calendarIcon
              }
            >
              <Ionicons
                name="calendar"
                size={23}
                color="#2E7D6B"
              />
            </View>
          </View>
        )}

        {/* NEXT ACTIVE SCHEDULE */}

        {nextSchedule && (
          <View
            style={styles.nextCard}
          >
            <View
              style={styles.nextTop}
            >
              <View
                style={
                  styles.nextIcon
                }
              >
                <Ionicons
                  name="notifications"
                  size={21}
                  color="#F5A623"
                />
              </View>

              <View
                style={
                  styles.nextInfo
                }
              >
                <Text
                  style={
                    styles.nextLabel
                  }
                >
                  NEXT SCHEDULE
                </Text>

                <Text
                  style={
                    styles.nextService
                  }
                >
                  {
                    nextSchedule.service_type
                  }
                </Text>
              </View>

              <View
                style={
                  styles.nextDays
                }
              >
                <Text
                  style={
                    styles.nextDaysNumber
                  }
                >
                  {nextSchedule.daysRemaining ===
                  0
                    ? "Today"
                    : nextSchedule.daysRemaining}
                </Text>

                {nextSchedule.daysRemaining >
                  0 && (
                  <Text
                    style={
                      styles.nextDaysLabel
                    }
                  >
                    days
                  </Text>
                )}
              </View>
            </View>

            <View
              style={
                styles.nextDivider
              }
            />

            <View
              style={
                styles.nextDateRow
              }
            >
              <Ionicons
                name="calendar-outline"
                size={17}
                color="#F5A623"
              />

              <Text
                style={
                  styles.nextDate
                }
              >
                {formatDate(
                  nextSchedule.next_due_date
                )}
              </Text>
            </View>

            <Text
              style={
                styles.nextClinic
              }
            >
              Scheduled from a{" "}
              {
                nextSchedule.service_type
              }{" "}
              veterinary record
              {getClinicName(
                nextSchedule
              )
                ? ` by ${getClinicName(
                    nextSchedule
                  )}`
                : ""}
              .
            </Text>
          </View>
        )}

        {/* ACTIVE SUMMARY */}

        <View
          style={styles.summaryRow}
        >
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

        {/* INFORMATION */}

        <View
          style={styles.infoCard}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#64B5F6"
          />

          <Text
            style={styles.infoText}
          >
            Active schedules are based
            on next due dates recorded
            by authorized veterinary
            clinics. Completed schedules
            remain available below as
            history.
          </Text>
        </View>

        {/* NO ACTIVE SCHEDULE */}

        {schedules.length === 0 && (
          <View
            style={
              styles.emptyCard
            }
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name="calendar-outline"
                size={36}
                color="#56B091"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No Active Schedules
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              There are currently no
              pending health schedules
              for this pet. Completed
              schedules can still be
              viewed below.
            </Text>

            <Pressable
              style={({
                pressed,
              }) => [
                styles.recordsButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={() => {
                if (!petId) {
                  return;
                }

                router.push({
                  pathname:
                    "/vet-records",
                  params: {
                    petId:
                      String(petId),
                  },
                });
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.recordsButtonText
                }
              >
                View Health Records
              </Text>
            </Pressable>
          </View>
        )}

        {/* OVERDUE */}

        {overdue.length > 0 && (
          <ScheduleSection
            title="Overdue"
            subtitle="These schedules have passed their due date."
            icon="alert-circle"
            items={overdue}
            status="Overdue"
          />
        )}

        {/* DUE SOON */}

        {dueSoon.length > 0 && (
          <ScheduleSection
            title="Due Soon"
            subtitle="Due today or within the next 30 days."
            icon="time"
            items={dueSoon}
            status="Due Soon"
          />
        )}

        {/* UPCOMING */}

        {upcoming.length > 0 && (
          <ScheduleSection
            title="Upcoming"
            subtitle="Future pet health schedules."
            icon="calendar"
            items={upcoming}
            status="Upcoming"
          />
        )}

        {/* COMPLETED */}

        {completedSchedules.length >
          0 && (
          <View
            style={
              styles.completedSection
            }
          >
            <View
              style={
                styles.completedSectionHeader
              }
            >
              <View
                style={
                  styles.completedTitleRow
                }
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#2E7D6B"
                />

                <Text
                  style={
                    styles.completedSectionTitle
                  }
                >
                  Completed
                </Text>

                <View
                  style={
                    styles.completedCountBadge
                  }
                >
                  <Text
                    style={
                      styles.completedCountText
                    }
                  >
                    {
                      completedSchedules.length
                    }
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.completedSectionSubtitle
                }
              >
                Health schedules
                completed by an
                authorized veterinary
                clinic.
              </Text>
            </View>

            {completedSchedules.map(
              (record) => (
                <CompletedScheduleCard
                  key={
                    record.record_id
                  }
                  record={record}
                />
              )
            )}
          </View>
        )}

        {/* REMINDER */}

        {schedules.length > 0 && (
          <View
            style={
              styles.reminderCard
            }
          >
            <View
              style={
                styles.reminderIcon
              }
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color="#2E7D6B"
              />
            </View>

            <View
              style={
                styles.reminderInfo
              }
            >
              <Text
                style={
                  styles.reminderTitle
                }
              >
                Health Reminders
              </Text>

              <Text
                style={
                  styles.reminderText
                }
              >
                TIMAN uses pending
                schedules to track
                vaccination, deworming,
                follow-up, and other
                veterinary due dates.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// HEADER
// =====================================================

function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.headerButton}
        onPress={() =>
          router.back()
        }
      >
        <Ionicons
          name="chevron-back"
          size={27}
          color="#2E7D6B"
        />
      </Pressable>

      <Text
        style={styles.headerTitle}
      >
        Health Schedule
      </Text>

      <View
        style={styles.headerButton}
      />
    </View>
  );
}

// =====================================================
// SUMMARY
// =====================================================

function SummaryCard({
  icon,
  number,
  label,
  background,
  iconColor,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;
  number: number;
  label: string;
  background: string;
  iconColor: string;
}) {
  return (
    <View
      style={styles.summaryCard}
    >
      <View
        style={[
          styles.summaryIcon,
          {
            backgroundColor:
              background,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={iconColor}
        />
      </View>

      <Text
        style={
          styles.summaryNumber
        }
      >
        {number}
      </Text>

      <Text
        style={
          styles.summaryLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

// =====================================================
// ACTIVE SCHEDULE SECTION
// =====================================================

function ScheduleSection({
  title,
  subtitle,
  icon,
  items,
  status,
}: {
  title: string;
  subtitle: string;
  icon:
    keyof typeof Ionicons.glyphMap;
  items: ScheduleItem[];
  status: ScheduleStatus;
}) {
  return (
    <View
      style={
        styles.scheduleSection
      }
    >
      <View
        style={
          styles.sectionHeader
        }
      >
        <View
          style={
            styles.sectionTitleRow
          }
        >
          <Ionicons
            name={icon}
            size={19}
            color={getStatusColor(
              status
            )}
          />

          <Text
            style={
              styles.sectionTitle
            }
          >
            {title}
          </Text>

          <View
            style={[
              styles.countBadge,
              {
                backgroundColor:
                  getStatusBackground(
                    status
                  ),
              },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                {
                  color:
                    getStatusColor(
                      status
                    ),
                },
              ]}
            >
              {items.length}
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.sectionSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      {items.map((item) => (
        <ScheduleCard
          key={item.record_id}
          item={item}
          status={status}
        />
      ))}
    </View>
  );
}

// =====================================================
// ACTIVE SCHEDULE CARD
// =====================================================

function ScheduleCard({
  item,
  status,
}: {
  item: ScheduleItem;
  status: ScheduleStatus;
}) {
  return (
    <View
      style={styles.scheduleCard}
    >
      <View
        style={
          styles.scheduleTop
        }
      >
        <View
          style={[
            styles.serviceIcon,
            {
              backgroundColor:
                getStatusBackground(
                  status
                ),
            },
          ]}
        >
          <Ionicons
            name={getServiceIcon(
              item.service_type
            )}
            size={22}
            color={getStatusColor(
              status
            )}
          />
        </View>

        <View
          style={
            styles.scheduleInfo
          }
        >
          <Text
            style={
              styles.serviceTitle
            }
          >
            {item.service_type}
          </Text>

          <View
            style={
              styles.scheduleDateRow
            }
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color="#6B7C73"
            />

            <Text
              style={
                styles.scheduleDate
              }
            >
              {formatDate(
                item.next_due_date
              )}
            </Text>
          </View>
        </View>

        <StatusBadge
          item={item}
          status={status}
        />
      </View>

      <View
        style={
          styles.scheduleDivider
        }
      />

      <View
        style={styles.sourceRow}
      >
        <View
          style={styles.sourceIcon}
        >
          <Ionicons
            name="medical-outline"
            size={15}
            color="#2E7D6B"
          />
        </View>

        <View
          style={styles.sourceInfo}
        >
          <Text
            style={
              styles.sourceLabel
            }
          >
            Based on veterinary record
          </Text>

          <Text
            style={
              styles.sourceText
            }
          >
            Visit:{" "}
            {formatDate(
              item.visit_date
            )}
            {getClinicName(item)
              ? ` • ${getClinicName(
                  item
                )}`
              : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

// =====================================================
// COMPLETED SCHEDULE CARD
// =====================================================

function CompletedScheduleCard({
  record,
}: {
  record: CompletedScheduleItem;
}) {
  return (
    <View
      style={
        styles.completedScheduleCard
      }
    >
      <View
        style={
          styles.completedScheduleTop
        }
      >
        <View
          style={
            styles.completedServiceIcon
          }
        >
          <Ionicons
            name="checkmark-circle"
            size={23}
            color="#2E7D6B"
          />
        </View>

        <View
          style={
            styles.completedScheduleInfo
          }
        >
          <Text
            style={
              styles.completedServiceTitle
            }
          >
            {record.service_type}
          </Text>

          <Text
            style={
              styles.completedScheduleDate
            }
          >
            Scheduled for{" "}
            {formatDate(
              record.next_due_date
            )}
          </Text>
        </View>

        <View
          style={
            styles.completedStatusBadge
          }
        >
          <Text
            style={
              styles.completedStatusText
            }
          >
            Completed
          </Text>
        </View>
      </View>

      <View
        style={
          styles.completedScheduleDivider
        }
      />

      <View
        style={
          styles.completedDetailRow
        }
      >
        <Ionicons
          name="checkmark-done-outline"
          size={17}
          color="#2E7D6B"
        />

        <View
          style={
            styles.completedDetailInfo
          }
        >
          <Text
            style={
              styles.completedDetailLabel
            }
          >
            Completed on
          </Text>

          <Text
            style={
              styles.completedDetailValue
            }
          >
            {record.completed_at
              ? formatDateTime(
                  record.completed_at
                )
              : "Completed"}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.completedClinicRow
        }
      >
        <Ionicons
          name="business-outline"
          size={15}
          color="#6B7C73"
        />

        <Text
          style={
            styles.completedClinicText
          }
        >
          Confirmed by{" "}
          {getClinicName(record) ||
            "Veterinary Clinic"}
        </Text>
      </View>
    </View>
  );
}

// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({
  item,
  status,
}: {
  item: ScheduleItem;
  status: ScheduleStatus;
}) {
  let text = "";

  if (status === "Overdue") {
    const days =
      Math.abs(
        item.daysRemaining
      );

    text =
      days === 1
        ? "1 day late"
        : `${days} days late`;
  }

  if (status === "Due Soon") {
    if (
      item.daysRemaining === 0
    ) {
      text = "Today";
    } else if (
      item.daysRemaining === 1
    ) {
      text = "Tomorrow";
    } else {
      text =
        `${item.daysRemaining} days`;
    }
  }

  if (status === "Upcoming") {
    text = "Scheduled";
  }

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor:
            getStatusBackground(
              status
            ),
        },
      ]}
    >
      <Text
        style={[
          styles.statusText,
          {
            color:
              getStatusColor(
                status
              ),
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// =====================================================
// HELPERS
// =====================================================

function getTodayStart() {
  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return today;
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

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
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

  const normalized =
    value.includes("T")
      ? value
      : value.replace(
          " ",
          "T"
        );

  const date =
    new Date(normalized);

  if (
    Number.isNaN(
      date.getTime()
    )
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

function getClinicName(
  record: VetRecord
) {
  return (
    record.clinic_name ||
    record.clinic_contact_name ||
    ""
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

function getStatusColor(
  status: ScheduleStatus
) {
  switch (status) {
    case "Overdue":
      return "#E57373";

    case "Due Soon":
      return "#F5A623";

    case "Upcoming":
      return "#2E7D6B";
  }
}

function getStatusBackground(
  status: ScheduleStatus
) {
  switch (status) {
    case "Overdue":
      return "rgba(229, 115, 115, 0.14)";

    case "Due Soon":
      return "rgba(229, 115, 115, 0.14)";

    case "Upcoming":
      return "#CFE8DD";
  }
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
