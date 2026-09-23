import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";





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
      pathname: "/schedules",
      params: {
        petId,
      },
    });

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
      "/clinic-dashboard"
    );

    return;
  }





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





  console.log(
    "TIMAN: Notification type has no navigation handler."
  );
}





export default function RootLayout() {
  const initialResponseHandled =
    useRef(false);

  useEffect(() => {
    let isMounted = true;






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
        name="(pets)/pet-qr"
      />

      <Stack.Screen
        name="(veterinary)/schedules"
      />

      <Stack.Screen
        name="(veterinary)/vet-records"
      />

      <Stack.Screen
        name="(clinic)/clinic-dashboard"
      />

      <Stack.Screen
        name="(scanner)/qr-scanner"
      />

      <Stack.Screen
        name="(clinic)/clinic-pet"
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
  );

}
