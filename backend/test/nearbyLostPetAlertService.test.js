const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canBroadcastReport,
  distinctPushTokens,
  evaluateBroadcast,
  haversineDistanceKm,
  isLocationFresh,
  isRecipientEligible,
  isValidCoordinate,
  parseCoordinatePair,
} = require("../services/nearbyLostPetAlertService");

const now = new Date("2026-10-05T12:00:00.000Z");
const origin = { latitude: 14.5995, longitude: 120.9842 };

test("Haversine same point is approximately zero", () => {
  assert.ok(haversineDistanceKm(14.6, 121, 14.6, 121) < 0.000001);
});

test("Haversine known Manila to Quezon City distance is plausible", () => {
  const distance = haversineDistanceKm(14.5995, 120.9842, 14.676, 121.0437);
  assert.ok(distance > 9 && distance < 12);
});

function candidate(overrides = {}) {
  return {
    user_id: 2,
    nearby_alerts_enabled: 1,
    alert_latitude: 14.61,
    alert_longitude: 120.9842,
    location_updated_at: "2026-10-04T12:00:00.000Z",
    ...overrides,
  };
}

function eligibilityContext(overrides = {}) {
  return {
    ownerId: 1,
    latitude: origin.latitude,
    longitude: origin.longitude,
    radiusKm: 10,
    maxAgeDays: 30,
    now,
    ...overrides,
  };
}

test("user inside 10 km is included", () => {
  assert.equal(isRecipientEligible(candidate(), eligibilityContext()), true);
});

test("user outside 10 km is excluded", () => {
  assert.equal(
    isRecipientEligible(candidate({ alert_latitude: 15 }), eligibilityContext()),
    false
  );
});

test("missing pet owner is excluded", () => {
  assert.equal(isRecipientEligible(candidate({ user_id: 1 }), eligibilityContext()), false);
});

test("opted-out user is excluded", () => {
  assert.equal(isRecipientEligible(candidate({ nearby_alerts_enabled: 0 }), eligibilityContext()), false);
});

test("missing coordinates are excluded", () => {
  assert.equal(isRecipientEligible(candidate({ alert_latitude: null }), eligibilityContext()), false);
});

test("stale location is excluded", () => {
  assert.equal(
    isRecipientEligible(candidate({ location_updated_at: "2026-08-01T00:00:00Z" }), eligibilityContext()),
    false
  );
});

test("fresh location is accepted", () => {
  assert.equal(isLocationFresh("2026-10-04T12:00:00Z", 30, now), true);
});

test("invalid latitude is rejected", () => assert.equal(isValidCoordinate(91, 120), false));
test("invalid longitude is rejected", () => assert.equal(isValidCoordinate(14, 181), false));
test("partial coordinate pair is rejected", () => {
  assert.equal(parseCoordinatePair(14, null).reason, "partial_coordinates");
});

const activeReport = {
  pet_status: "Missing",
  case_status: "Active",
  last_nearby_alert_at: null,
  last_alert_latitude: null,
  last_alert_longitude: null,
};

test("initial broadcast is allowed", () => {
  assert.equal(evaluateBroadcast(activeReport, 14.6, 121, now).allowed, true);
});

test("rebroadcast before cooldown is rejected", () => {
  const report = { ...activeReport, last_nearby_alert_at: "2026-10-05T08:00:00Z", last_alert_latitude: 14.6, last_alert_longitude: 121 };
  assert.equal(evaluateBroadcast(report, 14.7, 121, now).reason, "cooldown");
});

test("rebroadcast after cooldown but under movement threshold is rejected", () => {
  const report = { ...activeReport, last_nearby_alert_at: "2026-10-05T05:00:00Z", last_alert_latitude: 14.6, last_alert_longitude: 121 };
  assert.equal(evaluateBroadcast(report, 14.605, 121, now).reason, "movement_threshold");
});

test("rebroadcast after cooldown and movement threshold is allowed", () => {
  const report = { ...activeReport, last_nearby_alert_at: "2026-10-05T05:00:00Z", last_alert_latitude: 14.6, last_alert_longitude: 121 };
  assert.equal(evaluateBroadcast(report, 14.63, 121, now).allowed, true);
});

test("safe pet cannot broadcast", () => {
  assert.equal(canBroadcastReport({ pet_status: "Safe", case_status: "Active" }), false);
});

test("recovered report cannot broadcast", () => {
  assert.equal(canBroadcastReport({ pet_status: "Missing", case_status: "Recovered" }), false);
});

test("finder no-location cannot broadcast", () => {
  assert.equal(evaluateBroadcast(activeReport, null, null, now).allowed, false);
});

test("duplicate device tokens are deduplicated without changing logical recipients", () => {
  const tokens = distinctPushTokens([
    { user_id: 2, expo_push_token: "ExpoPushToken[one]" },
    { user_id: 2, expo_push_token: "ExpoPushToken[one]" },
    { user_id: 2, expo_push_token: "ExpoPushToken[two]" },
  ]);
  assert.equal(tokens.length, 2);
});
