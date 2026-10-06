async function executeNearbyAlertEnrollment({
  requestConsent,
  requestForegroundPermission,
  getCurrentPosition,
  savePreference,
}) {
  const allowed = await requestConsent();
  if (!allowed) return { status: "not_now" };

  const permissionGranted = await requestForegroundPermission();
  if (!permissionGranted) return { status: "permission_denied" };

  const coordinates = await getCurrentPosition();
  await savePreference(coordinates);
  return { status: "enrolled" };
}

module.exports = { executeNearbyAlertEnrollment };
