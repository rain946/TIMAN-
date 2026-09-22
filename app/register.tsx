import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";

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
import { API_URL } from "../config/api";


type UserRole = "owner" | "clinic";

export default function RegisterScreen() {
  const [role, setRole] = useState<UserRole>("owner");

  const [fullName, setFullName] =
    useState("");

  const [clinicName, setClinicName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [contactNumber, setContactNumber] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  // ========================================
  // REGISTER ACCOUNT
  // ========================================

  const handleRegister = async () => {
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
        "Please fill in all required fields."
      );
      return;
    }

    // Clinic name required kung Clinic Staff
    if (role === "clinic" && !clinicName.trim()) {
      Alert.alert(
        "Clinic Name Required",
        "Please enter the name of your veterinary clinic."
      );
      return;
    }

    // Check password length
    if (password.length < 8) {
      Alert.alert(
        "Invalid Password",
        "Password must be at least 8 characters."
      );
      return;
    }

    // Check confirm password
    if (password !== confirmPassword) {
      Alert.alert(
        "Password Mismatch",
        "Password and confirm password do not match."
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
          email: email.trim().toLowerCase(),
          password: password,
          contactNumber: contactNumber.trim(),
          address: address.trim(),

          // IMPORTANT: selected role
          role: role,

          // Only send clinic name for clinic staff
          clinicName:
            role === "clinic"
              ? clinicName.trim()
              : null,
        }),
      });

      const data = await response.json();

      console.log("REGISTER STATUS:", response.status);
      console.log("REGISTER RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Registration Failed",
          data.message || "Unable to create account."
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
        ]
      );
    } catch (error) {
      console.log("REGISTER ERROR:", error);

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // UI
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* BACK BUTTON */}

          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color="#173D2A"
            />
          </Pressable>

          {/* LOGO */}

          <View
            style={
              styles.logoContainer
            }
          >
            <Text style={styles.paw}>
              🐾
            </Text>

            <Text style={styles.logo}>
              TIMAN
            </Text>
          </View>

          {/* HEADER */}

          <View style={styles.header}>
            <Text style={styles.title}>
              Create Account
            </Text>

            <Text
              style={styles.subtitle}
            >
              Join TIMAN and keep your
              pet&apos;s records in one
              place.
            </Text>
          </View>

          {/* ROLE */}

          <Text style={styles.label}>
            I am a
          </Text>

          <View
            style={
              styles.roleContainer
            }
          >
            {/* PET OWNER */}

            <Pressable
              style={[
                styles.roleButton,

                role === "owner" &&
                  styles.selectedRole,
              ]}
              onPress={() =>
                setRole("owner")
              }
            >
              <Ionicons
                name="paw-outline"
                size={22}
                color={
                  role === "owner"
                    ? "#FFFFFF"
                    : "#176B3A"
                }
              />

              <Text
                style={[
                  styles.roleText,

                  role === "owner" &&
                    styles.selectedRoleText,
                ]}
              >
                Pet Owner
              </Text>
            </Pressable>

            {/* CLINIC STAFF */}

            <Pressable
              style={[
                styles.roleButton,

                role === "clinic" &&
                  styles.selectedRole,
              ]}
              onPress={() =>
                setRole("clinic")
              }
            >
              <Ionicons
                name="medical-outline"
                size={22}
                color={
                  role === "clinic"
                    ? "#FFFFFF"
                    : "#176B3A"
                }
              />

              <Text
                style={[
                  styles.roleText,

                  role === "clinic" &&
                    styles.selectedRoleText,
                ]}
              >
                Clinic Staff
              </Text>
            </Pressable>
          </View>

          {/* FULL NAME */}

          <InputBox
            icon="person-outline"
            placeholder="Full Name"
            value={fullName}
            onChangeText={
              setFullName
            }
            autoCapitalize="words"
          />

          {/* CLINIC NAME */}

          {role === "clinic" && (
            <InputBox
              icon="business-outline"
              placeholder="Clinic Name"
              value={clinicName}
              onChangeText={
                setClinicName
              }
              autoCapitalize="words"
            />
          )}

          {/* EMAIL */}

          <InputBox
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* CONTACT NUMBER */}

          <InputBox
            icon="call-outline"
            placeholder="Contact Number"
            value={contactNumber}
            onChangeText={
              setContactNumber
            }
            keyboardType="phone-pad"
          />

          {/* ADDRESS */}

          <InputBox
            icon="location-outline"
            placeholder="Address"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="words"
          />

          {/* PASSWORD */}

          <View
            style={
              styles.inputContainer
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={21}
              color="#65736B"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8A948E"
              value={password}
              onChangeText={
                setPassword
              }
              secureTextEntry={
                !showPassword
              }
              autoCapitalize="none"
            />

            <Pressable
              onPress={() =>
                setShowPassword(
                  !showPassword
                )
              }
            >
              <Ionicons
                name={
                  showPassword
                    ? "eye-off-outline"
                    : "eye-outline"
                }
                size={21}
                color="#65736B"
              />
            </Pressable>
          </View>

          {/* CONFIRM PASSWORD */}

          <View
            style={
              styles.inputContainer
            }
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color="#65736B"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#8A948E"
              value={
                confirmPassword
              }
              onChangeText={
                setConfirmPassword
              }
              secureTextEntry={
                !showConfirmPassword
              }
              autoCapitalize="none"
            />

            <Pressable
              onPress={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
            >
              <Ionicons
                name={
                  showConfirmPassword
                    ? "eye-off-outline"
                    : "eye-outline"
                }
                size={21}
                color="#65736B"
              />
            </Pressable>
          </View>

          {/* CREATE ACCOUNT */}

          <Pressable
            style={({ pressed }) => [
              styles.signUpButton,

              pressed &&
                !loading &&
                styles.buttonPressed,

              loading &&
                styles.disabledButton,
            ]}
            onPress={
              handleRegister
            }
            disabled={loading}
          >
            <Text
              style={
                styles.signUpText
              }
            >
              {loading
                ? "Creating Account..."
                : "Create Account"}
            </Text>
          </Pressable>

          {/* LOGIN */}

          <View
            style={
              styles.loginContainer
            }
          >
            <Text
              style={
                styles.loginText
              }
            >
              Already have an
              account?{" "}
            </Text>

            <Pressable
              disabled={loading}
              onPress={() =>
                router.replace(
                  "/login"
                )
              }
            >
              <Text
                style={
                  styles.loginLink
                }
              >
                Log In
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ========================================
// REUSABLE INPUT
// ========================================

function InputBox({
  icon,
  ...props
}: {
  icon: keyof typeof Ionicons.glyphMap;
} & React.ComponentProps<
  typeof TextInput
>) {
  return (
    <View
      style={
        styles.inputContainer
      }
    >
      <Ionicons
        name={icon}
        size={21}
        color="#65736B"
      />

      <TextInput
        style={styles.input}
        placeholderTextColor="#8A948E"
        {...props}
      />
    </View>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
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
    color: "#176B3A",
    letterSpacing: 2,
    marginTop: -5,
  },

  header: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 25,
  },

  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#17251D",
  },

  subtitle: {
    marginTop: 7,
    textAlign: "center",
    color: "#68766E",
    fontSize: 14,
    lineHeight: 20,
  },

  label: {
    fontSize: 14,
    color: "#354B3E",
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
    borderColor: "#BFD5C5",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },

  selectedRole: {
    backgroundColor: "#176B3A",
    borderColor: "#176B3A",
  },

  roleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#176B3A",
  },

  selectedRoleText: {
    color: "#FFFFFF",
  },

  inputContainer: {
    minHeight: 57,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E2DC",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 13,
  },

  input: {
    flex: 1,
    marginLeft: 11,
    fontSize: 15,
    color: "#17251D",
    paddingVertical: 15,
  },

  signUpButton: {
    height: 58,
    backgroundColor: "#176B3A",
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
    fontSize: 17,
    fontWeight: "700",
  },

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 22,
  },

  loginText: {
    color: "#68766E",
    fontSize: 14,
  },

  loginLink: {
    color: "#176B3A",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine:
      "underline",
  },
});
