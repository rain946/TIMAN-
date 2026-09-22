import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";

// =====================================================
// VALID TIMAN NOTIFICATION TYPES
// =====================================================

const VALID_NOTIFICATION_TYPES = [
  "health-reminder",
  "pet-health-reminder",
  "health_reminder",

  "clinic_access_request",

  "clinic_access_approved",
  "clinic_access_declined",
  "clinic_access_revoked",

  "lost_pet_scan",
  "pet_qr_scanned",
  "pet_qr_scan",

  "vet_record_added",
];

// =====================================================
// CHECK IF THIS IS A REAL TIMAN NOTIFICATION
// =====================================================

function isValidTimanNotification(
  data: Record<string, any> | undefined
) {
  if (!data) {
    return false;
  }

  const type =
    typeof data.type === "string"
      ? data.type.trim()
      : "";

  if (!type) {
    return false;
  }

  return VALID_NOTIFICATION_TYPES.includes(type);
}

// =====================================================
// HANDLE NOTIFICATION NAVIGATION
// =====================================================

function handleNotificationNavigation(
  data: Record<string, any> | undefined
) {
  console.log(
    "======================================"
  );

  console.log(
    "TIMAN NOTIFICATION TAP DATA:",
    JSON.stringify(data, null, 2)
  );

  console.log(
    "======================================"
  );

  // ===================================================
  // IGNORE INVALID / NON-TIMAN NOTIFICATIONS
  // ===================================================

  if (!isValidTimanNotification(data)) {
    console.log(
      "TIMAN: Ignoring invalid or non-TIMAN notification."
    );

    return;
  }

  const type =
    typeof data?.type === "string"
      ? data.type.trim()
      : "";

  const rawPetId =
    data?.petId ??
    data?.pet_id ??
    null;

  const petId =
    rawPetId !== null &&
    rawPetId !== undefined &&
    String(rawPetId).trim() !== ""
      ? String(rawPetId).trim()
      : null;

  console.log(
    "TIMAN NOTIFICATION TYPE:",
    type
  );

  console.log(
    "TIMAN NOTIFICATION PET ID:",
    petId
  );

  // ===================================================
  // HEALTH / SCHEDULE REMINDER
  // ===================================================

  if (
    type === "health-reminder" ||
    type === "pet-health-reminder" ||
    type === "health_reminder"
  ) {
    if (!petId) {
      console.log(
        "TIMAN: Schedule notification ignored because petId is missing."
      );

      return;
    }

    console.log(
      "TIMAN: Opening schedule for pet:",
      petId
    );

    router.push({
      pathname: "/schedules",
      params: {
        petId,
      },
    });

    return;
  }

  // ===================================================
  // CLINIC ACCESS REQUEST
  // ===================================================

  if (type === "clinic_access_request") {
    console.log(
      "TIMAN: Opening clinic authorization."
    );

    router.push(
      "/clinic-authorization"
    );

    return;
  }

  // ===================================================
  // CLINIC ACCESS RESULT
  // ===================================================

  if (
    type === "clinic_access_approved" ||
    type === "clinic_access_declined" ||
    type === "clinic_access_revoked"
  ) {
    console.log(
      "TIMAN: Opening clinic dashboard."
    );

    router.push(
      "/clinic-dashboard"
    );

    return;
  }

  // ===================================================
  // NEW VETERINARY RECORD
  // ===================================================

  if (type === "vet_record_added") {
    if (!petId) {
      console.log(
        "TIMAN: Vet record notification ignored because petId is missing."
      );

      return;
    }

    router.push({
      pathname: "/vet-records",
      params: {
        petId,
      },
    });

    return;
  }

  // ===================================================
  // LOST PET / QR SCAN
  // ===================================================

  if (
    type === "lost_pet_scan" ||
    type === "pet_qr_scanned" ||
    type === "pet_qr_scan"
  ) {
    if (!petId) {
      console.log(
        "TIMAN: Lost pet notification ignored because petId is missing."
      );

      return;
    }

    console.log(
      "TIMAN: Opening missing pet details:",
      petId
    );

    router.push({
      pathname: "/lost-pet",
      params: {
        petId,
      },
    });

    return;
  }

  // ===================================================
  // SAFETY FALLBACK
  // ===================================================

  console.log(
    "TIMAN: Notification type has no navigation handler."
  );
}

