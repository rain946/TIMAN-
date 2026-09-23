import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { API_URL } from "../config/api";

const STORAGE_KEY = "timan_health_reminders";





Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});





type HealthSchedule = {
  recordId: number;
  petId: number;
  petName: string;
  serviceType: string;
  dueDate: string;
};

type StoredReminder = {
  key: string;
  notificationId: string;
  recordId: number;
  petId: number;
  petName: string;
  serviceType: string;
  dueDate: string;
  reminderDate: string;
};





export async function requestNotificationPermission() {
  try {
    
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(
        "pet-health-reminders",
        {
          name: "Pet Health Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: "default",
        }
      );
    }

    const current =
      await Notifications.getPermissionsAsync();

    let status = current.status;

    if (status !== "granted") {
      const result =
        await Notifications.requestPermissionsAsync();

      status = result.status;
    }

    return status === "granted";
  } catch (error) {
    console.log(
      "NOTIFICATION PERMISSION ERROR:",
      error
    );

    return false;
  }
}





export async function registerDeviceForPushNotifications() {
  try {
    
    
    

    const granted =
      await requestNotificationPermission();

    if (!granted) {
      return {
        success: false,
        message: "Notification permission was not granted.",
      };
    }

    
    
    

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log(
        "TIMAN: EAS project ID not found."
      );

      return {
        success: false,
        message: "EAS project ID was not found.",
      };
    }

    console.log(
      "TIMAN EAS PROJECT ID:",
      projectId
    );

    
    
    

    const pushTokenResult =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const expoPushToken =
      pushTokenResult.data;

    console.log(
      "TIMAN EXPO PUSH TOKEN:",
      expoPushToken
    );

    if (!expoPushToken) {
      return {
        success: false,
        message: "Expo push token was not generated.",
      };
    }

    
    
    

    const token =
      await AsyncStorage.getItem("token");

    if (!token) {
      return {
        success: false,
        message: "User is not logged in.",
      };
    }

    
    
    

    const response =
      await fetch(
        `${API_URL}/push-tokens/register`,
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            expo_push_token: expoPushToken,
            device_platform: Platform.OS,
          }),
        }
      );

    const responseText =
      await response.text();

    let data: any = {};

    try {
      data = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      data = {
        message: responseText,
      };
    }

    console.log(
      "PUSH TOKEN REGISTER STATUS:",
      response.status
    );

    console.log(
      "PUSH TOKEN REGISTER RESPONSE:",
      data
    );

    if (!response.ok) {
      return {
        success: false,
        message:
          data.message ||
          "Unable to register push token.",
      };
    }

    return {
      success: true,
      pushToken: expoPushToken,
      message: "Device registered for server push notifications.",
    };
  } catch (error: any) {
    console.log(
      "REGISTER DEVICE PUSH ERROR:",
      error
    );

    return {
      success: false,
      message:
        error?.message ||
        "Unable to register device for push notifications.",
    };
  }
}


export async function syncPetHealthReminders(
  petId: number,
  schedules: HealthSchedule[]
) {
  try {
    const granted =
      await requestNotificationPermission();

    if (!granted) {
      return {
        success: false,
        scheduled: 0,
      };
    }

    const stored =
      await getStoredReminders();

    const existingForPet =
      stored.filter(
        (item) =>
          item.petId === petId
      );

    for (const reminder of existingForPet) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          reminder.notificationId
        );
      } catch (error) {
        console.log(
          "CANCEL OLD REMINDER ERROR:",
          error
        );
      }
    }

    const otherPetReminders =
      stored.filter(
        (item) =>
          item.petId !== petId
      );

    const newReminders: StoredReminder[] =
      [];

    for (const schedule of schedules) {
      const dueDate =
        parseDatabaseDate(
          schedule.dueDate
        );

      if (!dueDate) {
        continue;
      }

      const reminderDate =
        new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate() - 1,
          9,
          0,
          0,
          0
        );

      if (
        reminderDate.getTime() <=
        Date.now()
      ) {
        continue;
      }

      const notificationId =
        await Notifications.scheduleNotificationAsync({
          content: {
            title:
              `${schedule.petName}'s Health Reminder`,

            body:
              `${schedule.serviceType} is due tomorrow. ` +
              "Open TIMAN to check the health schedule.",

            sound: "default",

            data: {
              type: "pet-health-reminder",
              petId: schedule.petId,
              recordId: schedule.recordId,
              serviceType: schedule.serviceType,
              dueDate: schedule.dueDate,
            },
          },

          trigger: {
            type:
              Notifications
                .SchedulableTriggerInputTypes
                .DATE,

            date: reminderDate,

            ...(Platform.OS === "android"
              ? {
                  channelId: "pet-health-reminders",
                }
              : {}),
          },
        });

      newReminders.push({
        key:
          `${schedule.petId}-${schedule.recordId}`,

        notificationId,

        recordId:
          schedule.recordId,

        petId:
          schedule.petId,

        petName:
          schedule.petName,

        serviceType:
          schedule.serviceType,

        dueDate:
          schedule.dueDate,

        reminderDate:
          reminderDate.toISOString(),
      });
    }

    const updated = [
      ...otherPetReminders,
      ...newReminders,
    ];

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );

    console.log(
      `TIMAN: ${newReminders.length} reminder(s) scheduled for pet ${petId}.`
    );

    return {
      success: true,
      scheduled: newReminders.length,
    };
  } catch (error) {
    console.log(
      "SYNC HEALTH REMINDERS ERROR:",
      error
    );

    return {
      success: false,
      scheduled: 0,
    };
  }
}


export async function getStoredReminders(): Promise<
  StoredReminder[]
> {
  try {
    const value =
      await AsyncStorage.getItem(
        STORAGE_KEY
      );

    if (!value) {
      return [];
    }

    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (error) {
    console.log(
      "READ REMINDER STORAGE ERROR:",
      error
    );

    return [];
  }
}


export async function getScheduledHealthReminders() {
  try {
    const notifications =
      await Notifications.getAllScheduledNotificationsAsync();

    return notifications.filter(
      (notification) =>
        notification.content.data?.type ===
        "pet-health-reminder"
    );
  } catch (error) {
    console.log(
      "GET SCHEDULED REMINDERS ERROR:",
      error
    );

    return [];
  }
}


export async function sendTestNotification() {
  try {
    const granted =
      await requestNotificationPermission();

    if (!granted) {
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "TIMAN Reminder",

        body:
          "Notifications are working. TIMAN can now remind you about your pet's health schedule.",

        sound: "default",

        data: {
          type: "test-notification",
        },
      },

      trigger: null,
    });

    return true;
  } catch (error) {
    console.log(
      "TEST NOTIFICATION ERROR:",
      error
    );

    return false;
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

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
