import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";

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
import { timanShadow } from "../../components/timan/theme";
import { API_URL } from "../../config/api";

type NotificationItem = {
  notification_id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  pet_id: number | null;
  authorization_id: number | null;
  is_read: boolean;
  created_at: string;
  pet_name?: string | null;
};

export default function NotificationsScreen() {
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
          },
        });

        break;

      case "pet_qr_scanned":
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
      case "lost_pet_scan":
        return "qr-code-outline";

      case "nearby_lost_pet":
        return "alert-circle-outline";

      case "vaccination_reminder":
      case "deworming_reminder":
      case "health_reminder":
        return "calendar-outline";

      default:
        return "notifications-outline";
    }
  };

  const unreadCount = notifications.filter((item) => !item.is_read).length;

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
            <Text style={styles.sectionTitle}>Recent</Text>

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

        {notifications.length === 0 && (
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

        {notifications.map((notification) => (
          <Pressable
            key={notification.notification_id}
            onPress={() => handleNotificationPress(notification)}
            style={({ pressed }) => [
              styles.notificationCard,

              !notification.is_read && styles.unreadCard,

              pressed && styles.pressed,
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

              {notification.type === "clinic_access_request" && (
                <View style={styles.actionRow}>
                  <Text style={styles.actionText}>View Request</Text>

                  <Ionicons name="chevron-forward" size={16} color="#2E7D6B" />
                </View>
              )}

              {notification.is_read && (
                <View style={styles.deleteRow}>
                  <Pressable
                    disabled={deletingId === notification.notification_id}
                    onPress={(event) => {
                      event.stopPropagation();

                      handleDeleteNotification(notification);
                    }}
                    style={({ pressed }) => [
                      styles.deleteButton,

                      pressed && styles.pressed,
                    ]}
                  >
                    {deletingId === notification.notification_id ? (
                      <ActivityIndicator size="small" color="#E57373" />
                    ) : (
                      <>
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color="#E57373"
                        />

                        <Text style={styles.deleteText}>Delete</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
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

  notificationCard: {
    ...timanShadow,
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
  },

  unreadCard: {
    backgroundColor: "#FFF5E9",
    borderColor: "#CFE8DD",
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

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
  },

  actionText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2E7D6B",
    marginRight: 3,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  deleteRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  deleteButton: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  deleteText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#E57373",
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
