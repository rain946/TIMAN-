import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";

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
import { API_URL } from "../../config/api";
import { useKeyboardAwareScroll } from "../../hooks/useKeyboardAwareScroll";

type Sex = "Male" | "Female";
type Species = "Dog" | "Cat" | "Other";

export default function AddPetScreen() {
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle,
  } = useKeyboardAwareScroll(50);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("Dog");
  const [otherSpecies, setOtherSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<Sex>("Male");
  const [birthDate, setBirthDate] = useState("");
  const [color, setColor] = useState("");
  const [marks, setMarks] = useState("");


  const [petImage, setPetImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [loading, setLoading] = useState(false);

  const openBirthDatePicker = () => {
    if (Platform.OS !== "android") {
      return;
    }

    DateTimePickerAndroid.open({
      value: parseDateValue(birthDate) || new Date(),
      mode: "date",
      maximumDate: new Date(),
      onChange: (
        event: DateTimePickerEvent,
        selectedDate?: Date
      ) => {
        if (event.type === "set" && selectedDate) {
          setBirthDate(formatDateValue(selectedDate));
        }
      },
    });
  };





  const handleSelectedImage = (
    result: ImagePicker.ImagePickerResult
  ) => {
    if (!result.canceled && result.assets.length > 0) {
      setPetImage(result.assets[0]);
    }
  };

  const chooseFromGallery = async () => {
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

      handleSelectedImage(result);
    } catch (error) {
      console.log("IMAGE PICKER ERROR:", error);

      Alert.alert(
        "Photo Error",
        "Unable to select a pet photo."
      );
    }
  };

  const takePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow TIMAN to use your camera."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      handleSelectedImage(result);
    } catch (error) {
      console.log("CAMERA ERROR:", error);

      Alert.alert(
        "Camera Error",
        "Unable to take a pet photo."
      );
    }
  };

  const pickImage = () => {
    Alert.alert(
      "Add Pet Photo",
      "Choose where to get the pet photo.",
      [
        {
          text: "Take Photo",
          onPress: () => {
            void takePhoto();
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
      ]
    );
  };





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

    if (species === "Other" && !otherSpecies.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter your pet's species."
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


      const formData = new FormData();

      formData.append("petName", petName.trim());
      formData.append(
        "species",
        species === "Other"
          ? otherSpecies.trim()
          : species
      );
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


      if (petImage) {
        let mimeType =
          petImage.mimeType || "image/jpeg";

        let extension = "jpg";

        if (mimeType === "image/png") {
          extension = "png";
        } else if (mimeType === "image/webp") {
          extension = "webp";
        } else {
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

          },

          body: formData,
        }
      );

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

      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
            loading && styles.disabledButton,
          ]}
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
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.content,
            keyboardContentContainerStyle,
          ]}
        >

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

            {petImage && (
              <Pressable
                disabled={loading}
                onPress={removePhoto}
                style={({ pressed }) => [
                  styles.removePhotoButton,
                  pressed && styles.pressed,
                  loading && styles.disabledButton,
                ]}
              >
                <Text style={styles.removePhoto}>
                  Remove Photo
                </Text>
              </Pressable>
            )}
          </View>


          <Text style={styles.sectionTitle}>
            Basic Information
          </Text>

          <View style={styles.formCard}>
            <InputField
              inputRef={(input) => {
                inputRefs.current.petName = input;
              }}
              onFocus={() =>
                handleInputFocus(inputRefs.current.petName)
              }
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

              {species === "Other" && (
                <InputField
                  inputRef={(input) => {
                    inputRefs.current.otherSpecies = input;
                  }}
                  onFocus={() =>
                    handleInputFocus(
                      inputRefs.current.otherSpecies
                    )
                  }
                  label="Other Species"
                  placeholder="Enter pet species"
                  value={otherSpecies}
                  onChangeText={setOtherSpecies}
                  icon="create-outline"
                  editable={!loading}
                />
              )}
            </View>

            <FieldDivider />

            <InputField
              inputRef={(input) => {
                inputRefs.current.breed = input;
              }}
              onFocus={() =>
                handleInputFocus(inputRefs.current.breed)
              }
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
              inputRef={(input) => {
                inputRefs.current.birthDate = input;
              }}
              onFocus={() =>
                handleInputFocus(inputRefs.current.birthDate)
              }
              label="Birth Date"
              placeholder="YYYY-MM-DD"
              value={birthDate}
              onChangeText={setBirthDate}
              icon="calendar-outline"
              editable={!loading}
              onPress={
                Platform.OS === "android"
                  ? openBirthDatePicker
                  : undefined
              }
            />

            <FieldDivider />

            <InputField
              inputRef={(input) => {
                inputRefs.current.color = input;
              }}
              onFocus={() =>
                handleInputFocus(inputRefs.current.color)
              }
              label="Color"
              placeholder="Example: Golden Brown"
              value={color}
              onChangeText={setColor}
              icon="color-palette-outline"
              editable={!loading}
            />
          </View>


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
              ref={(input) => {
                inputRefs.current.marks = input;
              }}
              onFocus={() =>
                handleInputFocus(inputRefs.current.marks)
              }
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


function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  editable,
  inputRef,
  onFocus,
  onPress,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  editable: boolean;
  inputRef?: (input: TextInput | null) => void;
  onFocus?: () => void;
  onPress?: () => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.inputContainer,
          pressed && editable && styles.pressed,
        ]}
        onPress={onPress}
        disabled={!editable}
      >
        <Ionicons
          name={icon}
          size={20}
          color="#6C7C72"
        />

        <TextInput
          ref={inputRef}
          onFocus={onFocus}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#A1AAA5"
          value={value}
          onChangeText={onChangeText}
          editable={editable && !onPress}
          pointerEvents={onPress ? "none" : "auto"}
        />
      </Pressable>
    </View>
  );
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


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

  removePhoto: {
    fontSize: 12,
    color: "#C34539",
    fontWeight: "700",
  },

  removePhotoButton: {
    minHeight: 44,
    marginTop: 4,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
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
