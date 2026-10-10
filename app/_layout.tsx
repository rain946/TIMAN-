import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppAlert, AppDialogProvider } from "../components/dialogs/AppDialog";
import MissingPetAlertConsentModal from "../components/modals/MissingPetAlertConsentModal";
import { registerDeviceForPushNotifications } from "../services/notificationService";
import { checkNearbyAlertEnrollmentForSession } from "../services/nearbyAlertEnrollment";





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
  "nearby_lost_pet",

  "vet_record_added",
  "schedule_cancelled",
  "schedule_rescheduled",
  "personal_care_reminder",
  "clinic_daily_schedule_summary",
];





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

  const rawRecordId =
    data?.recordId ??
    data?.record_id ??
    null;

  const recordId =
    rawRecordId !== null &&
    rawRecordId !== undefined &&
    String(rawRecordId).trim() !== ""
      ? String(rawRecordId).trim()
      : null;

  console.log(
    "TIMAN NOTIFICATION TYPE:",
    type
  );

  console.log(
    "TIMAN NOTIFICATION PET ID:",
    petId
  );





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
      pathname: "/(veterinary)/schedules",
      params: {
        petId,
      },
    });

    return;
  }

  if (type === "personal_care_reminder") {
    if (!petId) return;
    router.push({
      pathname: "/(veterinary)/personal-care-history",
      params: {
        petId,
        petName: typeof data?.petName === "string" ? data.petName : "",
      },
    });
    return;
  }

  if (type === "clinic_daily_schedule_summary") {
    AppAlert.alert(
      typeof data?.title === "string"
        ? data.title
        : "Today's Clinic Schedule",
      typeof data?.message === "string"
        ? data.message
        : `You have ${Number(data?.scheduleCount) || 0} scheduled treatments today.`,
      [{ text: "Close" }],
      { cancelable: true },
    );
    return;
  }





  if (type === "clinic_access_request") {
    console.log(
      "TIMAN: Opening clinic authorization."
    );

    router.push(
      "/clinic-authorization"
    );

    return;
  }





  if (
    type === "clinic_access_approved" ||
    type === "clinic_access_declined" ||
    type === "clinic_access_revoked"
  ) {
    console.log(
      "TIMAN: Opening clinic dashboard."
    );

    router.push(
      "/(clinic)/(tabs)/clinic-dashboard"
    );

    return;
  }





  if (type === "vet_record_added") {
    if (!petId || !recordId) {
      console.log(
        "TIMAN: Vet record notification ignored because petId or recordId is missing."
      );

      return;
    }

    router.push({
      pathname: "/(veterinary)/pet-health-records",
      params: {
        petId,
        recordId,
      },
    });

    return;
  }

  if (type === "schedule_cancelled" || type === "schedule_rescheduled") {
    const title =
      typeof data?.title === "string"
        ? data.title
        : type === "schedule_cancelled"
          ? "Treatment Cancelled"
          : "Treatment Rescheduled";
    const messageParts = [
      typeof data?.message === "string" ? data.message : "",
    ];
    if (!messageParts[0] && typeof data?.reason === "string") {
      messageParts.push(`Reason: ${data.reason}`);
    }
    AppAlert.alert(
      title,
      messageParts.filter(Boolean).join("\n\n") ||
        "The schedule update details are available in Notifications.",
      [{ text: "Close" }],
      { cancelable: true },
    );
    return;
  }





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

  if (type === "nearby_lost_pet") {
    if (!petId) return;
    router.push({
      pathname: "/nearby-lost-pet",
      params: { petId },
    });
    return;
  }





  console.log(
    "TIMAN: Notification type has no navigation handler."
  );
}





export default function RootLayout() {
  const initialResponseHandled =
    useRef(false);

  useEffect(() => {
    let isMounted = true;

    const refreshAuthenticatedServices = async () => {
      const authToken = await AsyncStorage.getItem("token");

      if (!authToken || !isMounted) {
        return;
      }

      try {
        const result = await registerDeviceForPushNotifications();

        if (!result.success) {
          console.log(
            "TIMAN: Startup push registration was not completed:",
            result.message
          );
        }
      } catch (error) {
        console.log(
          "TIMAN STARTUP PUSH REGISTRATION ERROR:",
          error
        );
      }

      if (isMounted) {
        await checkNearbyAlertEnrollmentForSession();
      }
    };

    void refreshAuthenticatedServices().catch((error) => {
      console.log("TIMAN STARTUP SERVICE REFRESH ERROR:", error);
    });






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





    return () => {
      isMounted = false;

      subscription.remove();
    };
  }, []);





  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppDialogProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
      <Stack.Screen name="index" />

      <Stack.Screen name="(auth)/login" />

      <Stack.Screen name="(auth)/register" />

      <Stack.Screen
        name="(owner)"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="(pets)/add-pet"
      />

      <Stack.Screen
        name="(pets)/pet-profile"
      />

      <Stack.Screen
        name="(pets)/archived-pets"
      />

      <Stack.Screen
        name="(pets)/pet-qr"
      />

      <Stack.Screen
        name="(veterinary)/schedules"
      />

      <Stack.Screen
        name="(veterinary)/pet-care-schedule-form"
      />

      <Stack.Screen
        name="(veterinary)/personal-care-history"
      />

      <Stack.Screen
        name="(veterinary)/pet-health-records"
      />

      <Stack.Screen
        name="(clinic)"
      />

      <Stack.Screen
        name="(scanner)/qr-scanner"
      />

      <Stack.Screen
        name="(veterinary)/add-vet-record"
      />

      <Stack.Screen
        name="(veterinary)/clinic-vet-records"
      />

      <Stack.Screen
        name="(veterinary)/clinic-authorization"
      />

      <Stack.Screen
        name="(public)/public-pet"
      />

      <Stack.Screen
        name="(pets)/lost-pet"
      />


      <Stack.Screen
        name="(veterinary)/health-reminders"
      />

        </Stack>
        <MissingPetAlertConsentModal />
      </AppDialogProvider>
    </GestureHandlerRootView>
  );

}
