import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import {
  API_URL,
  getImageUrl,
} from "../../config/api";





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
  }>();

  const petId = params.petId;

  const [pet, setPet] =
    useState<Pet | null>(null);

  const [status, setStatus] =
    useState<AuthorizationStatus>(
      normalizeStatus(
        params.authorizationStatus
      )
    );

  const [loading, setLoading] =
    useState(true);

  const [requesting, setRequesting] =
    useState(false);





  const loadPet = useCallback(async () => {
    if (!petId) {
      setLoading(false);

      Alert.alert(
        "Pet Error",
        "No pet was selected.",
        [
          {
            text: "OK",
            onPress: () =>
              router.back(),
          },
        ]
      );

      return;
    }

    try {
      setLoading(true);

      const token =
        await AsyncStorage.getItem(
          "token"
        );

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");

        return;
      }

      const response = await fetch(
        `${API_URL}/authorizations/check/${petId}`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const text =
        await response.text();

      let data: any = {};

      try {
        data = text
          ? JSON.parse(text)
          : {};
      } catch {
        data = {
          message: text,
        };
      }

      console.log(
        "CLINIC PET STATUS:",
        response.status
      );

      console.log(
        "CLINIC PET RESPONSE:",
        data
      );

      if (!response.ok) {
        Alert.alert(
          "Unable to Load Pet",
          data.message ||
            "Unable to load pet information."
        );

        return;
      }

      setPet(data.pet);

      setStatus(
        normalizeStatus(
          data.status
        )
      );
    } catch (error) {
      console.log(
        "CLINIC PET ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    } finally {
      setLoading(false);
    }
  }, [petId]);


  useFocusEffect(
    useCallback(() => {
      loadPet();

      return () => {};
    }, [loadPet])
  );


  const requestAccess = async () => {
    if (!petId || requesting) {
      return;
    }

    try {
      setRequesting(true);

      const token =
        await AsyncStorage.getItem(
          "token"
        );

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");

        return;
      }

      const response = await fetch(
        `${API_URL}/authorizations/request/${petId}`,
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const text =
        await response.text();

      let data: any = {};

      try {
        data = text
          ? JSON.parse(text)
          : {};
      } catch {
        data = {
          message: text,
        };
      }

      console.log(
        "REQUEST ACCESS STATUS:",
        response.status
      );

      console.log(
        "REQUEST ACCESS RESPONSE:",
        data
      );

      if (
        response.status === 409 &&
        data.status
      ) {
        setStatus(
          normalizeStatus(
            data.status
          )
        );

        Alert.alert(
          "Clinic Access",
          data.message ||
            "Authorization already exists."
        );

        return;
      }

      if (!response.ok) {
        Alert.alert(
          "Request Failed",
          data.message ||
            "Unable to request access."
        );

        return;
      }

      setStatus("Pending");

      Alert.alert(
        "Request Sent",
        "The pet owner must approve your clinic before veterinary records can be accessed."
      );
    } catch (error) {
      console.log(
        "REQUEST ACCESS ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to send the authorization request."
      );
    } finally {
      setRequesting(false);
    }
  };


  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <Header />

        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text
            style={styles.loadingText}
          >
            Checking clinic access...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  if (!pet) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <Header />

        <View style={styles.center}>
          <Ionicons
            name="paw-outline"
            size={65}
            color="#92A097"
          />

          <Text
            style={styles.errorTitle}
          >
            Pet unavailable
          </Text>

          <Text
            style={styles.errorText}
          >
            Unable to load this pet.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
            onPress={loadPet}
          >
            <Text
              style={styles.retryText}
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }


  const photoUrl =
    getImageUrl(pet.photo_url);

  const petCode =
    `PET-${String(
      pet.pet_id
    ).padStart(4, "0")}`;

  const approved =
    status === "Approved";

  const pending =
    status === "Pending";

  const canRequest =
    status === "None" ||
    status === "Declined" ||
    status === "Revoked";


  return (
    <SafeAreaView
      style={styles.container}
    >
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >

        <View
          style={styles.petCard}
        >
          <View
            style={
              styles.photoContainer
            }
          >
            {photoUrl ? (
              <Image
                source={{
                  uri: photoUrl,
                }}
                style={styles.petPhoto}
                resizeMode="cover"
              />
            ) : (
              <View
                style={
                  styles.photoPlaceholder
                }
              >
                <Ionicons
                  name="paw"
                  size={40}
                  color="#7DA28A"
                />
              </View>
            )}
          </View>

          <Text
            style={styles.petName}
          >
            {pet.pet_name}
          </Text>

          <Text
            style={styles.petBreed}
          >
            {pet.breed ||
              pet.species}
          </Text>

          <Text
            style={styles.petCode}
          >
            {petCode}
          </Text>

          <View
            style={[
              styles.petStatus,

              pet.pet_status ===
                "Missing" &&
                styles.petMissing,

              pet.pet_status ===
                "Found" &&
                styles.petFound,
            ]}
          >
            <View
              style={[
                styles.petStatusDot,

                pet.pet_status ===
                  "Missing" &&
                  styles.petMissingDot,

                pet.pet_status ===
                  "Found" &&
                  styles.petFoundDot,
              ]}
            />

            <Text
              style={[
                styles.petStatusText,

                pet.pet_status ===
                  "Missing" &&
                  styles.petMissingText,

                pet.pet_status ===
                  "Found" &&
                  styles.petFoundText,
              ]}
            >
              {pet.pet_status}
            </Text>
          </View>
        </View>


        <Text
          style={styles.sectionTitle}
        >
          Clinic Access
        </Text>

        <AuthorizationCard
          status={status}
        />


        {canRequest && (
          <View
            style={styles.requestCard}
          >
            <View
              style={
                styles.requestIcon
              }
            >
              <Ionicons
                name="shield-outline"
                size={29}
                color="#176B3A"
              />
            </View>

            <Text
              style={
                styles.requestTitle
              }
            >
              Owner Authorization
              Required
            </Text>

            <Text
              style={
                styles.requestDescription
              }
            >
              The pet owner must
              approve this clinic
              before veterinary
              records can be viewed
              or updated.
            </Text>

            {(status ===
              "Declined" ||
              status ===
                "Revoked") && (
              <View
                style={
                  styles.previousStatus
                }
              >
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color="#8A6B22"
                />

                <Text
                  style={
                    styles.previousStatusText
                  }
                >
                  Previous access was{" "}
                  {status.toLowerCase()}.
                  You may send a new
                  request to the owner.
                </Text>
              </View>
            )}

            <Pressable
              disabled={requesting}
              style={({
                pressed,
              }) => [
                styles.requestButton,

                pressed &&
                  !requesting &&
                  styles.pressed,

                requesting &&
                  styles.disabledButton,
              ]}
              onPress={requestAccess}
            >
              {requesting ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane-outline"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.requestButtonText
                    }
                  >
                    {status ===
                      "None"
                      ? "Request Access"
                      : "Request Access Again"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}


        {pending && (
          <View
            style={styles.pendingCard}
          >
            <View
              style={
                styles.pendingIcon
              }
            >
              <Ionicons
                name="time-outline"
                size={31}
                color="#98701C"
              />
            </View>

            <Text
              style={
                styles.pendingTitle
              }
            >
              Waiting for Owner
            </Text>

            <Text
              style={
                styles.pendingDescription
              }
            >
              Your clinic access
              request has been sent.
              Veterinary records will
              remain locked until the
              pet owner approves the
              request.
            </Text>

            <Pressable
              style={({
                pressed,
              }) => [
                styles.refreshButton,

                pressed &&
                  styles.pressed,
              ]}
              onPress={loadPet}
            >
              <Ionicons
                name="refresh"
                size={17}
                color="#176B3A"
              />

              <Text
                style={
                  styles.refreshText
                }
              >
                Check Status
              </Text>
            </Pressable>
          </View>
        )}


        {approved && (
          <>
            <View
              style={
                styles.approvedMessage
              }
            >
              <Ionicons
                name="shield-checkmark"
                size={22}
                color="#176B3A"
              />

              <Text
                style={
                  styles.approvedMessageText
                }
              >
                Owner authorization
                confirmed. Veterinary
                features are unlocked.
              </Text>
            </View>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Veterinary Management
            </Text>

            <View
              style={
                styles.actionCard
              }
            >
              <ClinicAction
                icon="document-text-outline"
                title="Veterinary Records"
                description="View the pet's authorized veterinary history."
                onPress={() =>
                  router.push({
                    pathname:
                      "/clinic-vet-records",
                    params: {
                      petId:
                        String(
                          pet.pet_id
                        ),
                    },
                  })
                }
              />

              <View
                style={
                  styles.divider
                }
              />

              <ClinicAction
                icon="add-circle-outline"
                title="Add Veterinary Record"
                description="Record a new visit, vaccination, treatment, or service."
                onPress={() =>
                  router.push({
                    pathname:
                      "/add-vet-record",
                    params: {
                      petId:
                        String(
                          pet.pet_id
                        ),
                    },
                  })
                }
              />
            </View>
          </>
        )}


        <Text
          style={styles.sectionTitle}
        >
          Pet Information
        </Text>

        <View
          style={styles.infoCard}
        >
          <InfoRow
            label="Species"
            value={pet.species}
          />

          <InfoRow
            label="Breed"
            value={
              pet.breed ||
              "Not specified"
            }
          />

          <InfoRow
            label="Sex"
            value={pet.sex}
          />

          <InfoRow
            label="Color"
            value={
              pet.color ||
              "Not specified"
            }
            last
          />
        </View>

        {pet.identifying_marks && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Identifying Marks
            </Text>

            <View
              style={
                styles.marksCard
              }
            >
              <Ionicons
                name="paw-outline"
                size={20}
                color="#176B3A"
              />

              <Text
                style={
                  styles.marksText
                }
              >
                {
                  pet.identifying_marks
                }
              </Text>
            </View>
          </>
        )}


        <Pressable
          style={({
            pressed,
          }) => [
            styles.scanAnotherButton,

            pressed &&
              styles.pressed,
          ]}
          onPress={() =>
            router.replace(
              "/qr-scanner"
            )
          }
        >
          <Ionicons
            name="scan-outline"
            size={19}
            color="#176B3A"
          />

          <Text
            style={
              styles.scanAnotherText
            }
          >
            Scan Another Pet
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}


function normalizeStatus(
  value?: string
): AuthorizationStatus {
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
        onPress={() =>
          router.back()
        }
      >
        <Ionicons
          name="chevron-back"
          size={27}
          color="#173D2A"
        />
      </Pressable>

      <Text
        style={styles.headerTitle}
      >
        Clinic Pet
      </Text>

      <View
        style={styles.headerButton}
      />
    </View>
  );
}


