import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";

import {
  ActivityIndicator,
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
import { timanShadow } from "../../components/timan/theme";
import { API_URL } from "../../config/api";
import { useKeyboardAwareScroll } from "../../hooks/useKeyboardAwareScroll";

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

export default function PetProfileScreen() {
  const {
    scrollViewRef: missingFormScrollViewRef,
    handleInputFocus: handleMissingInputFocus,
    handleScroll: handleMissingFormScroll,
    keyboardContentContainerStyle: missingKeyboardContentContainerStyle,
  } = useKeyboardAwareScroll(20);
  const finderMessageInputRef = useRef<TextInput>(null);

  const { petId } = useLocalSearchParams<{
    petId?: string;
  }>();

  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [missingModalVisible, setMissingModalVisible] = useState(false);

  const [missingCondition, setMissingCondition] =
    useState<MissingCondition>("Safe");

  const [finderMessage, setFinderMessage] = useState("");
  const [lastSeenLocation, setLastSeenLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [gettingLastSeenLocation, setGettingLastSeenLocation] = useState(false);

  const [reportingMissing, setReportingMissing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const SERVER_URL = API_URL.replace(/\/api\/?$/, "");

  const archivePet = async (reason: "Deceased" | "Missing / Not Found") => {
    if (!petId || archiving) return;

    try {
      setArchiving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/pets/${petId}/archive`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to archive this pet.");
      }

      Alert.alert("Pet Archived", data.message, [
        { text: "OK", onPress: () => router.replace("/pets") },
      ]);
    } catch (error) {
      Alert.alert(
        "Archive Failed",
        error instanceof Error ? error.message : "Unable to archive this pet.",
      );
    } finally {
      setArchiving(false);
    }
  };

  const confirmArchive = () => {
    Alert.alert(
      "Archive Pet",
      "Choose why this pet should be hidden. Veterinary records will not be deleted.",
      [
        { text: "Pet Has Passed Away", onPress: () => void archivePet("Deceased") },
        { text: "Missing / Not Found", onPress: () => void archivePet("Missing / Not Found") },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const getPhotoUrl = (photoUrl: string | null) => {
    if (!photoUrl) {
      return null;
    }

    if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
      return photoUrl;
    }

    return `${SERVER_URL}${photoUrl}`;
  };

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

      const response = await fetch(`${API_URL}/pets/${petId}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      console.log("GET PET STATUS:", response.status);
      console.log("GET PET RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Load Pet",
          data.message || "Pet information could not be loaded.",
        );

        return;
      }

      setPet(data.pet);
    } catch (error) {
      console.log("GET PET ERROR:", error);

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

  const handlePetPhotoResult = async (
    result: ImagePicker.ImagePickerResult,
  ) => {
    if (result.canceled) {
      return;
    }

    const selectedImage = result.assets[0];

    if (!selectedImage?.uri) {
      Alert.alert("Photo Error", "Unable to read the selected photo.");
      return;
    }

    await uploadPetPhoto(
      selectedImage.uri,
      selectedImage.mimeType ?? null,
      selectedImage.fileName ?? null,
    );
  };

  const chooseFromGallery = async () => {
    if (!pet || uploadingPhoto) {
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow TIMAN to access your photos.",
        );

        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      await handlePetPhotoResult(result);
    } catch (error) {
      console.log("PHOTO PICKER ERROR:", error);

      Alert.alert("Photo Error", "Unable to select the pet photo.");
    }
  };

  const takePetPhoto = async () => {
    if (!pet || uploadingPhoto) {
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow TIMAN to use your camera.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      await handlePetPhotoResult(result);
    } catch (error) {
      console.log("CAMERA ERROR:", error);

      Alert.alert("Camera Error", "Unable to take the pet photo.");
    }
  };

  const choosePetPhoto = () => {
    if (!pet || uploadingPhoto) {
      return;
    }

    Alert.alert("Pet Photo", "Choose where to get the pet photo.", [
      {
        text: "Take Photo",
        onPress: () => {
          void takePetPhoto();
        },
      },
      {
        text: "Choose from Gallery",
        onPress: () => {
          void chooseFromGallery();
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const uploadPetPhoto = async (
    imageUri: string,
    providedMimeType: string | null,
    providedFileName: string | null,
  ) => {
    if (!petId) {
      return;
    }

    try {
      setUploadingPhoto(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const uriWithoutQuery = imageUri.split("?")[0];

      const extensionMatch = uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);

      let extension = extensionMatch?.[1]?.toLowerCase() || "jpg";

      if (extension === "jpeg") {
        extension = "jpg";
      }

      let mimeType = providedMimeType || "image/jpeg";

      if (!providedMimeType) {
        if (extension === "png") {
          mimeType = "image/png";
        } else if (extension === "webp") {
          mimeType = "image/webp";
        } else {
          mimeType = "image/jpeg";
        }
      }

      const fileName = providedFileName || `pet-${Date.now()}.${extension}`;

      const formData = new FormData();

      formData.append("photo", {
        uri: imageUri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await fetch(`${API_URL}/pets/${petId}/photo`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      console.log("UPDATE PHOTO STATUS:", response.status);

      console.log("UPDATE PHOTO RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Update Photo",
          data.message || "Please try again.",
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
        `${pet?.pet_name || "Pet"}'s photo has been updated.`,
      );

      await loadPet();
    } catch (error) {
      console.log("UPLOAD PET PHOTO ERROR:", error);

      Alert.alert("Connection Error", "Unable to upload the pet photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const markAsMissing = () => {
    if (!pet) {
      return;
    }

    setMissingCondition("Safe");
    setFinderMessage("");
    setLastSeenLocation(null);
    setMissingModalVisible(true);
  };

  const closeMissingModal = () => {
    if (reportingMissing) {
      return;
    }

    setMissingModalVisible(false);
    setMissingCondition("Safe");
    setFinderMessage("");
    setLastSeenLocation(null);
  };

  const captureCurrentLocationAsLastSeen = async () => {
    try {
      setGettingLastSeenLocation(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          "Location Not Shared",
          "You can still mark your pet as Missing. A nearby alert cannot start until a last-known location is available.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLastSeenLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      Alert.alert("Location Added", "Your current location will be used as the pet's last-seen location.");
    } catch (error) {
      Alert.alert(
        "Location Unavailable",
        error instanceof Error ? error.message : "You can still mark your pet as Missing without a location.",
      );
    } finally {
      setGettingLastSeenLocation(false);
    }
  };

  const submitMissingReport = async () => {
    if (!pet || !petId || reportingMissing) {
      return;
    }

    const cleanMessage = finderMessage.trim();

    if (!cleanMessage) {
      Alert.alert(
        "Message Required",
        "Please enter a message for anyone who scans your pet's QR code.",
      );

      return;
    }

    try {
      setReportingMissing(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/lost-pets/${petId}/missing`, {
        method: "POST",

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          currentCondition: missingCondition,
          ownerMessage: cleanMessage,
          lastSeenLatitude: lastSeenLocation?.latitude ?? null,
          lastSeenLongitude: lastSeenLocation?.longitude ?? null,
        }),
      });

      const data = await response.json();

      console.log("REPORT MISSING STATUS:", response.status);

      console.log("REPORT MISSING RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Report Pet",
          data.message || "Please try again.",
        );

        return;
      }

      setMissingModalVisible(false);
      setMissingCondition("Safe");
      setFinderMessage("");
      setLastSeenLocation(null);

      await loadPet();

      Alert.alert(
        "Pet Marked as Missing",
        data.nearbyAlert?.status === "sent" && data.nearbyAlert?.recipientCount > 0
          ? `${pet.pet_name} is now marked as missing. ${data.nearbyAlert.recipientCount} nearby TIMAN user${data.nearbyAlert.recipientCount === 1 ? " was" : "s were"} alerted.`
          : data.nearbyAlert?.status === "sent"
            ? `${pet.pet_name} is now marked as missing. No eligible nearby TIMAN users were found.`
            : data.nearbyAlert?.reason === "no_location"
              ? `${pet.pet_name} is now marked as missing. Nearby alerts require a last-known location.`
              : `${pet.pet_name} is now marked as missing. The nearby alert could not be sent, but the missing report was saved.`,
      );
    } catch (error) {
      console.log("REPORT MISSING ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    } finally {
      setReportingMissing(false);
    }
  };

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
      ],
    );
  };

  const recoverPet = async () => {
    if (!pet || !petId) {
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/lost-pets/${petId}/recovered`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      console.log("RECOVER PET STATUS:", response.status);

      console.log("RECOVER PET RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Update Pet",
          data.message || "Please try again.",
        );

        return;
      }

      await loadPet();

      Alert.alert("Pet is Safe", `${pet.pet_name} has been marked as safe.`);
    } catch (error) {
      console.log("RECOVER PET ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
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

          <Text style={styles.headerTitle}>Pet Profile</Text>

          <View style={styles.headerButton} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Loading pet profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
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

          <Text style={styles.headerTitle}>Pet Profile</Text>

          <View style={styles.headerButton} />
        </View>

        <View style={styles.loadingContainer}>
          <Ionicons name="paw-outline" size={55} color="#56B091" />

          <Text style={styles.loadingText}>Pet information unavailable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photoSource = getPhotoUrl(pet.photo_url);

  const isMissing = pet.pet_status === "Missing";

  const isFound = pet.pet_status === "Found";

  const displayPetId = `PET-${String(pet.pet_id).padStart(4, "0")}`;

  const getStatusBackground = () => {
    if (isMissing) {
      return "rgba(229, 115, 115, 0.14)";
    }

    if (isFound) {
      return "#FAD7A0";
    }

    return "#FFF5E9";
  };

  const getStatusColor = () => {
    if (isMissing) {
      return "#E57373";
    }

    if (isFound) {
      return "#E57373";
    }

    return "#56B091";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
            uploadingPhoto && styles.disabledButton,
          ]}
          onPress={() => router.back()}
          disabled={uploadingPhoto}
        >
          <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
        </Pressable>

        <Text style={styles.headerTitle}>Pet Profile</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.profileSection}>
          <Pressable
            onPress={choosePetPhoto}
            disabled={uploadingPhoto}
            style={({ pressed }) => [
              styles.imageContainer,
              pressed && styles.pressed,
              uploadingPhoto && styles.disabledButton,
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
                <Ionicons name="paw" size={55} color="#56B091" />
              </View>
            )}

            {uploadingPhoto && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}

            {!uploadingPhoto && (
              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={19} color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          <View style={styles.identityCard}>
            <Text style={styles.petName}>{pet.pet_name}</Text>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: getStatusBackground(),
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor() },
                ]}
              />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {pet.pet_status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Basic Information</Text>

        <View style={styles.infoCard}>
          <InfoRow icon="barcode-outline" label="Pet ID" value={displayPetId} />

          <Divider />

          <InfoRow icon="paw-outline" label="Species" value={pet.species} />

          <Divider />

          <InfoRow
            icon="information-circle-outline"
            label="Breed"
            value={pet.breed || "Not specified"}
          />

          <Divider />

          <InfoRow
            icon={pet.sex === "Female" ? "female-outline" : "male-outline"}
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
            value={pet.color || "Not specified"}
          />
        </View>

        <Text style={styles.sectionTitle}>Identifying Marks</Text>

        <View style={styles.descriptionCard}>
          <Ionicons name="eye-outline" size={22} color="#2E7D6B" />

          <Text style={styles.descriptionText}>
            {pet.identifying_marks || "No identifying marks recorded."}
          </Text>
        </View>

        <Pressable
          disabled={archiving}
          style={({ pressed }) => [
            styles.archiveButton,
            pressed && styles.pressed,
            archiving && styles.disabledButton,
          ]}
          onPress={confirmArchive}
        >
          {archiving ? (
            <ActivityIndicator size="small" color="#F5A623" />
          ) : (
            <Ionicons name="archive-outline" size={20} color="#F5A623" />
          )}
          <Text style={styles.archiveButtonText}>Archive Pet</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Pet Safety</Text>

        <View
          style={[styles.safetyCard, isMissing && styles.missingSafetyCard]}
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
                color={isMissing ? "#E57373" : "#2E7D6B"}
              />
            </View>

            <View style={styles.safetyTextContainer}>
              <Text style={styles.safetyTitle}>
                {isMissing
                  ? `${pet.pet_name} is Missing`
                  : `${pet.pet_name} is currently ${pet.pet_status.toLowerCase()}`}
              </Text>

              <Text style={styles.safetyDescription}>
                {isMissing
                  ? "The TIMAN QR profile will show that this pet is currently missing."
                  : "If your pet goes missing, mark the pet as missing so anyone who scans the QR can contact you."}
              </Text>
            </View>
          </View>

          {!isMissing && (
            <Pressable
              style={({ pressed }) => [
                styles.missingButton,
                pressed && styles.pressed,
              ]}
              onPress={markAsMissing}
            >
              <Ionicons name="alert-circle-outline" size={20} color="#E57373" />

              <Text style={styles.missingButtonText}>Mark as Missing</Text>
            </Pressable>
          )}

          {isMissing && (
            <View style={{ marginTop: 15 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.missingButton,
                  {
                    marginTop: 0,
                    borderColor: "#CFE8DD",
                  },
                  pressed && styles.pressed,
                ]}
                onPress={sawThePet}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#2E7D6B"
                />

                <Text
                  style={[
                    styles.missingButtonText,
                    {
                      color: "#2E7D6B",
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
                    borderColor: "#CFE8DD",
                  },
                  pressed && styles.pressed,
                ]}
                onPress={openMissingDetails}
              >
                <Ionicons name="location-outline" size={20} color="#2E7D6B" />

                <Text
                  style={[
                    styles.missingButtonText,
                    {
                      color: "#2E7D6B",
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

      <Modal
        visible={missingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMissingModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeMissingModal} />

          <View style={styles.missingModal}>
            <ScrollView
              ref={missingFormScrollViewRef}
              style={styles.missingFormScroll}
              onScroll={handleMissingFormScroll}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.missingModalContent,
                missingKeyboardContentContainerStyle,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalWarningIcon}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={26}
                    color="#E57373"
                  />
                </View>

                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>
                    Mark {pet.pet_name} as Missing
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    Add information that can help the person who scans the QR
                    code.
                  </Text>
                </View>
              </View>

              <Text style={styles.modalLabel}>Pet Condition</Text>

              <View style={styles.conditionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.conditionButton,
                    missingCondition === "Safe" &&
                      styles.conditionButtonSelected,
                    pressed && styles.pressed,
                    reportingMissing && styles.disabledButton,
                  ]}
                  onPress={() => setMissingCondition("Safe")}
                  disabled={reportingMissing}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={21}
                    color={missingCondition === "Safe" ? "#FFFFFF" : "#2E7D6B"}
                  />

                  <Text
                    style={[
                      styles.conditionButtonText,
                      missingCondition === "Safe" &&
                        styles.conditionButtonTextSelected,
                    ]}
                  >
                    Safe
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.conditionButton,
                    styles.notSafeButton,
                    missingCondition === "Not Safe" &&
                      styles.notSafeButtonSelected,
                    pressed && styles.pressed,
                    reportingMissing && styles.disabledButton,
                  ]}
                  onPress={() => setMissingCondition("Not Safe")}
                  disabled={reportingMissing}
                >
                  <Ionicons
                    name="warning-outline"
                    size={21}
                    color={
                      missingCondition === "Not Safe" ? "#FFFFFF" : "#E57373"
                    }
                  />

                  <Text
                    style={[
                      styles.conditionButtonText,
                      styles.notSafeButtonText,
                      missingCondition === "Not Safe" &&
                        styles.conditionButtonTextSelected,
                    ]}
                  >
                    Not Safe
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.conditionHelpText}>
                Select the condition you believe {pet.pet_name} is currently in.
              </Text>

              <Text style={styles.modalLabel}>Message for Finder</Text>

              <TextInput
                ref={finderMessageInputRef}
                onFocus={() =>
                  handleMissingInputFocus(finderMessageInputRef.current)
                }
                style={styles.finderMessageInput}
                value={finderMessage}
                onChangeText={setFinderMessage}
                placeholder={`Please contact me if you see ${pet.pet_name}...`}
                placeholderTextColor="#6B7C73"
                multiline
                textAlignVertical="top"
                maxLength={500}
                editable={!reportingMissing}
              />

              <Text style={styles.characterCount}>
                {finderMessage.length}/500
              </Text>

              <Text style={styles.modalLabel}>Last-Seen Location (Optional)</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.locationButton,
                  lastSeenLocation && styles.locationButtonSelected,
                  (pressed || gettingLastSeenLocation) && styles.pressed,
                ]}
                onPress={() => void captureCurrentLocationAsLastSeen()}
                disabled={reportingMissing || gettingLastSeenLocation}
              >
                {gettingLastSeenLocation ? (
                  <ActivityIndicator size="small" color="#2E7D6B" />
                ) : (
                  <>
                    <Ionicons
                      name={lastSeenLocation ? "checkmark-circle" : "navigate-outline"}
                      size={20}
                      color="#2E7D6B"
                    />
                    <Text style={styles.locationButtonText}>
                      {lastSeenLocation
                        ? "Current Location Added"
                        : "Use Current Location as Last Seen"}
                    </Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.conditionHelpText}>
                TIMAN requests location only when you tap this button. You can still report the pet without it.
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelModalButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={closeMissingModal}
                  disabled={reportingMissing}
                >
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.reportMissingButton,
                    pressed && styles.pressed,
                    reportingMissing && styles.disabledButton,
                  ]}
                  onPress={submitMissingReport}
                  disabled={reportingMissing}
                >
                  {reportingMissing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="alert-circle-outline"
                        size={19}
                        color="#FFFFFF"
                      />

                      <Text style={styles.reportMissingButtonText}>
                        Mark as Missing
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

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
        <Ionicons name={icon} size={20} color="#2E7D6B" />

        <Text style={styles.infoLabel}>
          {label}
          {"\u00A0"}
        </Text>
      </View>

      <View style={styles.infoValueContainer}>
        <Text style={styles.infoValue}>
          {value}
          {"\u00A0"}
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
    maxWidth: 680,
    alignSelf: "center",
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
    color: "#6B7C73",
  },

  profileSection: {
    alignItems: "center",
    marginTop: 18,
  },

  imageContainer: {
    width: 135,
    height: 135,
    borderRadius: 68,
    backgroundColor: "#CFE8DD",
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
    backgroundColor: "#CFE8DD",
  },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 68,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },

  petName: {
    marginTop: 0,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "900",
    color: "#2E3A34",
    maxWidth: "100%",
    paddingHorizontal: 6,
    textAlign: "center",
  },

  cameraButton: {
    position: "absolute",
    right: 1,
    bottom: 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2E7D6B",
    borderWidth: 3,
    borderColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
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

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2E3A34",
    marginBottom: 11,
    marginTop: 22,
  },

  infoCard: {
    ...timanShadow,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    paddingHorizontal: 16,
  },
  identityCard: {
    width: "100%",
    maxWidth: 360,
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },

  infoRow: {
    minHeight: 55,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  infoLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  infoLabel: {
    fontSize: 15,
    lineHeight: 20,
    color: "#6B7C73",
  },

  infoValueContainer: {
    flex: 1,
    paddingRight: 8,
  },

  infoValue: {
    fontSize: 15,
    lineHeight: 21,
    color: "#2E3A34",
    fontWeight: "700",
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: "#CFE8DD",
  },

  descriptionCard: {
    minHeight: 80,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
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
    color: "#6B7C73",
  },

  safetyCard: {
    borderRadius: 18,
    backgroundColor: "#CFE8DD",
    padding: 16,
  },

  missingSafetyCard: {
    backgroundColor: "#FFF5E9",
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
    color: "#2E3A34",
  },

  safetyDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7C73",
  },

  missingButton: {
    height: 49,
    marginTop: 15,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  missingButtonText: {
    color: "#E57373",
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
    backgroundColor: "rgba(46, 58, 52, 0.5)",
  },

  missingModal: {
    width: "100%",
    backgroundColor: "#FFF5E9",
    borderRadius: 22,
    maxHeight: "90%",
    flexShrink: 1,
    overflow: "hidden",
  },

  missingFormScroll: {
    flexShrink: 1,
  },

  missingModalContent: {
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
    backgroundColor: "#FAD7A0",
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
    color: "#2E3A34",
  },

  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7C73",
  },

  modalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2E3A34",
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
    borderColor: "#CFE8DD",
    backgroundColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  conditionButtonSelected: {
    backgroundColor: "#2E7D6B",
    borderColor: "#2E7D6B",
  },

  notSafeButton: {
    backgroundColor: "rgba(229, 115, 115, 0.12)",
    borderColor: "rgba(229, 115, 115, 0.35)",
  },

  notSafeButtonSelected: {
    backgroundColor: "#E57373",
    borderColor: "#E57373",
  },

  conditionButtonText: {
    color: "#2E7D6B",
    fontSize: 15,
    fontWeight: "800",
  },

  notSafeButtonText: {
    color: "#E57373",
  },

  conditionButtonTextSelected: {
    color: "#FFFFFF",
  },

  conditionHelpText: {
    marginTop: 8,
    marginBottom: 19,
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7C73",
  },

  finderMessageInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#2E3A34",
  },

  characterCount: {
    marginTop: 5,
    marginBottom: 20,
    textAlign: "right",
    fontSize: 12,
    color: "#6B7C73",
  },

  locationButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 13,
    backgroundColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
  },

  locationButtonSelected: {
    backgroundColor: "#CFE8DD",
    borderColor: "#2E7D6B",
  },

  locationButtonText: {
    color: "#2E7D6B",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
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
    borderColor: "#CFE8DD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelModalText: {
    color: "#56B091",
    fontSize: 15,
    fontWeight: "800",
  },

  reportMissingButton: {
    flex: 1.4,
    height: 50,
    borderRadius: 13,
    backgroundColor: "#E57373",
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

  archiveButton: {
    minHeight: 52,
    marginTop: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.14)",
    backgroundColor: "#6B7C73",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  archiveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E57373",
  },
});
