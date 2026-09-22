import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../config/api";

// ========================================
// TYPES
// ========================================

type PetStatus = "Safe" | "Missing" | "Found";

type MissingCondition = "Safe" | "Not Safe";

type Pet = {
  pet_id: number;
  owner_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  sex: string;
  birth_date: string | null;
  color: string | null;
  identifying_marks: string | null;
  photo_url: string | null;
  qr_code: string;
  pet_status: PetStatus;
  created_at: string;
};

// ========================================
// SCREEN
// ========================================

export default function PetProfileScreen() {
  const { petId } = useLocalSearchParams<{
    petId?: string;
  }>();

  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ========================================
  // LOST PET MODAL STATES
  // ========================================

  const [missingModalVisible, setMissingModalVisible] =
    useState(false);

  const [missingCondition, setMissingCondition] =
    useState<MissingCondition>("Safe");

  const [finderMessage, setFinderMessage] = useState("");

  const [reportingMissing, setReportingMissing] =
    useState(false);

  // ========================================
  // GET SERVER BASE URL
  // ========================================

  const SERVER_URL = API_URL.replace(/\/api\/?$/, "");

  // ========================================
  // GET COMPLETE PHOTO URL
  // ========================================

  const getPhotoUrl = (photoUrl: string | null) => {
    if (!photoUrl) {
      return null;
    }

    if (
      photoUrl.startsWith("http://") ||
      photoUrl.startsWith("https://")
    ) {
      return photoUrl;
    }

    return `${SERVER_URL}${photoUrl}`;
  };

  // ========================================
  // LOAD PET
  // ========================================

  const loadPet = useCallback(async () => {
    if (!petId) {
      setLoading(false);

      Alert.alert(
        "Pet Error",
        "No pet was selected.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );

      return;
    }

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/pets/${petId}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      console.log("GET PET STATUS:", response.status);
      console.log("GET PET RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Load Pet",
          data.message ||
            "Pet information could not be loaded."
        );

        return;
      }

      setPet(data.pet);
    } catch (error) {
      console.log("GET PET ERROR:", error);

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    } finally {
      setLoading(false);
    }
  }, [petId]);

  // ========================================
  // REFRESH WHEN SCREEN IS OPENED
  // ========================================

  useFocusEffect(
    useCallback(() => {
      loadPet();

      return () => {};
    }, [loadPet])
  );

  // ========================================
  // FORMAT DATE
  // ========================================

  const formatDate = (value: string | null) => {
    if (!value) {
      return "Not specified";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ========================================
  // SELECT / CHANGE PET PHOTO
  // ========================================

  const choosePetPhoto = async () => {
    if (!pet || uploadingPhoto) {
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow TIMAN to access your photos."
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const selectedImage = result.assets[0];

      if (!selectedImage?.uri) {
        Alert.alert(
          "Photo Error",
          "Unable to read the selected photo."
        );

        return;
      }

      await uploadPetPhoto(
        selectedImage.uri,
        selectedImage.mimeType ?? null,
        selectedImage.fileName ?? null
      );
    } catch (error) {
      console.log("PHOTO PICKER ERROR:", error);

      Alert.alert(
        "Photo Error",
        "Unable to select the pet photo."
      );
    }
  };

  // ========================================
  // UPLOAD PET PHOTO
  // ========================================

  const uploadPetPhoto = async (
    imageUri: string,
    providedMimeType: string | null,
    providedFileName: string | null
  ) => {
    if (!petId) {
      return;
    }

    try {
      setUploadingPhoto(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");
        return;
      }

      const uriWithoutQuery = imageUri.split("?")[0];

      const extensionMatch =
        uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);

      let extension =
        extensionMatch?.[1]?.toLowerCase() || "jpg";

      if (extension === "jpeg") {
        extension = "jpg";
      }

      let mimeType =
        providedMimeType || "image/jpeg";

      if (!providedMimeType) {
        if (extension === "png") {
          mimeType = "image/png";
        } else if (extension === "webp") {
          mimeType = "image/webp";
        } else {
          mimeType = "image/jpeg";
        }
      }

      const fileName =
        providedFileName ||
        `pet-${Date.now()}.${extension}`;

      const formData = new FormData();

      formData.append(
        "photo",
        {
          uri: imageUri,
          name: fileName,
          type: mimeType,
        } as any
      );

      const response = await fetch(
        `${API_URL}/pets/${petId}/photo`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      console.log(
        "UPDATE PHOTO STATUS:",
        response.status
      );

      console.log(
        "UPDATE PHOTO RESPONSE:",
        data
      );

      if (!response.ok) {
        Alert.alert(
          "Unable to Update Photo",
          data.message || "Please try again."
        );

        return;
      }

      setPet((currentPet) => {
        if (!currentPet) {
          return currentPet;
        }

        return {
          ...currentPet,
          photo_url: data.photoUrl,
        };
      });

      Alert.alert(
        "Photo Updated",
        `${pet?.pet_name || "Pet"}'s photo has been updated.`
      );

      await loadPet();
    } catch (error) {
      console.log(
        "UPLOAD PET PHOTO ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to upload the pet photo."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ========================================
  // OPEN MARK AS MISSING MODAL
  // ========================================

  const markAsMissing = () => {
    if (!pet) {
      return;
    }

    setMissingCondition("Safe");
    setFinderMessage("");
    setMissingModalVisible(true);
  };

  // ========================================
  // CLOSE MARK AS MISSING MODAL
  // ========================================

  const closeMissingModal = () => {
    if (reportingMissing) {
      return;
    }

    setMissingModalVisible(false);
    setMissingCondition("Safe");
    setFinderMessage("");
  };

  // ========================================
  // SUBMIT MISSING REPORT
  // ========================================

  const submitMissingReport = async () => {
    if (
      !pet ||
      !petId ||
      reportingMissing
    ) {
      return;
    }

    const cleanMessage = finderMessage.trim();

    if (!cleanMessage) {
      Alert.alert(
        "Message Required",
        "Please enter a message for anyone who scans your pet's QR code."
      );

      return;
    }

    try {
      setReportingMissing(true);

      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/lost-pets/${petId}/missing`,
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            currentCondition: missingCondition,
            ownerMessage: cleanMessage,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "REPORT MISSING STATUS:",
        response.status
      );

      console.log(
        "REPORT MISSING RESPONSE:",
        data
      );

      if (!response.ok) {
        Alert.alert(
          "Unable to Report Pet",
          data.message || "Please try again."
        );

        return;
      }

      setMissingModalVisible(false);
      setMissingCondition("Safe");
      setFinderMessage("");

      await loadPet();

      Alert.alert(
        "Pet Marked as Missing",
        `${pet.pet_name} is now marked as missing.`
      );
    } catch (error) {
      console.log(
        "REPORT MISSING ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    } finally {
      setReportingMissing(false);
    }
  };

  // ========================================
  // OPEN MORE DETAILS
  // ========================================

  const openMissingDetails = () => {
    if (!pet) {
      return;
    }

    router.push({
      pathname: "/lost-pet",
      params: {
        petId: pet.pet_id.toString(),
      },
    });
  };

  // ========================================
  // I SAW THE PET
  // ========================================

  const sawThePet = () => {
    if (!pet) {
      return;
    }

    Alert.alert(
      "I Saw the Pet",
      `Are you sure ${pet.pet_name} is already back with you?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: recoverPet,
        },
      ]
    );
  };

  // ========================================
  // RECOVER PET
  // ========================================

  const recoverPet = async () => {
    if (!pet || !petId) {
      return;
    }

    try {
      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/lost-pets/${petId}/recovered`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      console.log(
        "RECOVER PET STATUS:",
        response.status
      );

      console.log(
        "RECOVER PET RESPONSE:",
        data
      );

      if (!response.ok) {
        Alert.alert(
          "Unable to Update Pet",
          data.message || "Please try again."
        );

        return;
      }

      await loadPet();

      Alert.alert(
        "Pet is Safe",
        `${pet.pet_name} has been marked as safe.`
      );
    } catch (error) {
      console.log(
        "RECOVER PET ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    }
  };

  // ========================================
  // LOADING SCREEN
  // ========================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={27}
              color="#173D2A"
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Pet Profile
          </Text>

          <View style={styles.headerButton} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text style={styles.loadingText}>
            Loading pet profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // PET NOT FOUND
  // ========================================

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={27}
              color="#173D2A"
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Pet Profile
          </Text>

          <View style={styles.headerButton} />
        </View>

        <View style={styles.loadingContainer}>
          <Ionicons
            name="paw-outline"
            size={55}
            color="#7EA48A"
          />

          <Text style={styles.loadingText}>
            Pet information unavailable.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // PET VALUES
  // ========================================

  const photoSource =
    getPhotoUrl(pet.photo_url);

  const isMissing =
    pet.pet_status === "Missing";

  const isFound =
    pet.pet_status === "Found";

  const displayPetId =
    `PET-${String(pet.pet_id).padStart(4, "0")}`;

  // ========================================
  // STATUS COLORS
  // ========================================

  const getStatusBackground = () => {
    if (isMissing) {
      return "#FFF0F0";
    }

    if (isFound) {
      return "#FFF5DC";
    }

    return "#E5F4E8";
  };

  const getStatusColor = () => {
    if (isMissing) {
      return "#B54545";
    }

    if (isFound) {
      return "#A36C18";
    }

    return "#267542";
  };

  // ========================================
  // UI
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          disabled={uploadingPhoto}
        >
          <Ionicons
            name="chevron-back"
            size={27}
            color="#173D2A"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Pet Profile
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* PET PHOTO */}

        <View style={styles.profileSection}>
          <Pressable
            onPress={choosePetPhoto}
            disabled={uploadingPhoto}
            style={({ pressed }) => [
              styles.imageContainer,
              pressed && styles.pressed,
            ]}
          >
            {photoSource ? (
              <Image
                source={{
                  uri: photoSource,
                }}
                style={styles.petImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons
                  name="paw"
                  size={55}
                  color="#7EA48A"
                />
              </View>
            )}

            {uploadingPhoto && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator
                  size="large"
                  color="#FFFFFF"
                />
              </View>
            )}

            {!uploadingPhoto && (
              <View style={styles.cameraButton}>
                <Ionicons
                  name="camera"
                  size={19}
                  color="#FFFFFF"
                />
              </View>
            )}
          </Pressable>

          <Text style={styles.petName}>
            {pet.pet_name}
          </Text>

          <Text style={styles.petBreed}>
            {pet.breed || "Breed not specified"} •{" "}
            {pet.sex}
          </Text>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  getStatusBackground(),
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    getStatusColor(),
                },
              ]}
            />

            <Text
              style={[
                styles.statusText,
                {
                  color: getStatusColor(),
                },
              ]}
            >
              {pet.pet_status.toUpperCase()}
            </Text>
          </View>

          <Pressable
            onPress={choosePetPhoto}
            disabled={uploadingPhoto}
          >
            <Text style={styles.changePhotoText}>
              {uploadingPhoto
                ? "Uploading photo..."
                : pet.photo_url
                  ? "Change Pet Photo"
                  : "Add Pet Photo"}
            </Text>
          </Pressable>
        </View>

        {/* QUICK ACTIONS */}

        <View style={styles.actionRow}>
          <ActionButton
            icon="qr-code-outline"
            title="QR Code"
            onPress={() =>
              router.push({
                pathname: "/pet-qr",
                params: {
                  petId:
                    pet.pet_id.toString(),
                },
              })
            }
          />

          <ActionButton
            icon="medical-outline"
            title="Records"
            onPress={() =>
              router.push({
                pathname: "/vet-records",
                params: {
                  petId:
                    pet.pet_id.toString(),
                },
              })
            }
          />

          <ActionButton
            icon="calendar-outline"
            title="Schedule"
            onPress={() =>
              router.push({
                pathname: "/schedules",
                params: {
                  petId:
                    pet.pet_id.toString(),
                },
              })
            }
          />
        </View>

        {/* BASIC INFORMATION */}

        <Text style={styles.sectionTitle}>
          Basic Information
        </Text>

        <View style={styles.infoCard}>
          <InfoRow
            icon="barcode-outline"
            label="Pet ID"
            value={displayPetId}
          />

          <Divider />

          <InfoRow
            icon="paw-outline"
            label="Species"
            value={pet.species}
          />

          <Divider />

          <InfoRow
            icon="information-circle-outline"
            label="Breed"
            value={
              pet.breed || "Not specified"
            }
          />

          <Divider />

          <InfoRow
            icon={
              pet.sex === "Female"
                ? "female-outline"
                : "male-outline"
            }
            label="Sex"
            value={pet.sex}
          />

          <Divider />

          <InfoRow
            icon="calendar-outline"
            label="Birth Date"
            value={formatDate(pet.birth_date)}
          />

          <Divider />

          <InfoRow
            icon="color-palette-outline"
            label="Color"
            value={
              pet.color || "Not specified"
            }
          />
        </View>

        {/* IDENTIFYING MARKS */}

        <Text style={styles.sectionTitle}>
          Identifying Marks
        </Text>

        <View style={styles.descriptionCard}>
          <Ionicons
            name="eye-outline"
            size={22}
            color="#176B3A"
          />

          <Text style={styles.descriptionText}>
            {pet.identifying_marks ||
              "No identifying marks recorded."}
          </Text>
        </View>


        {/*PET SAFETY */}

        <Text style={styles.sectionTitle}>
          Pet Safety
        </Text>

        <View
          style={[
            styles.safetyCard,
            isMissing &&
              styles.missingSafetyCard,
          ]}
        >
          <View style={styles.safetyTop}>
            <View style={styles.safetyIcon}>
              <Ionicons
                name={
                  isMissing
                    ? "alert-circle-outline"
                    : "shield-checkmark-outline"
                }
                size={25}
                color={
                  isMissing
                    ? "#C34539"
                    : "#176B3A"
                }
              />
            </View>

            <View
              style={
                styles.safetyTextContainer
              }
            >
              <Text style={styles.safetyTitle}>
                {isMissing
                  ? `${pet.pet_name} is Missing`
                  : `${pet.pet_name} is currently ${pet.pet_status.toLowerCase()}`}
              </Text>

              <Text
                style={
                  styles.safetyDescription
                }
              >
                {isMissing
                  ? "The TIMAN QR profile will show that this pet is currently missing."
                  : "If your pet goes missing, mark the pet as missing so anyone who scans the QR can contact you."}
              </Text>
            </View>
          </View>

          {/* SAFE PET */}

          {!isMissing && (
            <Pressable
              style={({ pressed }) => [
                styles.missingButton,
                pressed && styles.pressed,
              ]}
              onPress={markAsMissing}
            >
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color="#C34539"
              />

              <Text
                style={
                  styles.missingButtonText
                }
              >
                Mark as Missing
              </Text>
            </Pressable>
          )}

          {/* MISSING PET */}

          {isMissing && (
            <View style={{ marginTop: 15 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.missingButton,
                  {
                    marginTop: 0,
                    borderColor: "#BFD8C6",
                  },
                  pressed && styles.pressed,
                ]}
                onPress={sawThePet}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#176B3A"
                />

                <Text
                  style={[
                    styles.missingButtonText,
                    {
                      color: "#176B3A",
                    },
                  ]}
                >
                  I Saw the Pet
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.missingButton,
                  {
                    marginTop: 10,
                    borderColor: "#D9DEDB",
                  },
                  pressed && styles.pressed,
                ]}
                onPress={openMissingDetails}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="#176B3A"
                />

                <Text
                  style={[
                    styles.missingButtonText,
                    {
                      color: "#176B3A",
                    },
                  ]}
                >
                  More Details
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ========================================
          MARK AS MISSING MODAL
      ======================================== */}

      <Modal
        visible={missingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMissingModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeMissingModal}
          />

          <View style={styles.missingModal}>
            <View style={styles.modalHeader}>
              <View
                style={
                  styles.modalWarningIcon
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={26}
                  color="#C34539"
                />
              </View>

              <View
                style={styles.modalHeaderText}
              >
                <Text
                  style={styles.modalTitle}
                >
                  Mark {pet.pet_name} as
                  Missing
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Add information that can
                  help the person who scans
                  the QR code.
                </Text>
              </View>
            </View>

            <Text style={styles.modalLabel}>
              Pet Condition
            </Text>

            <View
              style={styles.conditionRow}
            >
              <Pressable
                style={[
                  styles.conditionButton,
                  missingCondition ===
                    "Safe" &&
                    styles.conditionButtonSelected,
                ]}
                onPress={() =>
                  setMissingCondition("Safe")
                }
                disabled={reportingMissing}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={21}
                  color={
                    missingCondition ===
                    "Safe"
                      ? "#FFFFFF"
                      : "#176B3A"
                  }
                />

                <Text
                  style={[
                    styles.conditionButtonText,
                    missingCondition ===
                      "Safe" &&
                      styles.conditionButtonTextSelected,
                  ]}
                >
                  Safe
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.conditionButton,
                  styles.notSafeButton,
                  missingCondition ===
                    "Not Safe" &&
                    styles.notSafeButtonSelected,
                ]}
                onPress={() =>
                  setMissingCondition(
                    "Not Safe"
                  )
                }
                disabled={reportingMissing}
              >
                <Ionicons
                  name="warning-outline"
                  size={21}
                  color={
                    missingCondition ===
                    "Not Safe"
                      ? "#FFFFFF"
                      : "#C34539"
                  }
                />

                <Text
                  style={[
                    styles.conditionButtonText,
                    styles.notSafeButtonText,
                    missingCondition ===
                      "Not Safe" &&
                      styles.conditionButtonTextSelected,
                  ]}
                >
                  Not Safe
                </Text>
              </Pressable>
            </View>

            <Text
              style={
                styles.conditionHelpText
              }
            >
              Select the condition you
              believe {pet.pet_name} is
              currently in.
            </Text>

            <Text style={styles.modalLabel}>
              Message for Finder
            </Text>

            <TextInput
              style={
                styles.finderMessageInput
              }
              value={finderMessage}
              onChangeText={setFinderMessage}
              placeholder={`Please contact me if you see ${pet.pet_name}...`}
              placeholderTextColor="#A0AAA4"
              multiline
              textAlignVertical="top"
              maxLength={500}
              editable={!reportingMissing}
            />

            <Text
              style={styles.characterCount}
            >
              {finderMessage.length}/500
            </Text>

            <View
              style={styles.modalActions}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.cancelModalButton,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={closeMissingModal}
                disabled={reportingMissing}
              >
                <Text
                  style={
                    styles.cancelModalText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.reportMissingButton,
                  pressed &&
                    styles.pressed,
                  reportingMissing &&
                    styles.disabledButton,
                ]}
                onPress={
                  submitMissingReport
                }
                disabled={reportingMissing}
              >
                {reportingMissing ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="alert-circle-outline"
                      size={19}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.reportMissingButtonText
                      }
                    >
                      Mark as Missing
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ========================================
// ACTION BUTTON
// ========================================

function ActionButton({
  icon,
  title,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons
          name={icon}
          size={24}
          color="#176B3A"
        />
      </View>

      <Text style={styles.actionTitle}>
        {title}
      </Text>
    </Pressable>
  );
}

// ========================================
// INFO ROW
// ========================================

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons
          name={icon}
          size={20}
          color="#176B3A"
        />

        <Text style={styles.infoLabel}>
          {label}
        </Text>
      </View>

      <Text style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
    justifyContent: "space-between",
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
    fontSize: 21,
    fontWeight: "800",
    color: "#1E2D24",
  },

  content: {
    paddingHorizontal: 22,
    paddingBottom: 50,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#7A867F",
  },

  profileSection: {
    alignItems: "center",
    marginTop: 25,
  },

  imageContainer: {
    width: 135,
    height: 135,
    borderRadius: 68,
    backgroundColor: "#E8F2E9",
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },

  petImage: {
    width: "100%",
    height: "100%",
    borderRadius: 68,
  },

  placeholderImage: {
    flex: 1,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F2E9",
  },

  cameraButton: {
    position: "absolute",
    right: 1,
    bottom: 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#176B3A",
    borderWidth: 3,
    borderColor: "#FFFDF7",
    alignItems: "center",
    justifyContent: "center",
  },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 68,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },

  petName: {
    marginTop: 13,
    fontSize: 29,
    fontWeight: "900",
    color: "#1D2B22",
  },

  petBreed: {
    marginTop: 3,
    color: "#7A867F",
    fontSize: 15,
  },

  statusBadge: {
    marginTop: 10,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusText: {
    fontSize: 13,
    fontWeight: "800",
  },

  changePhotoText: {
    marginTop: 10,
    color: "#176B3A",
    fontSize: 14,
    fontWeight: "800",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 27,
    marginBottom: 30,
  },

  actionButton: {
    flex: 1,
    height: 92,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8E3",
    justifyContent: "center",
    alignItems: "center",
  },

  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  actionTitle: {
    marginTop: 7,
    color: "#31453A",
    fontSize: 14,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E2D24",
    marginBottom: 13,
    marginTop: 28,
  },


  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E2E8E4",
    paddingHorizontal: 16,
  },

  infoRow: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  infoLabel: {
    fontSize: 15,
    color: "#68766E",
  },

  infoValue: {
    fontSize: 15,
    color: "#26352B",
    fontWeight: "700",
    maxWidth: "50%",
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF1EF",
  },

  descriptionCard: {
    minHeight: 80,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  descriptionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#5F6F65",
  },

  safetyCard: {
    borderRadius: 18,
    backgroundColor: "#EEF6EF",
    padding: 16,
  },

  missingSafetyCard: {
    backgroundColor: "#FFF1F0",
  },

  safetyTop: {
    flexDirection: "row",
  },

  safetyIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  safetyTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  safetyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#27432F",
  },

  safetyDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#68786D",
  },

  missingButton: {
    height: 49,
    marginTop: 15,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAC9C6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  missingButtonText: {
    color: "#C34539",
    fontWeight: "700",
    fontSize: 14,
  },

  pressed: {
    opacity: 0.7,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 35, 26, 0.55)",
  },

  missingModal: {
    backgroundColor: "#FFFDF7",
    borderRadius: 22,
    padding: 20,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },

  modalWarningIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFF0EF",
    alignItems: "center",
    justifyContent: "center",
  },

  modalHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E2D24",
  },

  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#748078",
  },

  modalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#304139",
    marginBottom: 9,
  },

  conditionRow: {
    flexDirection: "row",
    gap: 10,
  },

  conditionButton: {
    flex: 1,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#BBD4C2",
    backgroundColor: "#F2F8F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  conditionButtonSelected: {
    backgroundColor: "#176B3A",
    borderColor: "#176B3A",
  },

  notSafeButton: {
    backgroundColor: "#FFF7F6",
    borderColor: "#EAC9C6",
  },

  notSafeButtonSelected: {
    backgroundColor: "#C34539",
    borderColor: "#C34539",
  },

  conditionButtonText: {
    color: "#176B3A",
    fontSize: 15,
    fontWeight: "800",
  },

  notSafeButtonText: {
    color: "#C34539",
  },

  conditionButtonTextSelected: {
    color: "#FFFFFF",
  },

  conditionHelpText: {
    marginTop: 8,
    marginBottom: 19,
    fontSize: 12,
    lineHeight: 17,
    color: "#849087",
  },

  finderMessageInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#DCE4DE",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#26352B",
  },

  characterCount: {
    marginTop: 5,
    marginBottom: 20,
    textAlign: "right",
    fontSize: 12,
    color: "#909A94",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
  },

  cancelModalButton: {
    flex: 1,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DDE3DF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelModalText: {
    color: "#5D6C63",
    fontSize: 15,
    fontWeight: "800",
  },

  reportMissingButton: {
    flex: 1.4,
    height: 50,
    borderRadius: 13,
    backgroundColor: "#C34539",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  reportMissingButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },


});
