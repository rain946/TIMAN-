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

type ChangePasswordModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
  const {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle,
  } = useKeyboardAwareScroll(28);
  const currentPasswordInputRef =
    useRef<TextInput>(null);
  const newPasswordInputRef =
    useRef<TextInput>(null);
  const confirmPasswordInputRef =
    useRef<TextInput>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);
  const [showNewPassword, setShowNewPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (!visible) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      setSaving(false);
    }
  }, [visible]);

  const handleClose = () => {
    if (saving) return;

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);

    onClose();
  };

  const handleChangePassword = async () => {
    const current = currentPassword.trim();
    const newPass = newPassword.trim();
    const confirmPass = confirmPassword.trim();





    if (!current || !newPass || !confirmPass) {
      Alert.alert(
        "Incomplete Information",
        "Please complete all password fields."
      );
      return;
    }

    if (newPass.length < 6) {
      Alert.alert(
        "Invalid Password",
        "New password must contain at least 6 characters."
      );
      return;
    }

    if (newPass !== confirmPass) {
      Alert.alert(
        "Password Mismatch",
        "New password and confirm password do not match."
      );
      return;
    }

    if (current === newPass) {
      Alert.alert(
        "Invalid Password",
        "Your new password must be different from your current password."
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

        setSaving(false);
        return;
      }





      const response = await fetch(
        `${API_URL}/profile/change-password`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            current_password: current,
            new_password: newPass,
            confirm_password: confirmPass,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to change password."
        );
      }


      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      onClose();

      Alert.alert(
        "Password Updated",
        "Your password has been changed successfully."
      );
    } catch (error) {
      console.error(
        "CHANGE PASSWORD ERROR:",
        error
      );

      Alert.alert(
        "Change Password Failed",
        error instanceof Error
          ? error.message
          : "Unable to change password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
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
            <View style={styles.headerIcon}>
              <Ionicons
                name="lock-closed"
                size={22}
                color="#176B3A"
              />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>
                Change Password
              </Text>

              <Text style={styles.subtitle}>
                Update your account password
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
                color="#65736A"
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
              styles.scrollContent,
              keyboardContentContainerStyle,
            ]}
          >
            <Text style={styles.label}>
              Current Password
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color="#758179"
              />

              <TextInput
                ref={currentPasswordInputRef}
                onFocus={() =>
                  handleInputFocus(
                    currentPasswordInputRef.current
                  )
                }
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#A2AAA5"
                secureTextEntry={
                  !showCurrentPassword
                }
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.eyeButton,
                  pressed && styles.pressed,
                  saving && styles.disabledButton,
                ]}
                onPress={() =>
                  setShowCurrentPassword(
                    (previous) => !previous
                  )
                }
                disabled={saving}
              >
                <Ionicons
                  name={
                    showCurrentPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={20}
                  color="#758179"
                />
              </Pressable>
            </View>

            <Text style={styles.label}>
              New Password
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="key-outline"
                size={19}
                color="#758179"
              />

              <TextInput
                ref={newPasswordInputRef}
                onFocus={() =>
                  handleInputFocus(
                    newPasswordInputRef.current
                  )
                }
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#A2AAA5"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.eyeButton,
                  pressed && styles.pressed,
                  saving && styles.disabledButton,
                ]}
                onPress={() =>
                  setShowNewPassword(
                    (previous) => !previous
                  )
                }
                disabled={saving}
              >
                <Ionicons
                  name={
                    showNewPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={20}
                  color="#758179"
                />
              </Pressable>
            </View>

            <Text style={styles.passwordHint}>
              Use at least 6 characters.
            </Text>

            <Text style={styles.label}>
              Confirm New Password
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={19}
                color="#758179"
              />

              <TextInput
                ref={confirmPasswordInputRef}
                onFocus={() =>
                  handleInputFocus(
                    confirmPasswordInputRef.current
                  )
                }
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#A2AAA5"
                secureTextEntry={
                  !showConfirmPassword
                }
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                returnKeyType="done"
                onSubmitEditing={
                  handleChangePassword
                }
              />

              <Pressable
                style={({ pressed }) => [
                  styles.eyeButton,
                  pressed && styles.pressed,
                  saving && styles.disabledButton,
                ]}
                onPress={() =>
                  setShowConfirmPassword(
                    (previous) => !previous
                  )
                }
                disabled={saving}
              >
                <Ionicons
                  name={
                    showConfirmPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={20}
                  color="#758179"
                />
              </Pressable>
            </View>

            <View style={styles.securityCard}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color="#176B3A"
              />

              <Text style={styles.securityText}>
                For your security, you need to
                enter your current password before
                creating a new one.
              </Text>
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
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.savePressed,
                  saving &&
                    styles.disabledButton,
                ]}
                onPress={handleChangePassword}
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

                    <Text style={styles.saveText}>
                      Change Password
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
    backgroundColor: "rgba(25, 35, 29, 0.45)",
  },

  modalContainer: {
    width: "100%",
    backgroundColor: "#FFFDF7",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    maxHeight: "90%",
    flexShrink: 1,
  },

  formScroll: {
    flexShrink: 1,
  },

  handle: {
    width: 42,
    height: 4,
    borderRadius: 10,
    backgroundColor: "#D6DDD8",
    alignSelf: "center",
    marginBottom: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EE",
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  title: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E2D24",
  },

  subtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#7B877F",
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F5F2",
  },

  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 28,
  },

  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3A4A40",
    marginBottom: 7,
    marginTop: 14,
  },

  inputContainer: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#DDE5DF",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 12,
    fontSize: 12,
    color: "#26392D",
  },

  eyeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  passwordHint: {
    fontSize: 9,
    color: "#8A958E",
    marginTop: 6,
    marginLeft: 3,
  },

  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EAF4EB",
    borderRadius: 14,
    padding: 13,
    marginTop: 22,
  },

  securityText: {
    flex: 1,
    marginLeft: 9,
    fontSize: 9,
    lineHeight: 15,
    color: "#5E7064",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9E0DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#65736A",
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

  saveText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  disabledButton: {
    opacity: 0.6,
  },

  savePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  pressed: {
    opacity: 0.7,
  },
});
