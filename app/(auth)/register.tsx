import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";

import {
  Alert,
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
import {
  CONTACT_NUMBER_VALIDATION_MESSAGE,
  GMAIL_VALIDATION_MESSAGE,
  isValidGmailAddress,
  isValidPhilippineMobileNumber,
  normalizeEmail,
  sanitizePhilippineMobileNumber,
} from "../../utils/validation";

type UserRole = "owner" | "clinic";

export default function RegisterScreen() {
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle,
  } = useKeyboardAwareScroll(40);
  const [role, setRole] = useState<UserRole>("owner");

  const [fullName, setFullName] = useState("");

  const [clinicName, setClinicName] = useState("");

  const [email, setEmail] = useState("");

  const [contactNumber, setContactNumber] = useState("");

  const [address, setAddress] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (
      !fullName.trim() ||
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !contactNumber.trim() ||
      !address.trim()
    ) {
      Alert.alert(
        "Incomplete Information",
        "Please fill in all required fields.",
      );
      return;
    }

    if (!isValidGmailAddress(normalizedEmail)) {
      Alert.alert("Invalid Email", GMAIL_VALIDATION_MESSAGE);
      return;
    }

    if (!isValidPhilippineMobileNumber(contactNumber)) {
      Alert.alert(
        "Invalid Contact Number",
        CONTACT_NUMBER_VALIDATION_MESSAGE,
      );
      return;
    }

    if (role === "clinic" && !clinicName.trim()) {
      Alert.alert(
        "Clinic Name Required",
        "Please enter the name of your veterinary clinic.",
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Invalid Password",
        "Password must be at least 8 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Password Mismatch",
        "Password and confirm password do not match.",
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          fullName: fullName.trim(),
          email: normalizedEmail,
          password: password,
          contactNumber,
          address: address.trim(),

          role: role,

          clinicName: role === "clinic" ? clinicName.trim() : null,
        }),
      });

      const data = await response.json();

      console.log("REGISTER STATUS:", response.status);
      console.log("REGISTER RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Registration Failed",
          data.message || "Unable to create account.",
        );
        return;
      }

      Alert.alert(
        "Account Created",
        role === "owner"
          ? "Your Pet Owner account has been created successfully."
          : "Your Clinic Staff account has been created successfully.",
        [
          {
            text: "Log In",
            onPress: () => router.replace("/login"),
          },
        ],
      );
    } catch (error) {
      console.log("REGISTER ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            keyboardContentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color="#2E7D6B" />
          </Pressable>

          <View style={styles.logoContainer}>
            <Text style={styles.paw}>🐾</Text>

            <Text style={styles.logo}>TIMAN</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>

            <Text style={styles.subtitle}>
              Join TIMAN and keep your pet&apos;s records in one place.
            </Text>
          </View>

          <Text style={styles.label}>I am a</Text>

          <View style={styles.roleContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.roleButton,
                role === "owner" && styles.selectedRole,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setRole("owner")}
            >
              <Ionicons
                name="paw-outline"
                size={22}
                color={role === "owner" ? "#FFFFFF" : "#2E7D6B"}
              />

              <Text
                style={[
                  styles.roleText,

                  role === "owner" && styles.selectedRoleText,
                ]}
              >
                Pet Owner
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.roleButton,
                role === "clinic" && styles.selectedRole,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setRole("clinic")}
            >
              <Ionicons
                name="medical-outline"
                size={22}
                color={role === "clinic" ? "#FFFFFF" : "#2E7D6B"}
              />

              <Text
                style={[
                  styles.roleText,

                  role === "clinic" && styles.selectedRoleText,
                ]}
              >
                Clinic Staff
              </Text>
            </Pressable>
          </View>

          <InputBox
            inputRef={(input) => {
              inputRefs.current.fullName = input;
            }}
            onFocus={() => handleInputFocus(inputRefs.current.fullName)}
            icon="person-outline"
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          {role === "clinic" && (
            <InputBox
              inputRef={(input) => {
                inputRefs.current.clinicName = input;
              }}
              onFocus={() => handleInputFocus(inputRefs.current.clinicName)}
              icon="business-outline"
              placeholder="Clinic Name"
              value={clinicName}
              onChangeText={setClinicName}
              autoCapitalize="words"
            />
          )}

          <InputBox
            inputRef={(input) => {
              inputRefs.current.email = input;
            }}
            onFocus={() => handleInputFocus(inputRefs.current.email)}
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <InputBox
            inputRef={(input) => {
              inputRefs.current.contactNumber = input;
            }}
            onFocus={() => handleInputFocus(inputRefs.current.contactNumber)}
            icon="call-outline"
            placeholder="Contact Number"
            value={contactNumber}
            onChangeText={(value) =>
              setContactNumber(sanitizePhilippineMobileNumber(value))
            }
            keyboardType="phone-pad"
            maxLength={11}
          />

          <InputBox
            inputRef={(input) => {
              inputRefs.current.address = input;
            }}
            onFocus={() => handleInputFocus(inputRefs.current.address)}
            icon="location-outline"
            placeholder="Address"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="words"
          />

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={21} color="#6B7C73" />

            <TextInput
              ref={(input) => {
                inputRefs.current.password = input;
              }}
              onFocus={() => handleInputFocus(inputRefs.current.password)}
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6B7C73"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />

            <Pressable
              style={({ pressed }) => [
                styles.eyeButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={21}
                color="#6B7C73"
              />
            </Pressable>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color="#6B7C73"
            />

            <TextInput
              ref={(input) => {
                inputRefs.current.confirmPassword = input;
              }}
              onFocus={() =>
                handleInputFocus(inputRefs.current.confirmPassword)
              }
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#6B7C73"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />

            <Pressable
              style={({ pressed }) => [
                styles.eyeButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={21}
                color="#6B7C73"
              />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.signUpButton,

              pressed && !loading && styles.buttonPressed,

              loading && styles.disabledButton,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.signUpText}>
              {loading ? "Creating Account..." : "Create Account"}
            </Text>
          </Pressable>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>

            <Pressable
              disabled={loading}
              style={({ pressed }) => [
                styles.loginAction,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.loginLink}>Log In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InputBox({
  icon,
  inputRef,
  ...props
}: {
  icon: keyof typeof Ionicons.glyphMap;
  inputRef?: (input: TextInput | null) => void;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputContainer}>
      <Ionicons name={icon} size={21} color="#6B7C73" />

      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholderTextColor="#6B7C73"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5E9",
  },

  content: {
    paddingHorizontal: 27,
    paddingBottom: 40,
  },

  backButton: {
    width: 45,
    height: 45,
    justifyContent: "center",
    marginTop: 5,
  },

  logoContainer: {
    alignItems: "center",
    marginTop: 5,
  },

  paw: {
    fontSize: 32,
  },

  logo: {
    fontSize: 36,
    fontWeight: "900",
    color: "#2E7D6B",
    letterSpacing: 2,
    marginTop: -5,
  },

  header: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 25,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#2E3A34",
  },

  subtitle: {
    marginTop: 7,
    textAlign: "center",
    color: "#6B7C73",
    fontSize: 16,
    lineHeight: 23,
  },

  label: {
    fontSize: 16,
    color: "#2E3A34",
    fontWeight: "600",
    marginBottom: 10,
  },

  roleContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  roleButton: {
    flex: 1,
    height: 65,
    borderWidth: 1.5,
    borderColor: "#CFE8DD",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },

  selectedRole: {
    backgroundColor: "#2E7D6B",
    borderColor: "#2E7D6B",
  },

  roleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D6B",
  },

  selectedRoleText: {
    color: "#FFFFFF",
  },

  inputContainer: {
    minHeight: 57,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 13,
  },

  input: {
    flex: 1,
    marginLeft: 11,
    fontSize: 17,
    color: "#2E3A34",
    paddingVertical: 15,
  },

  signUpButton: {
    height: 58,
    backgroundColor: "#2E7D6B",
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  disabledButton: {
    opacity: 0.6,
  },

  signUpText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  loginText: {
    color: "#6B7C73",
    fontSize: 16,
  },

  loginLink: {
    color: "#2E7D6B",
    fontSize: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  loginAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
