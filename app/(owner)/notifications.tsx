import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/api";

type NotificationItem = {
  notification_id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  pet_id: number | null;
  authorization_id: number | null;
  record_id?: number | null;
  event_date?: string | null;
  cancellation_reason?: string | null;
  is_read: boolean;
  created_at: string;
  pet_name?: string | null;
};

export default function NotificationsScreen({
  showOnlyNewWhenAvailable = true,
}: {
  showOnlyNewWhenAvailable?: boolean;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [markingAll, setMarkingAll] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/notifications`, {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load notifications.");
      }

      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : [],
      );
    } catch (error: any) {
      console.log("LOAD NOTIFICATIONS ERROR:", error);

      Alert.alert(
        "Unable to Load",
        error?.message || "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        return false;
      }

      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update notification.");
      }

      setNotifications((current) =>
        current.map((item) =>
          item.notification_id === notificationId
            ? {
                ...item,
                is_read: true,
              }
            : item,
        ),
      );

      return true;
    } catch (error) {
      console.log("MARK NOTIFICATION READ ERROR:", error);

      return false;
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update notifications.");
      }

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
        })),
      );
    } catch (error: any) {
      console.log("MARK ALL READ ERROR:", error);

      Alert.alert(
        "Unable to Update",
        error?.message || "Unable to mark notifications as read.",
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      setDeletingId(notificationId);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/notifications/${notificationId}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete notification.");
      }

      setNotifications((current) =>
        current.filter((item) => item.notification_id !== notificationId),
      );
    } catch (error: any) {
      console.log("DELETE NOTIFICATION ERROR:", error);

      Alert.alert(
        "Unable to Delete",
        error?.message || "Unable to delete notification.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteNotification = (notification: NotificationItem) => {
    if (!notification.is_read) {
      Alert.alert(
        "Unread Notification",
        "Open the notification first before deleting it.",
      );

      return;
    }

    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",

          onPress: () => deleteNotification(notification.notification_id),
        },
      ],
    );
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      await markAsRead(notification.notification_id);
    }

    console.log("TIMAN INBOX NOTIFICATION:", {
      id: notification.notification_id,
      type: notification.type,
      petId: notification.pet_id,
      petName: notification.pet_name,
    });

    switch (notification.type) {
      case "clinic_access_request":
        router.push("/clinic-authorization");
        break;

      case "clinic_access_approved":
      case "clinic_access_declined":
      case "clinic_access_revoked":
        router.push("/clinic-dashboard");
        break;

      case "schedule_cancelled":
        Alert.alert(
          notification.title,
          getScheduleNotificationDetails(notification),
          [{ text: "Close" }],
          { cancelable: true },
        );
        break;

      case "schedule_rescheduled":
        Alert.alert(
          notification.title,
          getScheduleNotificationDetails(notification),
          [{ text: "Close" }],
          { cancelable: true },
        );
        break;

      case "clinic_daily_schedule_summary":
        Alert.alert(
          notification.title,
          notification.message,
          [{ text: "Close" }],
          { cancelable: true },
        );
        break;

      case "vet_record_added":
        if (!notification.pet_id) {
          Alert.alert(
            "Pet Error",
            "This veterinary record notification is not connected to a pet.",
          );

          return;
        }

        router.push({
          pathname: "/(veterinary)/pet-health-records",
          params: {
            petId: String(notification.pet_id),
            ...(notification.record_id
              ? { recordId: String(notification.record_id) }
              : { notificationCreatedAt: notification.created_at }),
          },
        });

        break;

      case "pet_qr_scanned":
      case "pet_qr_scan":
      case "lost_pet_scan":
        if (!notification.pet_id) {
          Alert.alert(
            "Pet Error",
            "This notification is not connected to a pet.",
          );

          return;
        }

        router.push({
          pathname: "/lost-pet",
          params: {
            petId: String(notification.pet_id),
          },
        });

        break;

      case "nearby_lost_pet":
        if (!notification.pet_id) {
          Alert.alert("Pet Error", "This notification is not connected to a pet.");
          return;
        }
        router.push({
          pathname: "/nearby-lost-pet",
          params: { petId: String(notification.pet_id) },
        });
        break;

      case "vaccination_reminder":
      case "deworming_reminder":
      case "health_reminder":
        if (!notification.pet_id) {
          Alert.alert(
            "Pet Error",
            "This health reminder is not connected to a pet.",
          );

          return;
        }

        router.push({
          pathname: "/(veterinary)/schedules",
          params: {
            petId: String(notification.pet_id),
          },
        });

        break;

      case "personal_care_reminder":
        if (!notification.pet_id) {
          Alert.alert(
            "Pet Error",
            "This personal care reminder is not connected to a pet.",
          );
          return;
        }
        router.push({
          pathname: "/(veterinary)/personal-care-history",
          params: {
            petId: String(notification.pet_id),
            petName: notification.pet_name || "",
          },
        });
        break;

      default:
        console.log(
          "TIMAN: No navigation configured for notification type:",
          notification.type,
        );

        break;
    }
  };

  const formatNotificationTime = (value: string) => {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = new Date();

    const difference = now.getTime() - date.getTime();

    const minutes = Math.floor(difference / 60000);

    const hours = Math.floor(difference / 3600000);

    const days = Math.floor(difference / 86400000);

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    if (hours < 24) {
      return `${hours}h ago`;
    }

    if (days < 7) {
      return `${days}d ago`;
    }

    return date.toLocaleDateString();
  };

  const getNotificationIcon = (
    type: string,
  ): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "clinic_access_request":
        return "medkit-outline";

      case "clinic_access_approved":
        return "checkmark-circle-outline";

      case "clinic_access_declined":
        return "close-circle-outline";

      case "clinic_access_revoked":
        return "remove-circle-outline";

      case "vet_record_added":
        return "medical-outline";

      case "pet_qr_scanned":
      case "pet_qr_scan":
      case "lost_pet_scan":
        return "qr-code-outline";

      case "nearby_lost_pet":
        return "alert-circle-outline";

      case "vaccination_reminder":
      case "deworming_reminder":
      case "health_reminder":
        return "calendar-outline";

      case "schedule_cancelled":
        return "close-circle-outline";

      case "schedule_rescheduled":
        return "calendar-outline";

      case "personal_care_reminder":
        return "paw-outline";

      case "clinic_daily_schedule_summary":
        return "calendar-number-outline";

      default:
        return "notifications-outline";
    }
  };

  const unreadNotifications = notifications.filter((item) => !item.is_read);
  const unreadCount = unreadNotifications.length;
  const visibleNotifications =
    showOnlyNewWhenAvailable && unreadCount > 0
      ? unreadNotifications
      : notifications;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notifications</Text>

          <Text style={styles.headerSubtitle}>Pet updates and reminders</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>
              {showOnlyNewWhenAvailable && unreadCount > 0 ? "New" : "Recent"}
            </Text>

            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Pressable
                disabled={markingAll}
                onPress={handleMarkAllRead}
                style={({ pressed }) => [
                  styles.markAllButton,
                  pressed && styles.pressed,
                ]}
              >
                {markingAll ? (
                  <ActivityIndicator size="small" color="#2E7D6B" />
                ) : (
                  <Text style={styles.markAllText}>Mark all read</Text>
                )}
              </Pressable>
            )}

          </View>
        </View>

        {visibleNotifications.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="notifications-outline"
                size={37}
                color="#2E7D6B"
              />
            </View>

            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
          </View>
        )}

        {visibleNotifications.map((notification) => (
          <View
            key={notification.notification_id}
            style={[
              styles.notificationShell,
              !notification.is_read && styles.unreadShell,
            ]}
          >
            <ReanimatedSwipeable
              enabled={notification.is_read}
              friction={1.5}
              rightThreshold={40}
              dragOffsetFromRightEdge={16}
              overshootRight={false}
              childrenContainerStyle={styles.swipeChildren}
              containerStyle={[
                styles.swipeContainer,
                !notification.is_read && styles.unreadSwipeContainer,
              ]}
              renderRightActions={
                notification.is_read
                  ? (_progress, _translation, swipeableMethods) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete notification"
                        disabled={deletingId === notification.notification_id}
                        onPress={() => {
                          swipeableMethods.close();
                          setTimeout(
                            () => handleDeleteNotification(notification),
                            180,
                          );
                        }}
                        style={({ pressed }) => [
                          styles.swipeDeleteAction,
                          pressed && styles.swipeDeletePressed,
                        ]}
                      >
                        {deletingId === notification.notification_id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons
                            name="trash-outline"
                            size={22}
                            color="#FFFFFF"
                          />
                        )}
                      </Pressable>
                    )
                  : undefined
              }
            >
              <Pressable
                onPress={() => handleNotificationPress(notification)}
                style={({ pressed }) => [
                  styles.notificationCard,

                  !notification.is_read && styles.unreadCard,

                  pressed && styles.notificationPressed,
                ]}
              >
                {!notification.is_read && <View style={styles.unreadDot} />}

                <View style={styles.notificationIcon}>
                  <Ionicons
                    name={getNotificationIcon(notification.type)}
                    size={23}
                    color="#2E7D6B"
                  />
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.notificationTop}>
                    <Text
                      style={[
                        styles.notificationTitle,

                        !notification.is_read && styles.unreadTitle,
                      ]}
                    >
                      {notification.title}
                    </Text>

                    <Text style={styles.notificationTime}>
                      {formatNotificationTime(notification.created_at)}
                    </Text>
                  </View>

                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                </View>
              </Pressable>
            </ReanimatedSwipeable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function getScheduleNotificationDetails(notification: NotificationItem) {
  const details = [notification.message.trim()];
  const reason = notification.cancellation_reason?.trim();

  if (
    notification.type === "schedule_cancelled" &&
    reason &&
    !notification.message.toLocaleLowerCase().includes("reason:")
  ) {
    details.push(`Reason: ${reason}`);
  }

  if (notification.event_date) {
    const date = new Date(`${notification.event_date}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      const label =
        notification.type === "schedule_cancelled"
          ? "Cancelled on"
          : "Rescheduled on";
      details.push(
        `${label}: ${date.toLocaleDateString([], {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`,
      );
    }
  }

  return details.filter(Boolean).join("\n\n");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5E9",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: "#6B7C73",
  },

  header: {
    minHeight: 68,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },

  backButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },

  headerContent: {
    flex: 1,
    marginLeft: 5,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2E3A34",
  },

  headerSubtitle: {
    fontSize: 9,
    color: "#6B7C73",
    marginTop: 2,
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 110,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 27,
    marginBottom: 11,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#2E3A34",
  },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  markAllButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  markAllText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2E7D6B",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 18,
    paddingHorizontal: 25,
    paddingVertical: 34,
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
    fontSize: 15,
    fontWeight: "900",
    color: "#2E3A34",
    marginTop: 14,
  },

  notificationShell: {
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },

  unreadShell: {
    backgroundColor: "#FFF5E9",
  },

  swipeContainer: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },

  swipeChildren: {
    backgroundColor: "#FFFFFF",
  },

  unreadSwipeContainer: {
    backgroundColor: "#FFF5E9",
  },

  notificationCard: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    padding: 15,
    flexDirection: "row",
  },

  unreadCard: {
    backgroundColor: "#FFF5E9",
  },

  notificationPressed: {
    opacity: 0.72,
  },

  unreadDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E7D6B",
  },

  notificationIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },

  notificationTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: 12,
  },

  notificationTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#2E3A34",
    paddingRight: 8,
  },

  unreadTitle: {
    fontWeight: "900",
    color: "#2E3A34",
  },

  notificationTime: {
    fontSize: 8,
    color: "#6B7C73",
  },

  notificationMessage: {
    fontSize: 10,
    lineHeight: 16,
    color: "#6B7C73",
    marginTop: 5,
    paddingRight: 8,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  swipeDeleteAction: {
    width: 76,
    height: "100%",
    backgroundColor: "#E57373",
    alignItems: "center",
    justifyContent: "center",
  },

  swipeDeletePressed: {
    backgroundColor: "#D95F5F",
  },

  pressed: {
    opacity: 0.7,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },
});
