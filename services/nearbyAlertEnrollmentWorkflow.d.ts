export type EnrollmentCoordinates = {
  latitude: number;
  longitude: number;
};

export function executeNearbyAlertEnrollment(dependencies: {
  requestConsent: () => Promise<boolean>;
  requestForegroundPermission: () => Promise<boolean>;
  getCurrentPosition: () => Promise<EnrollmentCoordinates>;
  savePreference: (coordinates: EnrollmentCoordinates) => Promise<void>;
}): Promise<{ status: "not_now" | "permission_denied" | "enrolled" }>;
