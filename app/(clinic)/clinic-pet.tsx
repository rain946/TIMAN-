import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { timanShadow } from "../../components/timan/theme";

import { API_URL, getImageUrl } from "../../config/api";

type AuthorizationStatus =
  | "None"
  | "Pending"
  | "Approved"
  | "Declined"
  | "Revoked";

type Pet = {
  pet_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  sex: string;
  color: string | null;
  identifying_marks: string | null;
  photo_url: string | null;
  pet_status: "Safe" | "Missing" | "Found";
};

export default function ClinicPetScreen() {
  const params = useLocalSearchParams<{
    petId?: string;
    authorizationStatus?: string;
    scanAccessToken?: string;
  }>();

  const petId = params.petId;
  const hasScanAccess = Boolean(params.scanAccessToken);

  const [pet, setPet] = useState<Pet | null>(null);

  const [status, setStatus] = useState<AuthorizationStatus>(
    normalizeStatus(params.authorizationStatus),
  );

  const [hasRecord, setHasRecord] = useState(false);

  const [loading, setLoading] = useState(true);

  const [requesting, setRequesting] = useState(false);

  const loadPet = useCallback(async () => {
    if (!petId) {
      setLoading(false);

      Alert.alert("Pet Error", "No pet was selected.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);

      return;
    }

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");

        return;
      }

      const response = await fetch(`${API_URL}/authorizations/check/${petId}`, {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },
      });

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          message: text,
        };
      }

      console.log("CLINIC PET STATUS:", response.status);

      console.log("CLINIC PET RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Load Pet",
          data.message || "Unable to load pet information.",
        );

        return;
      }

      setPet(data.pet);

      setStatus(normalizeStatus(data.status));

      setHasRecord(Boolean(data.hasRecord));
    } catch (error) {
      console.log("CLINIC PET ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useFocusEffect(
    useCallback(() => {
      loadPet();

      return () => {};
    }, [loadPet]),
  );

  const requestAccess = async () => {
    if (!petId || requesting) {
      return;
    }

    try {
      setRequesting(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");

        return;
      }

      const response = await fetch(
        `${API_URL}/authorizations/request/${petId}`,
        {
          method: "POST",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          message: text,
        };
      }

      console.log("REQUEST ACCESS STATUS:", response.status);

      console.log("REQUEST ACCESS RESPONSE:", data);

      if (response.status === 409 && data.status) {
        setStatus(normalizeStatus(data.status));

        Alert.alert(
          "Clinic Access",
          data.message || "Authorization already exists.",
        );

        return;
      }

      if (!response.ok) {
        Alert.alert(
          "Request Failed",
          data.message || "Unable to request access.",
        );

        return;
      }

      setStatus("Pending");

      Alert.alert(
        "Request Sent",
        "The pet owner must approve your clinic before veterinary records can be accessed.",
      );
    } catch (error) {
      console.log("REQUEST ACCESS ERROR:", error);

      Alert.alert(
        "Connection Error",
        "Unable to send the authorization request.",
      );
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Checking clinic access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.center}>
          <Ionicons name="paw-outline" size={65} color="#6B7C73" />

          <Text style={styles.errorTitle}>Pet unavailable</Text>

          <Text style={styles.errorText}>Unable to load this pet.</Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
            onPress={loadPet}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const photoUrl = getImageUrl(pet.photo_url);

  const petCode = `PET-${String(pet.pet_id).padStart(4, "0")}`;

  const approved = status === "Approved";

  const pending = status === "Pending";

  const canRequest =
    status === "None" || status === "Declined" || status === "Revoked";

  return (
    <SafeAreaView style={styles.container}>
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.petCard}>
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image
                source={{
                  uri: photoUrl,
                }}
                style={styles.petPhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="paw" size={40} color="#81C784" />
              </View>
            )}
          </View>

          <Text style={styles.petName}>{pet.pet_name}</Text>

          <Text style={styles.petBreed}>{pet.breed || pet.species}</Text>

          <Text style={styles.petCode}>{petCode}</Text>

          <View
            style={[
              styles.petStatus,

              pet.pet_status === "Missing" && styles.petMissing,

              pet.pet_status === "Found" && styles.petFound,
            ]}
          >
            <View
              style={[
                styles.petStatusDot,

                pet.pet_status === "Missing" && styles.petMissingDot,

                pet.pet_status === "Found" && styles.petFoundDot,
              ]}
            />

            <Text
              style={[
                styles.petStatusText,

                pet.pet_status === "Missing" && styles.petMissingText,

                pet.pet_status === "Found" && styles.petFoundText,
              ]}
            >
              {pet.pet_status}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Clinic Access</Text>

        <AuthorizationCard status={status} />

        {canRequest && (
          <View style={styles.requestCard}>
            <View style={styles.requestIcon}>
              <Ionicons name="shield-outline" size={29} color="#2E7D6B" />
            </View>

            <Text style={styles.requestTitle}>
              Owner Authorization Required
            </Text>

            <Text style={styles.requestDescription}>
              The pet owner must approve this clinic before veterinary records
              can be viewed or updated.
            </Text>

            {(status === "Declined" || status === "Revoked") && (
              <View style={styles.previousStatus}>
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color="#E57373"
                />

                <Text style={styles.previousStatusText}>
                  Previous access was {status.toLowerCase()}. You may send a new
                  request to the owner.
                </Text>
              </View>
            )}

            <Pressable
              disabled={requesting}
              style={({ pressed }) => [
                styles.requestButton,

                pressed && !requesting && styles.pressed,

                requesting && styles.disabledButton,
              ]}
              onPress={requestAccess}
            >
              {requesting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane-outline"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text style={styles.requestButtonText}>
                    {status === "None"
                      ? "Request Access"
                      : "Request Access Again"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {pending && (
          <View style={styles.pendingCard}>
            <View style={styles.pendingIcon}>
              <Ionicons name="time-outline" size={31} color="#E57373" />
            </View>

            <Text style={styles.pendingTitle}>Waiting for Owner</Text>

            <Text style={styles.pendingDescription}>
              Your clinic access request has been sent. Veterinary records will
              remain locked until the pet owner approves the request.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.refreshButton,

                pressed && styles.pressed,
              ]}
              onPress={loadPet}
            >
              <Ionicons name="refresh" size={17} color="#2E7D6B" />

              <Text style={styles.refreshText}>Check Status</Text>
            </Pressable>
          </View>
        )}

        {approved && (
          <>
            <View style={styles.approvedMessage}>
              <Ionicons name="shield-checkmark" size={22} color="#2E7D6B" />

              <Text style={styles.approvedMessageText}>
                {hasRecord
                  ? "Owner authorization confirmed. You can view the pet's history or add another veterinary record."
                  : "Owner authorization confirmed. Veterinary features are unlocked."}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Veterinary Management</Text>

            <View style={styles.actionCard}>
              <ClinicAction
                icon="document-text-outline"
                title="Veterinary Records"
                description="View the pet's authorized veterinary history."
                onPress={() =>
                  router.push({
                    pathname: "/clinic-vet-records",
                    params: {
                      petId: String(pet.pet_id),
                      scanAccessToken: params.scanAccessToken || "",
                    },
                  })
                }
              />

              {hasScanAccess && (
                <>
                  <View style={styles.divider} />

                  <ClinicAction
                    icon="add-circle-outline"
                    title="Add Veterinary Record"
                    description="Record a new visit, vaccination, treatment, or service."
                    onPress={() =>
                      router.push({
                        pathname: "/add-vet-record",
                        params: {
                          petId: String(pet.pet_id),
                          scanAccessToken: params.scanAccessToken || "",
                        },
                      })
                    }
                  />
                </>
              )}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Pet Information</Text>

        <View style={styles.infoCard}>
          <InfoRow label="Species" value={pet.species} />

          <InfoRow label="Breed" value={pet.breed || "Not specified"} />

          <InfoRow label="Sex" value={pet.sex} />

          <InfoRow label="Color" value={pet.color || "Not specified"} last />
        </View>

        {pet.identifying_marks && (
          <>
            <Text style={styles.sectionTitle}>Identifying Marks</Text>

            <View style={styles.marksCard}>
              <Ionicons name="paw-outline" size={20} color="#2E7D6B" />

              <Text style={styles.marksText}>{pet.identifying_marks}</Text>
            </View>
          </>
        )}

        {!hasRecord && <Pressable
          style={({ pressed }) => [
            styles.scanAnotherButton,

            pressed && styles.pressed,
          ]}
          onPress={() => router.replace("/qr-scanner")}
        >
          <Ionicons name="scan-outline" size={19} color="#2E7D6B" />

          <Text style={styles.scanAnotherText}>Scan Another Pet</Text>
        </Pressable>}
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeStatus(value?: string): AuthorizationStatus {
  switch (value) {
    case "Pending":
    case "Approved":
    case "Declined":
    case "Revoked":
      return value;

    default:
      return "None";
  }
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.pressed,
        ]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
      </Pressable>

      <Text style={styles.headerTitle}>Clinic Pet</Text>

      <View style={styles.headerButton} />
    </View>
  );
}

function AuthorizationCard({ status }: { status: AuthorizationStatus }) {
  let icon: keyof typeof Ionicons.glyphMap = "lock-closed";

  let title = "Not Authorized";

  let description =
    "This clinic does not currently have access to this pet's veterinary records.";

  let boxStyle = styles.noneAuthorization;

  let iconStyle = styles.noneAuthorizationIcon;

  let titleStyle = styles.noneAuthorizationTitle;

  if (status === "Pending") {
    icon = "time";

    title = "Approval Pending";

    description = "An access request has been sent to the pet owner.";

    boxStyle = styles.pendingAuthorization;

    iconStyle = styles.pendingAuthorizationIcon;

    titleStyle = styles.pendingAuthorizationTitle;
  }

  if (status === "Approved") {
    icon = "shield-checkmark";

    title = "Clinic Authorized";

    description =
      "The pet owner has approved this clinic to manage veterinary records.";

    boxStyle = styles.approvedAuthorization;

    iconStyle = styles.approvedAuthorizationIcon;

    titleStyle = styles.approvedAuthorizationTitle;
  }

  if (status === "Declined") {
    icon = "close-circle";

    title = "Request Declined";

    description = "The pet owner declined the previous clinic access request.";

    boxStyle = styles.declinedAuthorization;

    iconStyle = styles.declinedAuthorizationIcon;

    titleStyle = styles.declinedAuthorizationTitle;
  }

  if (status === "Revoked") {
    icon = "remove-circle";

    title = "Access Revoked";

    description = "The pet owner has removed this clinic's previous access.";

    boxStyle = styles.declinedAuthorization;

    iconStyle = styles.declinedAuthorizationIcon;

    titleStyle = styles.declinedAuthorizationTitle;
  }

  return (
    <View style={[styles.authorizationCard, boxStyle]}>
      <View style={[styles.authorizationIcon, iconStyle]}>
        <Ionicons name={icon} size={25} color="#FFFFFF" />
      </View>

      <View style={styles.authorizationContent}>
        <Text style={[styles.authorizationTitle, titleStyle]}>{title}</Text>

        <Text style={styles.authorizationDescription}>{description}</Text>
      </View>
    </View>
  );
}

function ClinicAction({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionRow,

        pressed && styles.actionPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={24} color="#2E7D6B" />
      </View>

      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>

        <Text style={styles.actionDescription}>{description}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#6B7C73" />
    </Pressable>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5E9",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },

  headerButton: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#2E3A34",
  },

  content: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 21,
    paddingTop: 22,
    paddingBottom: 45,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7C73",
  },

  errorTitle: {
    marginTop: 14,
    fontSize: 21,
    fontWeight: "800",
    color: "#2E3A34",
  },

  errorText: {
    marginTop: 5,
    fontSize: 14,
    color: "#6B7C73",
  },

  retryButton: {
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  petCard: {
    ...timanShadow,
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    borderRadius: 22,

    padding: 22,

    alignItems: "center",
  },

  photoContainer: {
    width: 112,
    height: 112,

    borderRadius: 56,

    overflow: "hidden",

    backgroundColor: "#CFE8DD",

    borderWidth: 4,
    borderColor: "#CFE8DD",
  },

  petPhoto: {
    width: "100%",
    height: "100%",
  },

  photoPlaceholder: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",
  },

  petName: {
    marginTop: 13,

    fontSize: 25,
    fontWeight: "900",

    color: "#2E3A34",
  },

  petBreed: {
    marginTop: 3,

    fontSize: 14,

    color: "#6B7C73",
  },

  petCode: {
    marginTop: 5,

    fontSize: 12,
    fontWeight: "700",

    color: "#2E7D6B",
  },

  petStatus: {
    marginTop: 10,

    paddingHorizontal: 11,
    paddingVertical: 6,

    borderRadius: 20,

    flexDirection: "row",
    alignItems: "center",

    gap: 5,

    backgroundColor: "#CFE8DD",
  },

  petStatusDot: {
    width: 6,
    height: 6,

    borderRadius: 3,

    backgroundColor: "#56B091",
  },

  petStatusText: {
    fontSize: 11,
    fontWeight: "800",

    color: "#56B091",
  },

  petMissing: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  petMissingDot: {
    backgroundColor: "#E57373",
  },

  petMissingText: {
    color: "#E57373",
  },

  petFound: {
    backgroundColor: "#CFE8DD",
  },

  petFoundDot: {
    backgroundColor: "#81C784",
  },

  petFoundText: {
    color: "#81C784",
  },

  sectionTitle: {
    marginTop: 25,
    marginBottom: 11,

    fontSize: 19,
    fontWeight: "800",

    color: "#2E3A34",
  },

  authorizationCard: {
    padding: 15,

    borderRadius: 17,

    flexDirection: "row",
    alignItems: "center",
  },

  authorizationIcon: {
    width: 47,
    height: 47,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",
  },

  authorizationContent: {
    flex: 1,
    marginLeft: 12,
  },

  authorizationTitle: {
    fontSize: 15,
    fontWeight: "900",
  },

  authorizationDescription: {
    marginTop: 3,

    fontSize: 12,
    lineHeight: 15,

    color: "#6B7C73",
  },

  noneAuthorization: {
    backgroundColor: "#FFF5E9",
  },

  noneAuthorizationIcon: {
    backgroundColor: "#6B7C73",
  },

  noneAuthorizationTitle: {
    color: "#2E3A34",
  },

  pendingAuthorization: {
    backgroundColor: "#FAD7A0",
  },

  pendingAuthorizationIcon: {
    backgroundColor: "#F5A623",
  },

  pendingAuthorizationTitle: {
    color: "#F5A623",
  },

  approvedAuthorization: {
    backgroundColor: "#FFF5E9",
  },

  approvedAuthorizationIcon: {
    backgroundColor: "#81C784",
  },

  approvedAuthorizationTitle: {
    color: "#81C784",
  },

  declinedAuthorization: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  declinedAuthorizationIcon: {
    backgroundColor: "#E57373",
  },

  declinedAuthorizationTitle: {
    color: "#E57373",
  },

  requestCard: {
    marginTop: 16,

    padding: 20,

    borderRadius: 19,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    alignItems: "center",
  },

  requestIcon: {
    width: 58,
    height: 58,

    borderRadius: 19,

    backgroundColor: "#CFE8DD",

    alignItems: "center",
    justifyContent: "center",
  },

  requestTitle: {
    marginTop: 12,

    fontSize: 18,
    fontWeight: "900",

    color: "#2E3A34",
  },

  requestDescription: {
    marginTop: 6,

    maxWidth: 300,

    fontSize: 13,
    lineHeight: 17,

    textAlign: "center",

    color: "#6B7C73",
  },

  previousStatus: {
    marginTop: 14,

    width: "100%",

    padding: 11,

    borderRadius: 12,

    backgroundColor: "#FAD7A0",

    flexDirection: "row",

    gap: 7,
  },

  previousStatusText: {
    flex: 1,

    fontSize: 12,
    lineHeight: 15,

    color: "#E57373",
  },

  requestButton: {
    marginTop: 18,

    width: "100%",
    height: 51,

    borderRadius: 14,

    backgroundColor: "#2E7D6B",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,
  },

  requestButtonText: {
    color: "#FFFFFF",

    fontSize: 15,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },

  pendingCard: {
    marginTop: 16,

    padding: 21,

    borderRadius: 19,

    backgroundColor: "#6B7C73",

    borderWidth: 1,
    borderColor: "#FAD7A0",

    alignItems: "center",
  },

  pendingIcon: {
    width: 58,
    height: 58,

    borderRadius: 19,

    backgroundColor: "#FAD7A0",

    alignItems: "center",
    justifyContent: "center",
  },

  pendingTitle: {
    marginTop: 11,

    fontSize: 18,
    fontWeight: "900",

    color: "#F5A623",
  },

  pendingDescription: {
    marginTop: 6,

    maxWidth: 300,

    fontSize: 13,
    lineHeight: 17,

    textAlign: "center",

    color: "#F5A623",
  },

  refreshButton: {
    marginTop: 16,

    paddingHorizontal: 17,
    paddingVertical: 10,

    borderRadius: 12,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "center",

    gap: 7,
  },

  refreshText: {
    fontSize: 13,
    fontWeight: "800",

    color: "#2E7D6B",
  },

  approvedMessage: {
    marginTop: 16,

    padding: 14,

    borderRadius: 15,

    backgroundColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "center",

    gap: 10,
  },

  approvedMessageText: {
    flex: 1,

    fontSize: 12,
    lineHeight: 16,

    color: "#2E3A34",
  },

  actionCard: {
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    borderRadius: 17,

    overflow: "hidden",
  },

  actionRow: {
    padding: 14,

    flexDirection: "row",
    alignItems: "center",
  },

  actionPressed: {
    backgroundColor: "#FFF5E9",
  },

  actionIcon: {
    width: 45,
    height: 45,

    borderRadius: 14,

    backgroundColor: "#CFE8DD",

    alignItems: "center",
    justifyContent: "center",
  },

  actionContent: {
    flex: 1,

    marginLeft: 11,
    marginRight: 8,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: "800",

    color: "#2E3A34",
  },

  actionDescription: {
    marginTop: 3,

    fontSize: 11,
    lineHeight: 14,

    color: "#6B7C73",
  },

  divider: {
    height: 1,

    backgroundColor: "#CFE8DD",

    marginLeft: 70,
  },

  infoCard: {
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    borderRadius: 17,

    paddingHorizontal: 15,
  },

  infoRow: {
    minHeight: 51,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  infoLabel: {
    fontSize: 13,

    color: "#6B7C73",
  },

  infoValue: {
    maxWidth: "60%",

    fontSize: 13,
    fontWeight: "700",

    textAlign: "right",

    color: "#2E3A34",
  },

  marksCard: {
    padding: 15,

    borderRadius: 16,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "flex-start",

    gap: 10,
  },

  marksText: {
    flex: 1,

    fontSize: 13,
    lineHeight: 17,

    color: "#6B7C73",
  },

  scanAnotherButton: {
    marginTop: 28,

    height: 51,

    borderRadius: 14,

    borderWidth: 1,
    borderColor: "#CFE8DD",

    backgroundColor: "#FFFFFF",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,
  },

  scanAnotherText: {
    fontSize: 14,
    fontWeight: "800",

    color: "#2E7D6B",
  },

  pressed: {
    opacity: 0.75,
  },
});
