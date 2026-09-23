const EXPO_PUSH_URL =
  "https://exp.host/--/api/v2/push/send";


async function sendExpoPushNotification({
  to,
  title,
  body,
  data = {},
}) {
  try {
    if (
      !to ||
      (!to.startsWith("ExponentPushToken[") &&
        !to.startsWith("ExpoPushToken["))
    ) {
      return {
        success: false,
        message: "Invalid Expo push token.",
      };
    }

    const message = {
      to,
      sound: "default",
      title,
      body,
      data,
      priority: "high",

      channelId: "pet-health-reminders",
    };

    const response = await fetch(
      EXPO_PUSH_URL,
      {
        method: "POST",

        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },

        body: JSON.stringify(message),
      }
    );

    const responseText =
      await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = {
        raw: responseText,
      };
    }

    console.log(
      "EXPO PUSH HTTP STATUS:",
      response.status
    );

    console.log(
      "EXPO PUSH RESPONSE:",
      JSON.stringify(result, null, 2)
    );

    if (!response.ok) {
      return {
        success: false,
        message:
          "Expo Push Service request failed.",
        response: result,
      };
    }

    const ticket =
      result?.data;

    if (ticket?.status === "error") {
      return {
        success: false,
        message:
          ticket.message ||
          "Expo rejected the push notification.",
        error:
          ticket.details?.error ||
          null,
        ticket,
      };
    }

    return {
      success: true,
      ticket,
    };
  } catch (error) {
    console.error(
      "SEND EXPO PUSH ERROR:",
      error
    );

    return {
      success: false,
      message:
        error.message ||
        "Unable to send push notification.",
    };
  }
}

module.exports = {
  sendExpoPushNotification,
};