// =====================================================
// ROOT LAYOUT
// =====================================================

export default function RootLayout() {
  const initialResponseHandled =
    useRef(false);

  useEffect(() => {
    let isMounted = true;

    // =================================================
    // NOTIFICATION TAPPED WHILE APP IS RUNNING /
    // BACKGROUND
    // =================================================

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          if (!isMounted) {
            return;
          }

          const data =
            response.notification
              .request.content.data as
              | Record<string, any>
              | undefined;

          console.log(
            "TIMAN: Notification response received."
          );

          // Only real TIMAN notifications can navigate.
          if (
            !isValidTimanNotification(
              data
            )
          ) {
            console.log(
              "TIMAN: Notification response ignored."
            );

            return;
          }

          handleNotificationNavigation(
            data
          );
        }
      );

    // =================================================
    // APP CLOSED -> OPENED FROM NOTIFICATION
    // =================================================

    const checkInitialNotification =
      async () => {
        try {
          if (
            initialResponseHandled.current
          ) {
            return;
          }

          initialResponseHandled.current =
            true;

          const response =
            await Notifications.getLastNotificationResponseAsync();

          // Normal APK launch.
          if (!response) {
            console.log(
              "TIMAN: Normal app launch. No notification response."
            );

            return;
          }

          const data =
            response.notification
              .request.content.data as
              | Record<string, any>
              | undefined;

          console.log(
            "TIMAN: Previous notification response detected."
          );

          // =================================================
          // IMPORTANT:
          // package-only / stale / unknown notification
          // responses must NOT navigate anywhere.
          // =================================================

          if (
            !isValidTimanNotification(
              data
            )
          ) {
            console.log(
              "TIMAN: Initial notification response ignored."
            );

            console.log(
              "TIMAN INVALID DATA:",
              JSON.stringify(
                data,
                null,
                2
              )
            );

            return;
          }

          console.log(
            "TIMAN: App opened from valid TIMAN notification."
          );

          setTimeout(() => {
            if (!isMounted) {
              return;
            }

            handleNotificationNavigation(
              data
            );
          }, 800);
        } catch (error) {
          console.log(
            "TIMAN INITIAL NOTIFICATION ERROR:",
            error
          );
        }
      };

    checkInitialNotification();

    // =================================================
    // CLEANUP
    // =================================================

    return () => {
      isMounted = false;

      subscription.remove();
    };
  }, []);

  // ===================================================
  // APP ROUTES
  // ===================================================

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />

      <Stack.Screen name="login" />

      <Stack.Screen name="register" />

      <Stack.Screen
        name="(owner)"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="add-pet"
      />

      <Stack.Screen
        name="pet-profile"
      />

      <Stack.Screen
        name="pet-qr"
      />

      <Stack.Screen
        name="schedules"
      />

      <Stack.Screen
        name="vet-records"
      />

      <Stack.Screen
        name="clinic-dashboard"
      />

      <Stack.Screen
        name="qr-scanner"
      />

      <Stack.Screen
        name="clinic-pet"
      />

      <Stack.Screen
        name="add-vet-record"
      />

      <Stack.Screen
        name="clinic-vet-records"
      />

      <Stack.Screen
        name="clinic-authorization"
      />

      <Stack.Screen
        name="public-pet"
      />

      <Stack.Screen
        name="lost-pet"
      />


      <Stack.Screen
        name="health-reminders"
      />

    </Stack>
  );

}
