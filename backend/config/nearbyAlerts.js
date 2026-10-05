function positiveNumberFromEnvironment(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

module.exports = Object.freeze({
  radiusKm: positiveNumberFromEnvironment("NEARBY_LOST_PET_RADIUS_KM", 10),
  cooldownHours: positiveNumberFromEnvironment(
    "NEARBY_LOST_PET_ALERT_COOLDOWN_HOURS",
    6
  ),
  rebroadcastMinDistanceKm: positiveNumberFromEnvironment(
    "NEARBY_LOST_PET_REBROADCAST_MIN_DISTANCE_KM",
    2
  ),
  locationMaxAgeDays: positiveNumberFromEnvironment(
    "NEARBY_ALERT_LOCATION_MAX_AGE_DAYS",
    30
  ),
});
