import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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

type Sex = "Male" | "Female";
type Species = "Dog" | "Cat" | "Other";

export default function AddPetScreen() {
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("Dog");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<Sex>("Male");
  const [birthDate, setBirthDate] = useState("");
  const [color, setColor] = useState("");
  const [marks, setMarks] = useState("");

  // Store the complete ImagePicker asset.
  const [petImage, setPetImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [loading, setLoading] = useState(false);

  // =====================================================
  // PICK IMAGE
  // =====================================================

  const pickImage = async () => {
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
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

      if (!result.canceled && result.assets.length > 0) {
        const selectedImage = result.assets[0];

        console.log("SELECTED IMAGE:", selectedImage);

        setPetImage(selectedImage);
      }
    } catch (error) {
      console.log("IMAGE PICKER ERROR:", error);

      Alert.alert(
        "Photo Error",
        "Unable to select a pet photo."
      );
    }
  };

  // =====================================================
  // REMOVE IMAGE
  // =====================================================

  const removePhoto = () => {
    Alert.alert(
      "Remove Photo",
      "Remove the selected pet photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => setPetImage(null),
        },
      ]
    );
  };

  // =====================================================
  // DATE VALIDATION
  // =====================================================

  const isValidDate = (value: string) => {
    if (!value) {
      return true;
    }

    const format = /^\d{4}-\d{2}-\d{2}$/;

    if (!format.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00`);

    return !Number.isNaN(date.getTime());
  };

  // =====================================================
  // REGISTER PET
  // =====================================================

  const handleSave = async () => {
    if (!petName.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter your pet's name."
      );
      return;
    }

    if (!species) {
      Alert.alert(
        "Missing Information",
        "Please select a species."
      );
      return;
    }

    if (!breed.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter your pet's breed."
      );
      return;
    }

    if (!sex) {
      Alert.alert(
        "Missing Information",
        "Please select your pet's sex."
      );
      return;
    }

    if (
      birthDate.trim() &&
      !isValidDate(birthDate.trim())
    ) {
      Alert.alert(
        "Invalid Birth Date",
        "Please use YYYY-MM-DD format. Example: 2024-03-12."
      );
      return;
    }

    try {
      setLoading(true);

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

      // =================================================
      // FORM DATA
      // =================================================

      const formData = new FormData();

      formData.append("petName", petName.trim());
      formData.append("species", species);
      formData.append("breed", breed.trim());
      formData.append("sex", sex);

      if (birthDate.trim()) {
        formData.append(
          "birthDate",
          birthDate.trim()
        );
      }

      if (color.trim()) {
        formData.append(
          "color",
          color.trim()
        );
      }

      if (marks.trim()) {
        formData.append(
          "identifyingMarks",
          marks.trim()
        );
      }

      // =================================================
      // IMAGE
      // =================================================

      if (petImage) {
        let mimeType =
          petImage.mimeType || "image/jpeg";

        let extension = "jpg";

        if (mimeType === "image/png") {
          extension = "png";
        } else if (mimeType === "image/webp") {
          extension = "webp";
        } else {
          // Normalise iPhone/unknown image type to JPEG
          mimeType = "image/jpeg";
          extension = "jpg";
        }

        const fileName =
          petImage.fileName &&
          !petImage.fileName
            .toLowerCase()
            .endsWith(".heic")
            ? petImage.fileName
            : `pet-${Date.now()}.${extension}`;

        console.log("PHOTO URI:", petImage.uri);
        console.log("PHOTO NAME:", fileName);
        console.log("PHOTO TYPE:", mimeType);

        formData.append(
          "photo",
          {
            uri: petImage.uri,
            name: fileName,
            type: mimeType,
          } as any
        );
      }

      // =================================================
      // SEND REQUEST
      // =================================================

      console.log(
        "REGISTERING PET:",
        `${API_URL}/pets`
      );

      const response = await fetch(
        `${API_URL}/pets`,
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,

            // IMPORTANT:
            // Do not manually add Content-Type.
            // React Native will create the multipart boundary.
          },

          body: formData,
        }
      );

      // Read as text first so the app won't crash
      // if Express returns a non-JSON error.
      const responseText =
        await response.text();

      console.log(
        "ADD PET STATUS:",
        response.status
      );

      console.log(
        "ADD PET RAW RESPONSE:",
        responseText
      );

      let data: any = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        data = {
          message: responseText,
        };
      }

      if (!response.ok) {
        Alert.alert(
          "Unable to Register Pet",
          data.message ||
            `Server returned status ${response.status}.`
        );

        return;
      }

      Alert.alert(
        "Pet Registered",
        `${petName.trim()} has been added to TIMAN.`,
        [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.log(
        "ADD PET ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        error?.message ||
          "Unable to connect to the TIMAN server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          disabled={loading}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={27}
            color="#173D2A"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Register Pet
        </Text>

        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* PHOTO */}

          <View style={styles.photoSection}>
            <Pressable
              disabled={loading}
              onPress={pickImage}
              style={({ pressed }) => [
                styles.photoContainer,
                pressed && styles.pressed,
              ]}
            >
              {petImage ? (
                <Image
                  source={{
                    uri: petImage.uri,
                  }}
                  style={styles.petImage}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={styles.photoPlaceholder}
                >
                  <Ionicons
                    name="paw"
                    size={48}
                    color="#7EA48A"
                  />
                </View>
              )}

              <View style={styles.cameraButton}>
                <Ionicons
                  name="camera"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
            </Pressable>

            <Text style={styles.photoTitle}>
              {petImage
                ? "Pet Photo Selected"
                : "Add Pet Photo"}
            </Text>

            <Text style={styles.photoSubtitle}>
              Tap the photo to choose from your gallery.
            </Text>

            {petImage && (
              <Pressable
                disabled={loading}
                onPress={removePhoto}
              >
                <Text style={styles.removePhoto}>
                  Remove Photo
                </Text>
              </Pressable>
            )}
          </View>

          {/* BASIC INFORMATION */}

          <Text style={styles.sectionTitle}>
            Basic Information
          </Text>

          <View style={styles.formCard}>
            <InputField
              label="Pet Name"
              placeholder="Enter pet name"
              value={petName}
              onChangeText={setPetName}
              icon="paw-outline"
              editable={!loading}
            />

            <FieldDivider />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Species
              </Text>

              <View style={styles.optionRow}>
                <OptionButton
                  label="Dog"
                  icon="paw-outline"
                  selected={species === "Dog"}
                  onPress={() =>
                    setSpecies("Dog")
                  }
                  disabled={loading}
                />

                <OptionButton
                  label="Cat"
                  icon="paw-outline"
                  selected={species === "Cat"}
                  onPress={() =>
                    setSpecies("Cat")
                  }
                  disabled={loading}
                />

                <OptionButton
                  label="Other"
                  icon="ellipse-outline"
                  selected={species === "Other"}
                  onPress={() =>
                    setSpecies("Other")
                  }
                  disabled={loading}
                />
              </View>
            </View>

            <FieldDivider />

            <InputField
              label="Breed"
              placeholder="Example: Golden Retriever"
              value={breed}
              onChangeText={setBreed}
              icon="information-circle-outline"
              editable={!loading}
            />

            <FieldDivider />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Sex
              </Text>

              <View style={styles.optionRow}>
                <OptionButton
                  label="Male"
                  icon="male-outline"
                  selected={sex === "Male"}
                  onPress={() =>
                    setSex("Male")
                  }
                  disabled={loading}
                />

                <OptionButton
                  label="Female"
                  icon="female-outline"
                  selected={sex === "Female"}
                  onPress={() =>
                    setSex("Female")
                  }
                  disabled={loading}
                />
              </View>
            </View>

            <FieldDivider />

            <InputField
              label="Birth Date"
              placeholder="YYYY-MM-DD"
              value={birthDate}
              onChangeText={setBirthDate}
              icon="calendar-outline"
              editable={!loading}
            />

            <FieldDivider />

            <InputField
              label="Color"
              placeholder="Example: Golden Brown"
              value={color}
              onChangeText={setColor}
              icon="color-palette-outline"
              editable={!loading}
            />
          </View>

          {/* IDENTIFYING MARKS */}

          <Text style={styles.sectionTitle}>
            Identifying Marks
          </Text>

          <View style={styles.marksCard}>
            <View style={styles.marksHeader}>
              <Ionicons
                name="eye-outline"
                size={21}
                color="#176B3A"
              />

              <Text style={styles.marksLabel}>
                Distinguishing Features
              </Text>
            </View>

            <TextInput
              style={styles.marksInput}
              placeholder="Example: White patch on chest, dark spot near left ear..."
              placeholderTextColor="#A0AAA4"
              value={marks}
              onChangeText={setMarks}
              multiline
              editable={!loading}
              textAlignVertical="top"
              maxLength={250}
            />

            <Text style={styles.characterCount}>
              {marks.length}/250
            </Text>
          </View>

          {/* INFO */}

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={23}
              color="#176B3A"
            />

            <Text style={styles.infoText}>
              After registration, TIMAN will create
              one permanent QR identification for
              this pet. You can change the pet photo
              later from the Pet Profile.
            </Text>
          </View>

          {/* REGISTER */}

          <Pressable
            disabled={loading}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.registerButton,

              pressed &&
                !loading &&
                styles.registerPressed,

              loading &&
                styles.disabledButton,
            ]}
          >
            {loading ? (
              <>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text style={styles.registerText}>
                  Registering...
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="paw"
                  size={21}
                  color="#FFFFFF"
                />

                <Text style={styles.registerText}>
                  Register Pet
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =====================================================
// INPUT
// =====================================================

function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  editable,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  editable: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <View style={styles.inputContainer}>
        <Ionicons
          name={icon}
          size={20}
          color="#6C7C72"
        />

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#A1AAA5"
          value={value}
          onChangeText={onChangeText}
          editable={editable}
        />
      </View>
    </View>
  );
}

// =====================================================
// OPTION
// =====================================================

function OptionButton({
  label,
  icon,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionButton,
        selected &&
          styles.optionButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={
          selected
            ? "#176B3A"
            : "#77847C"
        }
      />

      <Text
        style={[
          styles.optionText,
          selected &&
            styles.optionTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FieldDivider() {
  return (
    <View style={styles.fieldDivider} />
  );
}

// =====================================================
// STYLES
// =====================================================

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
    backgroundColor: "#FFFDF7",
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
    paddingHorizontal: 22,
    paddingBottom: 50,
  },

  photoSection: {
    alignItems: "center",
    marginTop: 25,
    marginBottom: 28,
  },

  photoContainer: {
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

  photoPlaceholder: {
    flex: 1,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F2E9",
  },

  cameraButton: {
    position: "absolute",
    right: 2,
    bottom: 5,
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: "#176B3A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFDF7",
  },

  photoTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "800",
    color: "#26352B",
  },

  photoSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: "#849088",
  },

  removePhoto: {
    marginTop: 8,
    fontSize: 12,
    color: "#C34539",
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E2D24",
    marginBottom: 13,
    marginTop: 4,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8E4",
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 28,
  },

  fieldGroup: {
    paddingVertical: 14,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#526159",
    marginBottom: 9,
  },

  inputContainer: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  input: {
    flex: 1,
    minHeight: 46,
    fontSize: 13,
    color: "#26352B",
  },

  fieldDivider: {
    height: 1,
    backgroundColor: "#EEF1EF",
  },

  optionRow: {
    flexDirection: "row",
    gap: 8,
  },

  optionButton: {
    flex: 1,
    minHeight: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E6E2",
    backgroundColor: "#F9FAF9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },

  optionButtonSelected: {
    borderColor: "#76A886",
    backgroundColor: "#E8F3EA",
  },

  optionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#77847C",
  },

  optionTextSelected: {
    color: "#176B3A",
  },

  marksCard: {
    minHeight: 155,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E2E8E4",
    padding: 15,
    marginBottom: 25,
  },

  marksHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  marksLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#526159",
  },

  marksInput: {
    minHeight: 80,
    fontSize: 13,
    lineHeight: 19,
    color: "#26352B",
  },

  characterCount: {
    alignSelf: "flex-end",
    fontSize: 10,
    color: "#9AA49E",
  },

  infoCard: {
    backgroundColor: "#EEF6EF",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 25,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: "#627168",
  },

  registerButton: {
    minHeight: 55,
    borderRadius: 15,
    backgroundColor: "#176B3A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  registerText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  registerPressed: {
    opacity: 0.82,
  },

  disabledButton: {
    opacity: 0.65,
  },

  pressed: {
    opacity: 0.7,
  },
});