function AuthorizationCard({
  status,
}: {
  status: AuthorizationStatus;
}) {
  let icon:
    keyof typeof Ionicons.glyphMap =
    "lock-closed";

  let title =
    "Not Authorized";

  let description =
    "This clinic does not currently have access to this pet's veterinary records.";

  let boxStyle =
    styles.noneAuthorization;

  let iconStyle =
    styles.noneAuthorizationIcon;

  let titleStyle =
    styles.noneAuthorizationTitle;

  if (status === "Pending") {
    icon = "time";

    title =
      "Approval Pending";

    description =
      "An access request has been sent to the pet owner.";

    boxStyle =
      styles.pendingAuthorization;

    iconStyle =
      styles.pendingAuthorizationIcon;

    titleStyle =
      styles.pendingAuthorizationTitle;
  }

  if (status === "Approved") {
    icon =
      "shield-checkmark";

    title =
      "Clinic Authorized";

    description =
      "The pet owner has approved this clinic to manage veterinary records.";

    boxStyle =
      styles.approvedAuthorization;

    iconStyle =
      styles.approvedAuthorizationIcon;

    titleStyle =
      styles.approvedAuthorizationTitle;
  }

  if (status === "Declined") {
    icon =
      "close-circle";

    title =
      "Request Declined";

    description =
      "The pet owner declined the previous clinic access request.";

    boxStyle =
      styles.declinedAuthorization;

    iconStyle =
      styles.declinedAuthorizationIcon;

    titleStyle =
      styles.declinedAuthorizationTitle;
  }

  if (status === "Revoked") {
    icon =
      "remove-circle";

    title =
      "Access Revoked";

    description =
      "The pet owner has removed this clinic's previous access.";

    boxStyle =
      styles.declinedAuthorization;

    iconStyle =
      styles.declinedAuthorizationIcon;

    titleStyle =
      styles.declinedAuthorizationTitle;
  }

  return (
    <View
      style={[
        styles.authorizationCard,
        boxStyle,
      ]}
    >
      <View
        style={[
          styles.authorizationIcon,
          iconStyle,
        ]}
      >
        <Ionicons
          name={icon}
          size={25}
          color="#FFFFFF"
        />
      </View>

      <View
        style={
          styles.authorizationContent
        }
      >
        <Text
          style={[
            styles.authorizationTitle,
            titleStyle,
          ]}
        >
          {title}
        </Text>

        <Text
          style={
            styles.authorizationDescription
          }
        >
          {description}
        </Text>
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
  icon:
    keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionRow,

        pressed &&
          styles.actionPressed,
      ]}
      onPress={onPress}
    >
      <View
        style={styles.actionIcon}
      >
        <Ionicons
          name={icon}
          size={24}
          color="#176B3A"
        />
      </View>

      <View
        style={styles.actionContent}
      >
        <Text
          style={styles.actionTitle}
        >
          {title}
        </Text>

        <Text
          style={
            styles.actionDescription
          }
        >
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="#9AA49E"
      />
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
    <View
      style={[
        styles.infoRow,

        last &&
          styles.infoRowLast,
      ]}
    >
      <Text
        style={styles.infoLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.infoValue}
      >
        {value}
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,

    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",

    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EE",
  },

  headerButton: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1E2D24",
  },

  content: {
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
    fontSize: 12,
    color: "#77847C",
  },

  errorTitle: {
    marginTop: 14,
    fontSize: 19,
    fontWeight: "800",
    color: "#26352B",
  },

  errorText: {
    marginTop: 5,
    fontSize: 12,
    color: "#7A867F",
  },

  retryButton: {
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#176B3A",
    alignItems: "center",
    justifyContent: "center",
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },


  petCard: {
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E1E8E3",

    borderRadius: 22,

    padding: 22,

    alignItems: "center",
  },

  photoContainer: {
    width: 112,
    height: 112,

    borderRadius: 56,

    overflow: "hidden",

    backgroundColor: "#E8F2E9",

    borderWidth: 4,
    borderColor: "#EEF6EF",
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

    fontSize: 23,
    fontWeight: "900",

    color: "#26352B",
  },

  petBreed: {
    marginTop: 3,

    fontSize: 12,

    color: "#7A867F",
  },

  petCode: {
    marginTop: 5,

    fontSize: 10,
    fontWeight: "700",

    color: "#176B3A",
  },

  petStatus: {
    marginTop: 10,

    paddingHorizontal: 11,
    paddingVertical: 6,

    borderRadius: 20,

    flexDirection: "row",
    alignItems: "center",

    gap: 5,

    backgroundColor: "#E6F3E8",
  },

  petStatusDot: {
    width: 6,
    height: 6,

    borderRadius: 3,

    backgroundColor: "#267542",
  },

  petStatusText: {
    fontSize: 9,
    fontWeight: "800",

    color: "#267542",
  },

  petMissing: {
    backgroundColor: "#FDE7E4",
  },

  petMissingDot: {
    backgroundColor: "#B64236",
  },

  petMissingText: {
    color: "#B64236",
  },

  petFound: {
    backgroundColor: "#FFF1CF",
  },

  petFoundDot: {
    backgroundColor: "#8C6A16",
  },

  petFoundText: {
    color: "#8C6A16",
  },


  sectionTitle: {
    marginTop: 25,
    marginBottom: 11,

    fontSize: 17,
    fontWeight: "800",

    color: "#26352B",
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
    fontSize: 13,
    fontWeight: "900",
  },

  authorizationDescription: {
    marginTop: 3,

    fontSize: 10,
    lineHeight: 15,

    color: "#66746B",
  },

  noneAuthorization: {
    backgroundColor: "#F2F4F2",
  },

  noneAuthorizationIcon: {
    backgroundColor: "#78857D",
  },

  noneAuthorizationTitle: {
    color: "#4D5C53",
  },

  pendingAuthorization: {
    backgroundColor: "#FFF6DC",
  },

  pendingAuthorizationIcon: {
    backgroundColor: "#A47A1E",
  },

  pendingAuthorizationTitle: {
    color: "#7E601B",
  },

  approvedAuthorization: {
    backgroundColor: "#E9F5EB",
  },

  approvedAuthorizationIcon: {
    backgroundColor: "#176B3A",
  },

  approvedAuthorizationTitle: {
    color: "#176B3A",
  },

  declinedAuthorization: {
    backgroundColor: "#FDEAE7",
  },

  declinedAuthorizationIcon: {
    backgroundColor: "#B94C40",
  },

  declinedAuthorizationTitle: {
    color: "#A23E34",
  },


  requestCard: {
    marginTop: 16,

    padding: 20,

    borderRadius: 19,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E1E8E3",

    alignItems: "center",
  },

  requestIcon: {
    width: 58,
    height: 58,

    borderRadius: 19,

    backgroundColor: "#EAF4EB",

    alignItems: "center",
    justifyContent: "center",
  },

  requestTitle: {
    marginTop: 12,

    fontSize: 16,
    fontWeight: "900",

    color: "#26352B",
  },

  requestDescription: {
    marginTop: 6,

    maxWidth: 300,

    fontSize: 11,
    lineHeight: 17,

    textAlign: "center",

    color: "#748078",
  },

  previousStatus: {
    marginTop: 14,

    width: "100%",

    padding: 11,

    borderRadius: 12,

    backgroundColor: "#FFF7DB",

    flexDirection: "row",

    gap: 7,
  },

  previousStatusText: {
    flex: 1,

    fontSize: 10,
    lineHeight: 15,

    color: "#756126",
  },

  requestButton: {
    marginTop: 18,

    width: "100%",
    height: 51,

    borderRadius: 14,

    backgroundColor: "#176B3A",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,
  },

  requestButtonText: {
    color: "#FFFFFF",

    fontSize: 13,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },


  pendingCard: {
    marginTop: 16,

    padding: 21,

    borderRadius: 19,

    backgroundColor: "#FFF9E8",

    borderWidth: 1,
    borderColor: "#F1E4B9",

    alignItems: "center",
  },

  pendingIcon: {
    width: 58,
    height: 58,

    borderRadius: 19,

    backgroundColor: "#FFF0C4",

    alignItems: "center",
    justifyContent: "center",
  },

  pendingTitle: {
    marginTop: 11,

    fontSize: 16,
    fontWeight: "900",

    color: "#6F571E",
  },

  pendingDescription: {
    marginTop: 6,

    maxWidth: 300,

    fontSize: 11,
    lineHeight: 17,

    textAlign: "center",

    color: "#786A45",
  },

  refreshButton: {
    marginTop: 16,

    paddingHorizontal: 17,
    paddingVertical: 10,

    borderRadius: 12,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#DDE6DF",

    flexDirection: "row",
    alignItems: "center",

    gap: 7,
  },

  refreshText: {
    fontSize: 11,
    fontWeight: "800",

    color: "#176B3A",
  },


  approvedMessage: {
    marginTop: 16,

    padding: 14,

    borderRadius: 15,

    backgroundColor: "#EAF4EB",

    flexDirection: "row",
    alignItems: "center",

    gap: 10,
  },

  approvedMessageText: {
    flex: 1,

    fontSize: 10,
    lineHeight: 16,

    color: "#476151",
  },

  actionCard: {
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E1E8E3",

    borderRadius: 17,

    overflow: "hidden",
  },

  actionRow: {
    padding: 14,

    flexDirection: "row",
    alignItems: "center",
  },

  actionPressed: {
    backgroundColor: "#F4F8F5",
  },

  actionIcon: {
    width: 45,
    height: 45,

    borderRadius: 14,

    backgroundColor: "#EAF4EB",

    alignItems: "center",
    justifyContent: "center",
  },

  actionContent: {
    flex: 1,

    marginLeft: 11,
    marginRight: 8,
  },

  actionTitle: {
    fontSize: 12,
    fontWeight: "800",

    color: "#31453A",
  },

  actionDescription: {
    marginTop: 3,

    fontSize: 9,
    lineHeight: 14,

    color: "#7B877F",
  },

  divider: {
    height: 1,

    backgroundColor: "#EDF1EE",

    marginLeft: 70,
  },


  infoCard: {
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E1E8E3",

    borderRadius: 17,

    paddingHorizontal: 15,
  },

  infoRow: {
    minHeight: 51,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    borderBottomWidth: 1,
    borderBottomColor: "#EEF1EF",
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  infoLabel: {
    fontSize: 11,

    color: "#7A867F",
  },

  infoValue: {
    maxWidth: "60%",

    fontSize: 11,
    fontWeight: "700",

    textAlign: "right",

    color: "#31453A",
  },

  marksCard: {
    padding: 15,

    borderRadius: 16,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E1E8E3",

    flexDirection: "row",
    alignItems: "flex-start",

    gap: 10,
  },

  marksText: {
    flex: 1,

    fontSize: 11,
    lineHeight: 17,

    color: "#5E6D64",
  },


  scanAnotherButton: {
    marginTop: 28,

    height: 51,

    borderRadius: 14,

    borderWidth: 1,
    borderColor: "#BFD4C5",

    backgroundColor: "#FFFFFF",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,
  },

  scanAnotherText: {
    fontSize: 12,
    fontWeight: "800",

    color: "#176B3A",
  },

  pressed: {
    opacity: 0.75,
  },
});
