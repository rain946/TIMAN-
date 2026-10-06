const db = require("../config/db");
const nearbyAlertConfig = require("../config/nearbyAlerts");
const { sendExpoPushNotification } = require("./pushService");

const EARTH_RADIUS_KM = 6371.0088;

function isValidCoordinate(latitude, longitude) {
  if (
    latitude === null ||
    latitude === undefined ||
    latitude === "" ||
    longitude === null ||
    longitude === undefined ||
    longitude === ""
  ) {
    return false;
  }
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  return (
    Number.isFinite(parsedLatitude) &&
    Number.isFinite(parsedLongitude) &&
    parsedLatitude >= -90 &&
    parsedLatitude <= 90 &&
    parsedLongitude >= -180 &&
    parsedLongitude <= 180
  );
}

function parseCoordinatePair(latitude, longitude, { allowEmpty = true } = {}) {
  const latitudeEmpty = latitude === null || latitude === undefined || latitude === "";
  const longitudeEmpty = longitude === null || longitude === undefined || longitude === "";

  if (latitudeEmpty && longitudeEmpty && allowEmpty) {
    return { valid: true, latitude: null, longitude: null, empty: true };
  }
  if (latitudeEmpty !== longitudeEmpty) {
    return { valid: false, reason: "partial_coordinates" };
  }
  if (!isValidCoordinate(latitude, longitude)) {
    return { valid: false, reason: "invalid_coordinates" };
  }
  return {
    valid: true,
    latitude: Number(latitude),
    longitude: Number(longitude),
    empty: false,
  };
}

function haversineDistanceKm(latitude1, longitude1, latitude2, longitude2) {
  if (
    !isValidCoordinate(latitude1, longitude1) ||
    !isValidCoordinate(latitude2, longitude2)
  ) {
    return Number.NaN;
  }
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(Number(latitude2) - Number(latitude1));
  const longitudeDelta = radians(Number(longitude2) - Number(longitude1));
  const firstLatitude = radians(Number(latitude1));
  const secondLatitude = radians(Number(latitude2));
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function isLocationFresh(updatedAt, maxAgeDays, now = new Date()) {
  const updated = new Date(updatedAt);
  const current = new Date(now);
  if (Number.isNaN(updated.getTime()) || Number.isNaN(current.getTime())) return false;
  const ageMs = current.getTime() - updated.getTime();
  return ageMs >= 0 && ageMs <= Number(maxAgeDays) * 24 * 60 * 60 * 1000;
}

function getNearbyAlertEnrollmentStatus(preference, now = new Date()) {
  const nearbyAlertsEnabled = Boolean(preference?.nearby_alerts_enabled);
  const hasLocation = isValidCoordinate(
    preference?.alert_latitude,
    preference?.alert_longitude
  );
  const locationFresh =
    hasLocation &&
    isLocationFresh(
      preference?.location_updated_at,
      nearbyAlertConfig.locationMaxAgeDays,
      now
    );

  let enrollmentReason = null;
  if (!preference) enrollmentReason = "no_preference";
  else if (!nearbyAlertsEnabled) enrollmentReason = "disabled";
  else if (!hasLocation) enrollmentReason = "missing_location";
  else if (!locationFresh) enrollmentReason = "stale_location";

  return {
    nearbyAlertsEnabled,
    hasLocation,
    locationFresh,
    enrollmentNeeded: Boolean(enrollmentReason),
    enrollmentReason,
  };
}

function isRecipientEligible(candidate, context) {
  if (!candidate || Number(candidate.user_id) === Number(context.ownerId)) return false;
  if (!Boolean(candidate.nearby_alerts_enabled)) return false;
  if (!isValidCoordinate(candidate.alert_latitude, candidate.alert_longitude)) return false;
  if (!isLocationFresh(candidate.location_updated_at, context.maxAgeDays, context.now)) {
    return false;
  }
  const distanceKm = haversineDistanceKm(
    context.latitude,
    context.longitude,
    candidate.alert_latitude,
    candidate.alert_longitude
  );
  return Number.isFinite(distanceKm) && distanceKm <= context.radiusKm;
}

function hasCooldownExpired(lastAlertAt, cooldownHours, now = new Date()) {
  if (!lastAlertAt) return true;
  const previous = new Date(lastAlertAt);
  const current = new Date(now);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) return false;
  return current.getTime() - previous.getTime() >= Number(cooldownHours) * 60 * 60 * 1000;
}

function hasMovedMinimumDistance(
  previousLatitude,
  previousLongitude,
  latitude,
  longitude,
  minimumDistanceKm
) {
  if (!isValidCoordinate(previousLatitude, previousLongitude)) return true;
  const distance = haversineDistanceKm(
    previousLatitude,
    previousLongitude,
    latitude,
    longitude
  );
  return Number.isFinite(distance) && distance >= Number(minimumDistanceKm);
}

function canBroadcastReport(report) {
  return report?.pet_status === "Missing" && report?.case_status === "Active";
}

