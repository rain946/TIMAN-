const db = require("../config/db");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;

function isExpoPushToken(token) {
  return (
    typeof token === "string" &&
    /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token)
  );
}

function maskPushToken(token) {
  if (typeof token !== "string" || token.length <= 16) return "***";
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

async function deactivatePushToken({ pushTokenId, token, reason }) {
  if (!pushTokenId && !token) return;

  const conditions = [];
  const values = [];

  if (pushTokenId) {
    conditions.push("push_token_id = ?");
    values.push(pushTokenId);
  }
  if (token) {
    conditions.push("expo_push_token = ?");
    values.push(token);
  }

  const [result] = await db.query(
    `UPDATE push_tokens
     SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE (${conditions.join(" OR ")}) AND is_active = TRUE`,
    values
  );

  console.log("TIMAN PUSH TOKEN DEACTIVATED:", {
    pushTokenId: pushTokenId || null,
    token: maskPushToken(token),
    reason,
    affectedRows: result.affectedRows,
  });
}

async function getExpoPushReceipt(ticketId) {
  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: [ticketId] }),
  });

  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { raw: responseText };
  }

  if (!response.ok || result?.errors?.length) {
    const error = new Error("Expo push receipt request failed.");
    error.status = response.status;
    error.response = result;
    throw error;
  }

  return result?.data?.[ticketId] || null;
}

async function checkAndHandleExpoPushReceipt({
  ticketId,
  pushTokenId,
  token,
  userId,
}) {
  const receipt = await getExpoPushReceipt(ticketId);

  if (!receipt) {
    console.warn("TIMAN EXPO PUSH RECEIPT NOT READY:", {
      userId: userId || null,
      pushTokenId: pushTokenId || null,
      ticketId,
    });
    return null;
  }

  console.log("TIMAN EXPO PUSH RECEIPT:", {
    userId: userId || null,
    pushTokenId: pushTokenId || null,
    ticketId,
    status: receipt.status,
    error: receipt.details?.error || null,
    message: receipt.message || null,
  });

  if (receipt.details?.error === "DeviceNotRegistered") {
    await deactivatePushToken({
      pushTokenId,
      token,
      reason: "DeviceNotRegistered receipt",
    });
  }

  return receipt;
}

function scheduleExpoPushReceiptCheck(context) {
  const timeout = setTimeout(() => {
    checkAndHandleExpoPushReceipt(context).catch((error) => {
      console.error("TIMAN EXPO RECEIPT CHECK ERROR:", {
        ticketId: context.ticketId,
        pushTokenId: context.pushTokenId || null,
        status: error.status || null,
        response: error.response || null,
        message: error.message,
      });
    });
  }, RECEIPT_CHECK_DELAY_MS);
  timeout.unref?.();
}

async function waitForExpoPushReceipt(context, options = {}) {
  const attempts = options.attempts || 5;
  const delayMs = options.delayMs || 2000;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const receipt = await checkAndHandleExpoPushReceipt(context);
    if (receipt) return receipt;
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

async function sendExpoPushNotification({
  to,
  title,
  body,
  data = {},
  pushTokenId = null,
  userId = null,
}) {
  try {
    if (!isExpoPushToken(to)) {
      console.warn("TIMAN INVALID EXPO PUSH TOKEN:", {
        userId,
        pushTokenId,
        token: maskPushToken(to),
      });
      return { success: false, message: "Invalid Expo push token." };
    }

    console.log("TIMAN EXPO PUSH TARGET:", {
      userId,
      pushTokenId,
      token: maskPushToken(to),
      type: data.type || null,
    });

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        title,
        body,
        sound: "default",
        priority: "high",
        channelId: "pet-health-reminders",
        data,
      }),
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    const ticket = result?.data;
    console.log("TIMAN EXPO PUSH TICKET RESPONSE:", {
      userId,
      pushTokenId,
      httpStatus: response.status,
      ticketStatus: ticket?.status || null,
      ticketId: ticket?.id || null,
      error: ticket?.details?.error || null,
      requestErrors: result?.errors || null,
    });

    if (!response.ok || result?.errors?.length) {
      return {
        success: false,
        message: "Expo Push Service request failed.",
        response: result,
      };
    }

    if (!ticket || ticket.status !== "ok" || !ticket.id) {
      const ticketError = ticket?.details?.error || null;
      if (ticketError === "DeviceNotRegistered") {
        await deactivatePushToken({
          pushTokenId,
          token: to,
          reason: "DeviceNotRegistered ticket",
        });
      }
      return {
        success: false,
        message: ticket?.message || "Expo rejected the push notification.",
        error: ticketError,
        ticket,
      };
    }

    scheduleExpoPushReceiptCheck({
      ticketId: ticket.id,
      pushTokenId,
      token: to,
      userId,
    });

    return { success: true, ticket };
  } catch (error) {
    console.error("SEND EXPO PUSH ERROR:", {
      userId,
      pushTokenId,
      message: error.message,
    });
    return {
      success: false,
      message: error.message || "Unable to send push notification.",
    };
  }
}

module.exports = {
  checkAndHandleExpoPushReceipt,
  isExpoPushToken,
  maskPushToken,
  sendExpoPushNotification,
  waitForExpoPushReceipt,
};
