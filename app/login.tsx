import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { API_URL } from "../config/api";

import {
  registerDeviceForPushNotifications,
} from "../services/notificationService";

// =====================================================
// LOGIN SCREEN
// =====================================================

export default function LoginScreen() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  // ===================================================
  // LOGIN
  // ===================================================

  const handleLogin = async () => {
    // ===============================================
    // VALIDATION
    // ===============================================

    if (
      !email.trim() ||
      !password.trim()
    ) {
      Alert.alert(
        "Incomplete Information",
        "Please enter your email and password."
      );

      return;
    }

    const loginUrl =
      `${API_URL}/auth/login`;

    console.log(
      "========== TIMAN LOGIN =========="
    );

    console.log(
      "API_URL:",
      API_URL
    );

    console.log(
      "LOGIN URL:",
      loginUrl
    );

    console.log(
      "EMAIL:",
      email.trim().toLowerCase()
    );

    try {
      setLoading(true);

      // =============================================
      // LOGIN REQUEST
      // =============================================

      const response =
        await fetch(
          loginUrl,
          {
            method: "POST",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email:
                email
                  .trim()
                  .toLowerCase(),

              password,
            }),
          }
        );

      console.log(
        "RESPONSE STATUS:",
        response.status
      );

      const data =
        await response.json();

      console.log(
        "SERVER RESPONSE:",
        data
      );

      // =============================================
      // LOGIN FAILED
      // =============================================

      if (!response.ok) {
        Alert.alert(
          "Login Failed",
          data.message ||
            "Incorrect email or password."
        );

        return;
      }

      // =============================================
      // CHECK RESPONSE
      // =============================================

      if (
        !data.token ||
        !data.user
      ) {
        Alert.alert(
          "Login Failed",
          "The server returned incomplete login information."
        );

        return;
      }

      // =============================================
      // SAVE LOGIN SESSION
      // =============================================

      await AsyncStorage.multiSet([
        [
          "token",
          data.token,
        ],

        [
          "user",
          JSON.stringify(
            data.user
          ),
        ],
      ]);

      console.log(
        "LOGIN SUCCESS:",
        data.user
      );

      // =============================================
      // AUTOMATIC PUSH REGISTRATION
      // =============================================

      try {
        console.log(
          "TIMAN: Starting automatic push registration..."
        );

        const pushResult =
          await registerDeviceForPushNotifications();

        console.log(
          "TIMAN PUSH REGISTRATION RESULT:",
          pushResult
        );

        if (
          !pushResult.success
        ) {
          console.log(
            "TIMAN: Push registration was not completed.",
            pushResult.message
          );
        }
      } catch (pushError) {
        // Push failure should never prevent login.

        console.log(
          "TIMAN AUTO PUSH REGISTRATION ERROR:",
          pushError
        );
      }

      // =============================================
      // ROLE NAVIGATION
      // =============================================

      if (
        data.user.role ===
        "owner"
      ) {
        router.replace(
          "/dashboard"
        );

        return;
      }

      if (
        data.user.role ===
        "clinic"
      ) {
        router.replace(
          "/clinic-dashboard"
        );

        return;
      }

      // =============================================
      // INVALID ROLE
      // =============================================

      Alert.alert(
        "Account Error",
        "Invalid account role."
      );
    } catch (error) {
      console.log(
        "TIMAN LOGIN ERROR:",
        error
      );

      console.log(
        "LOGIN URL WAS:",
        loginUrl
      );

      Alert.alert(
        "Connection Error",
        `Cannot connect to:\n${loginUrl}`
      );
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // UI
  // ===================================================

  return (
    <SafeAreaView
      style={styles.container}
    >
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          {/* BACK */}

          <Pressable
            style={({ pressed }) => [
              styles.backButton,

              pressed &&
                styles.buttonPressed,
            ]}
            disabled={loading}
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
            <Text
              style={styles.paw}
            >
              🐾
            </Text>

            <Text
              style={styles.logo}
            >
              TIMAN
            </Text>
          </View>

          {/* HEADER */}

          <View
            style={styles.header}
          >
            <Text
              style={styles.title}
            >
              Welcome Back
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Log in to continue
              managing your pet&apos;s
              care and records.
            </Text>
          </View>

          {/* EMAIL */}

          <Text
            style={styles.label}
          >
            Email
          </Text>

          <View
            style={
              styles.inputContainer
            }
          >
            <Ionicons
              name="mail-outline"
              size={21}
              color="#65736B"
            />

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#8A948E"
              value={email}
              onChangeText={
                setEmail
              }
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* PASSWORD */}

          <Text
            style={styles.label}
          >
            Password
          </Text>

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
              placeholder="Enter your password"
              placeholderTextColor="#8A948E"
              value={password}
              onChangeText={
                setPassword
              }
              secureTextEntry={
                !showPassword
              }
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Pressable
              disabled={loading}
              onPress={() =>
                setShowPassword(
                  (current) =>
                    !current
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

          {/* FORGOT PASSWORD */}

          <Pressable
            disabled={loading}
            style={
              styles.forgotContainer
            }
            onPress={() =>
              Alert.alert(
                "Forgot Password",
                "Password reset will be connected next."
              )
            }
          >
            <Text
              style={
                styles.forgotText
              }
            >
              Forgot Password?
            </Text>
          </Pressable>

          {/* LOGIN BUTTON */}

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,

              pressed &&
                !loading &&
                styles.buttonPressed,

              loading &&
                styles.disabledButton,
            ]}
            onPress={
              handleLogin
            }
            disabled={loading}
          >
            <Text
              style={
                styles.loginButtonText
              }
            >
              {loading
                ? "Logging In..."
                : "Log In"}
            </Text>
          </Pressable>

          {/* ROLE INFORMATION */}

          <View
            style={styles.roleInfo}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color="#176B3A"
            />

            <Text
              style={
                styles.roleInfoText
              }
            >
              TIMAN will automatically
              open your Pet Owner or
              Clinic Staff account.
            </Text>
          </View>

          {/* DIVIDER */}

          <View
            style={
              styles.dividerContainer
            }
          >
            <View
              style={styles.divider}
            />

            <Text
              style={
                styles.dividerText
              }
            >
              New to TIMAN?
            </Text>

            <View
              style={styles.divider}
            />
          </View>

          {/* CREATE ACCOUNT */}

          <Pressable
            style={({ pressed }) => [
              styles.createButton,

              pressed &&
                styles.buttonPressed,
            ]}
            disabled={loading}
            onPress={() =>
              router.push(
                "/register"
              )
            }
          >
            <Ionicons
              name="person-add-outline"
              size={20}
              color="#176B3A"
            />

            <Text
              style={
                styles.createButtonText
              }
            >
              Create an Account
            </Text>
          </Pressable>

          {/* SECURITY */}

          <View
            style={
              styles.securityCard
            }
          >
            <View
              style={
                styles.securityIcon
              }
            >
              <Ionicons
                name="lock-closed"
                size={20}
                color="#176B3A"
              />
            </View>

            <View
              style={
                styles.securityContent
              }
            >
              <Text
                style={
                  styles.securityTitle
                }
              >
                Secure Account Access
              </Text>

              <Text
                style={
                  styles.securityText
                }
              >
                Your account is protected
                using secure authentication
                and encrypted passwords.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#FFFDF7",
    },

    content: {
      paddingHorizontal: 27,
      paddingBottom: 40,
    },

    backButton: {
      width: 45,
      height: 45,
      justifyContent:
        "center",
      marginTop: 5,
    },

    logoContainer: {
      alignItems: "center",
      marginTop: 20,
    },

    paw: {
      fontSize: 38,
    },

    logo: {
      fontSize: 39,
      fontWeight: "900",
      color: "#176B3A",
      letterSpacing: 2,
      marginTop: -6,
    },

    header: {
      alignItems: "center",
      marginTop: 22,
      marginBottom: 31,
    },

    title: {
      fontSize: 28,
      fontWeight: "900",
      color: "#17251D",
    },

    subtitle: {
      fontSize: 13,
      color: "#68766E",
      lineHeight: 20,
      textAlign: "center",
      marginTop: 7,
      paddingHorizontal: 15,
    },

    label: {
      fontSize: 13,
      fontWeight: "700",
      color: "#354B3E",
      marginBottom: 7,
    },

    inputContainer: {
      minHeight: 58,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#D9E2DC",
      borderRadius: 13,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
      marginBottom: 17,
    },

    input: {
      flex: 1,
      marginLeft: 11,
      fontSize: 15,
      color: "#17251D",
      paddingVertical: 15,
    },

    forgotContainer: {
      alignSelf: "flex-end",
      marginTop: -5,
      marginBottom: 22,
    },

    forgotText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#176B3A",
    },

    loginButton: {
      height: 58,
      backgroundColor:
        "#176B3A",
      borderRadius: 13,
      alignItems: "center",
      justifyContent:
        "center",
    },

    loginButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
    },

    disabledButton: {
      opacity: 0.6,
    },

    buttonPressed: {
      opacity: 0.75,

      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    roleInfo: {
      backgroundColor:
        "#EAF4EB",
      borderRadius: 13,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
    },

    roleInfoText: {
      flex: 1,
      fontSize: 9,
      lineHeight: 15,
      color: "#5E7164",
      marginLeft: 8,
    },

    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 25,
    },

    divider: {
      flex: 1,
      height: 1,
      backgroundColor:
        "#DDE3DF",
    },

    dividerText: {
      fontSize: 10,
      color: "#8B958F",
      marginHorizontal: 10,
    },

    createButton: {
      height: 55,
      borderWidth: 1.5,
      borderColor:
        "#176B3A",
      borderRadius: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
    },

    createButtonText: {
      color: "#176B3A",
      fontSize: 13,
      fontWeight: "800",
    },

    securityCard: {
      backgroundColor:
        "#F2F7F2",
      borderRadius: 15,
      padding: 14,
      flexDirection: "row",
      marginTop: 25,
    },

    securityIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
    },

    securityContent: {
      flex: 1,
      marginLeft: 10,
    },

    securityTitle: {
      fontSize: 10,
      fontWeight: "800",
      color: "#294C34",
    },

    securityText: {
      fontSize: 9,
      color: "#718077",
      lineHeight: 14,
      marginTop: 3,
    },
  });