function distinctPushTokens(tokens) {
  const seen = new Set();
  return (tokens || []).filter((token) => {
    const value = token?.expo_push_token;
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function evaluateBroadcast(report, latitude, longitude, now = new Date()) {
  if (!canBroadcastReport(report)) return { allowed: false, reason: "inactive_report" };
  if (!isValidCoordinate(latitude, longitude)) {
    return { allowed: false, reason: "invalid_coordinates" };
  }
  if (!report.last_nearby_alert_at) return { allowed: true, reason: "initial_broadcast" };
  if (!hasCooldownExpired(report.last_nearby_alert_at, nearbyAlertConfig.cooldownHours, now)) {
    return { allowed: false, reason: "cooldown" };
  }
  if (
    !hasMovedMinimumDistance(
      report.last_alert_latitude,
      report.last_alert_longitude,
      latitude,
      longitude,
      nearbyAlertConfig.rebroadcastMinDistanceKm
    )
  ) {
    return { allowed: false, reason: "movement_threshold" };
  }
  return { allowed: true, reason: "rebroadcast" };
}

async function broadcastNearbyLostPet({ lostReportId, latitude, longitude }) {
  const coordinates = parseCoordinatePair(latitude, longitude, { allowEmpty: false });
  if (!coordinates.valid) return { status: "skipped", reason: coordinates.reason };

  const connection = await db.getConnection();
  let recipients = [];
  let pet;
  let broadcastReason;

  try {
    await connection.beginTransaction();
    const [reports] = await connection.query(
      `SELECT l.lost_report_id, l.owner_id, l.case_status,
              l.last_nearby_alert_at, l.last_alert_latitude, l.last_alert_longitude,
              p.pet_id, p.pet_name, p.species, p.pet_status
       FROM lost_pet_reports l
       INNER JOIN pets p ON p.pet_id = l.pet_id
       WHERE l.lost_report_id = ?
       LIMIT 1 FOR UPDATE`,
      [lostReportId]
    );
    if (!reports.length) {
      await connection.rollback();
      return { status: "skipped", reason: "report_not_found" };
    }

    pet = reports[0];
    const decision = evaluateBroadcast(pet, coordinates.latitude, coordinates.longitude);
    if (!decision.allowed) {
      await connection.rollback();
      return { status: "skipped", reason: decision.reason };
    }
    broadcastReason = decision.reason;

    const [candidates] = await connection.query(
      `SELECT u.user_id, u.role, nap.nearby_alerts_enabled,
              nap.alert_latitude, nap.alert_longitude, nap.location_updated_at
       FROM nearby_alert_preferences nap
       INNER JOIN users u ON u.user_id = nap.user_id
       WHERE nap.nearby_alerts_enabled = TRUE
         AND nap.alert_latitude IS NOT NULL
         AND nap.alert_longitude IS NOT NULL
         AND nap.location_updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [nearbyAlertConfig.locationMaxAgeDays]
    );

    recipients = candidates.filter((candidate) =>
      isRecipientEligible(candidate, {
        ownerId: pet.owner_id,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        radiusKm: nearbyAlertConfig.radiusKm,
        maxAgeDays: nearbyAlertConfig.locationMaxAgeDays,
        now: new Date(),
      })
    );

    const title = "Missing pet nearby";
    const message = `A ${pet.species} named ${pet.pet_name} was reported missing nearby. Open TIMAN for details.`;
    for (const recipient of recipients) {
      await connection.query(
        `INSERT INTO notifications (user_id, type, title, message, pet_id)
         VALUES (?, 'nearby_lost_pet', ?, ?, ?)`,
        [recipient.user_id, title, message, pet.pet_id]
      );
    }

    await connection.query(
      `UPDATE lost_pet_reports
       SET last_nearby_alert_at = NOW(), last_alert_latitude = ?, last_alert_longitude = ?
       WHERE lost_report_id = ? AND case_status = 'Active'`,
      [coordinates.latitude, coordinates.longitude, lostReportId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const recipientIds = recipients.map((recipient) => recipient.user_id);
  let tokenRows = [];
  if (recipientIds.length) {
    const placeholders = recipientIds.map(() => "?").join(", ");
    const [rows] = await db.query(
      `SELECT DISTINCT push_token_id, user_id, expo_push_token
       FROM push_tokens
       WHERE user_id IN (${placeholders}) AND is_active = TRUE`,
      recipientIds
    );
    tokenRows = distinctPushTokens(rows);
  }

  const title = "Missing pet nearby";
  const body = `A ${pet.species} named ${pet.pet_name} was reported missing nearby. Open TIMAN for details.`;
  const pushResults = await Promise.allSettled(
    tokenRows.map((token) =>
      sendExpoPushNotification({
        to: token.expo_push_token,
        pushTokenId: token.push_token_id,
        userId: token.user_id,
        title,
        body,
        data: {
          type: "nearby_lost_pet",
          petId: String(pet.pet_id),
          lostReportId: String(lostReportId),
        },
      })
    )
  );

  return {
    status: "sent",
    reason: broadcastReason,
    recipientCount: recipients.length,
    deviceCount: tokenRows.length,
    pushAttempts: pushResults.length,
  };
}

module.exports = {
  broadcastNearbyLostPet,
  canBroadcastReport,
  distinctPushTokens,
  evaluateBroadcast,
  getNearbyAlertEnrollmentStatus,
  hasCooldownExpired,
  hasMovedMinimumDistance,
  haversineDistanceKm,
  isLocationFresh,
  isRecipientEligible,
  isValidCoordinate,
  parseCoordinatePair,
};
