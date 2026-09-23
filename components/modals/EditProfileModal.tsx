import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { API_URL } from "../../config/api";
import { useKeyboardAwareScroll } from "../../hooks/useKeyboardAwareScroll";

type OwnerProfile = {
  user_id: number;
  full_name: string;
  email: string;
  contact_number: string;
  address: string;
  role: string;
  clinic_name?: string | null;
};

type EditProfileModalProps = {
  visible: boolean;
  profile: OwnerProfile | null;
  onClose: () => void;
  onUpdated: (profile: OwnerProfile) => void;
};

export default function EditProfileModal({
  visible,
  profile,
  onClose,
  onUpdated,
}: EditProfileModalProps) {
  const {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle,
  } = useKeyboardAwareScroll(35);
  const fullNameInputRef = useRef<TextInput>(null);
  const contactInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] =
    useState("");
  const [address, setAddress] = useState("");

  const [saving, setSaving] = useState(false);





  useEffect(() => {
    if (visible && profile) {
      setFullName(profile.full_name || "");
      setContactNumber(
        profile.contact_number || ""
      );
      setAddress(profile.address || "");
    }
  }, [visible, profile]);





  const handleClose = () => {
    if (saving) {
      return;
    }

    onClose();
  };





  const handleSave = async () => {
    const cleanFullName = fullName.trim();
    const cleanContactNumber =
      contactNumber.trim();
    const cleanAddress = address.trim();

    if (
      !cleanFullName ||
      !cleanContactNumber ||
      !cleanAddress
    ) {
      Alert.alert(
        "Missing Information",
        "Please complete all required fields."
      );
      return;
    }

    if (cleanFullName.length > 100) {
      Alert.alert(
        "Invalid Full Name",
        "Full name is too long."
      );
      return;
    }

    if (cleanContactNumber.length > 20) {
      Alert.alert(
        "Invalid Contact Number",
        "Contact number is too long."
      );
      return;
    }

    if (cleanAddress.length > 255) {
      Alert.alert(
        "Invalid Address",
        "Address is too long."
      );
      return;
    }

    try {
      setSaving(true);

      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );
        return;
      }

      const response = await fetch(
        `${API_URL}/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: cleanFullName,
            contact_number:
              cleanContactNumber,
            address: cleanAddress,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to update profile."
        );
      }


      const storedUser =
        await AsyncStorage.getItem("user");

      let updatedStoredUser = data.user;

      if (storedUser) {
        try {
          const parsedUser =
            JSON.parse(storedUser);

          updatedStoredUser = {
            ...parsedUser,
            ...data.user,
            full_name: data.user.full_name,
            contact_number:
              data.user.contact_number,
            address: data.user.address,
          };
        } catch (error) {
          console.log(
            "PARSE STORED USER ERROR:",
            error
          );
        }
      }

      await AsyncStorage.setItem(
        "user",
        JSON.stringify(updatedStoredUser)
      );

      onUpdated(data.user);

      onClose();

      Alert.alert(
        "Profile Updated",
        "Your profile information has been updated successfully."
      );
    } catch (error) {
      console.error(
        "UPDATE PROFILE ERROR:",
        error
      );

      Alert.alert(
        "Update Failed",
        error instanceof Error
          ? error.message
          : "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
        />

        <View style={styles.modalContainer}>
          <View style={styles.handle} />


          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                Edit Profile
              </Text>

              <Text style={styles.subtitle}>
                Update your personal information
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
              onPress={handleClose}
              disabled={saving}
            >
              <Ionicons
                name="close"
                size={22}
                color="#4D5B52"
              />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.formScroll}
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

            <Text style={styles.label}>
              Full Name
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={19}
                color="#176B3A"
              />

              <TextInput
                ref={fullNameInputRef}
                onFocus={() =>
                  handleInputFocus(
                    fullNameInputRef.current
                  )
                }
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
                placeholderTextColor="#A3ADA7"
                autoCapitalize="words"
                editable={!saving}
              />
            </View>


            <Text style={styles.label}>
              Email Address
            </Text>

            <View
              style={[
                styles.inputContainer,
                styles.disabledInput,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={19}
                color="#89948E"
              />

              <TextInput
                style={[
                  styles.input,
                  styles.disabledInputText,
                ]}
                value={profile?.email || ""}
                editable={false}
              />

              <Ionicons
                name="lock-closed-outline"
                size={15}
                color="#A1AAA5"
              />
            </View>

            <Text style={styles.helperText}>
              Email address cannot be changed
              here.
            </Text>


            <Text style={styles.label}>
              Contact Number
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="call-outline"
                size={19}
                color="#176B3A"
              />

              <TextInput
                ref={contactInputRef}
                onFocus={() =>
                  handleInputFocus(
                    contactInputRef.current
                  )
                }
                style={styles.input}
                value={contactNumber}
                onChangeText={setContactNumber}
                placeholder="Enter contact number"
                placeholderTextColor="#A3ADA7"
                keyboardType="phone-pad"
                editable={!saving}
                maxLength={20}
              />
            </View>


            <Text style={styles.label}>
              Address
            </Text>

            <View
              style={[
                styles.inputContainer,
                styles.addressContainer,
              ]}
            >
              <Ionicons
                name="location-outline"
                size={19}
                color="#176B3A"
                style={styles.addressIcon}
              />

              <TextInput
                ref={addressInputRef}
                onFocus={() =>
                  handleInputFocus(
                    addressInputRef.current
                  )
                }
                style={[
                  styles.input,
                  styles.addressInput,
                ]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter address"
                placeholderTextColor="#A3ADA7"
                multiline
                textAlignVertical="top"
                autoCapitalize="words"
                editable={!saving}
                maxLength={255}
              />
            </View>


            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleClose}
                disabled={saving}
              >
                <Text
                  style={styles.cancelButtonText}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  saving &&
                    styles.disabledButton,
                  pressed &&
                    !saving &&
                    styles.pressed,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={19}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Save Changes
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },

  modalContainer: {
    width: "100%",
    backgroundColor: "#FFFDF7",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingTop: 10,
    flexShrink: 1,
  },

  formScroll: {
    flexShrink: 1,
  },

  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D5DCD7",
    alignSelf: "center",
    marginBottom: 13,
  },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EBE8",
  },

  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E2D24",
  },

  subtitle: {
    fontSize: 11,
    color: "#7B877F",
    marginTop: 3,
  },

  closeButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: "#EEF3EF",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 35,
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#34463B",
    marginBottom: 8,
    marginTop: 15,
  },

  inputContainer: {
    minHeight: 53,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5DF",
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  input: {
    flex: 1,
    fontSize: 13,
    color: "#26372D",
    paddingVertical: 12,
  },

  disabledInput: {
    backgroundColor: "#F2F4F2",
  },

  disabledInputText: {
    color: "#818B85",
  },

  helperText: {
    fontSize: 9,
    color: "#919B95",
    marginTop: 6,
    marginLeft: 3,
  },

  addressContainer: {
    minHeight: 90,
    alignItems: "flex-start",
  },

  addressIcon: {
    marginTop: 15,
  },

  addressInput: {
    minHeight: 85,
    paddingTop: 14,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },

  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7DFD9",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#637067",
  },

  saveButton: {
    flex: 1.5,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#176B3A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  saveButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  disabledButton: {
    opacity: 0.6,
  },

  pressed: {
    opacity: 0.7,
  },
});
