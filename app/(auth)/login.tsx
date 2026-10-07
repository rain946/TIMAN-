import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

import { registerDeviceForPushNotifications } from "../../services/notificationService";
import { checkNearbyAlertEnrollmentForSession } from "../../services/nearbyAlertEnrollment";
import {
  GMAIL_VALIDATION_MESSAGE,
  isValidGmailAddress,
  normalizeEmail,
} from "../../utils/validation";

type AuthenticatedUser = {
  user_id?: number;
  userId?: number;
  role?: string;
};

function startPostLoginSetup(token: string, user: AuthenticatedUser) {
  console.log("TIMAN: Starting background push registration...");

  void registerDeviceForPushNotifications()
    .then((pushResult) => {
      console.log("TIMAN PUSH REGISTRATION RESULT:", pushResult);

      if (!pushResult.success) {
        console.log(
          "TIMAN: Push registration was not completed.",
          pushResult.message,
        );
      }
    })
    .catch((pushError) => {
      console.log("TIMAN BACKGROUND PUSH REGISTRATION ERROR:", pushError);
    })
    .finally(() => {
      void checkNearbyAlertEnrollmentForSession({ token, user });
    });
}

export default function LoginScreen() {
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle,
  } = useKeyboardAwareScroll(40);
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password.trim()) {
      Alert.alert(
        "Incomplete Information",
        "Please enter your email and password.",
      );

      return;
    }

    if (!isValidGmailAddress(normalizedEmail)) {
      Alert.alert("Invalid Email", GMAIL_VALIDATION_MESSAGE);
      return;
    }

    const loginUrl = `${API_URL}/auth/login`;

    console.log("========== TIMAN LOGIN ==========");

    console.log("API_URL:", API_URL);

    console.log("LOGIN URL:", loginUrl);

    console.log("EMAIL:", normalizedEmail);

    try {
      setLoading(true);

      const response = await fetch(loginUrl, {
        method: "POST",

        headers: {
          Accept: "application/json",

          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: normalizedEmail,

          password,
        }),
      });

      console.log("RESPONSE STATUS:", response.status);

      const data = await response.json();

      console.log("SERVER RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Login Failed",
          data.message || "Incorrect email or password.",
        );

        return;
      }

      if (!data.token || !data.user) {
        Alert.alert(
          "Login Failed",
          "The server returned incomplete login information.",
        );

        return;
      }

      await AsyncStorage.multiSet([
        ["token", data.token],

        ["user", JSON.stringify(data.user)],
      ]);

      console.log("LOGIN SUCCESS:", data.user);

      if (data.user.role === "owner") {
        router.replace("/dashboard");

        startPostLoginSetup(data.token, data.user);

        return;
      }

      if (data.user.role === "clinic") {
        router.replace("/(clinic)/(tabs)/clinic-dashboard");

        startPostLoginSetup(data.token, data.user);

        return;
      }

      Alert.alert("Account Error", "Invalid account role.");
    } catch (error) {
      console.log("TIMAN LOGIN ERROR:", error);

      console.log("LOGIN URL WAS:", loginUrl);

      Alert.alert("Connection Error", `Cannot connect to:\n${loginUrl}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            keyboardContentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={({ pressed }) => [
              styles.backButton,

              pressed && styles.buttonPressed,
            ]}
            disabled={loading}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color="#2E7D6B" />
          </Pressable>

          <View style={styles.logoContainer}>
            <Text style={styles.paw}>🐾</Text>

            <Text style={styles.logo}>TIMAN</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>

            <Text style={styles.subtitle}>
              Log in to continue managing your pet&apos;s care and records.
            </Text>
          </View>

          <Text style={styles.label}>Email</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={21} color="#6B7C73" />

            <TextInput
              ref={emailInputRef}
              onFocus={() => handleInputFocus(emailInputRef.current)}
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#6B7C73"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <Text style={styles.label}>Password</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={21} color="#6B7C73" />

            <TextInput
              ref={passwordInputRef}
              onFocus={() => handleInputFocus(passwordInputRef.current)}
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#6B7C73"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Pressable
              disabled={loading}
              style={({ pressed }) => [
                styles.eyeButton,
                pressed && styles.buttonPressed,
                loading && styles.disabledButton,
              ]}
              onPress={() => setShowPassword((current) => !current)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={21}
                color="#6B7C73"
              />
            </Pressable>
          </View>

          <Pressable
            disabled={loading}
            style={({ pressed }) => [
              styles.forgotContainer,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              Alert.alert(
                "Forgot Password",
                "Password reset will be connected next.",
              )
            }
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,

              pressed && !loading && styles.buttonPressed,

              loading && styles.disabledButton,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? "Logging In..." : "Log In"}
            </Text>
          </Pressable>

          <View style={styles.roleInfo}>
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color="#2E7D6B"
            />

            <Text style={styles.roleInfoText}>
              TIMAN will automatically open your Pet Owner or Clinic Staff
              account.
            </Text>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />

            <Text style={styles.dividerText}>New to TIMAN?</Text>

            <View style={styles.divider} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.createButton,

              pressed && styles.buttonPressed,
            ]}
            disabled={loading}
            onPress={() => router.push("/register")}
          >
            <Ionicons name="person-add-outline" size={20} color="#2E7D6B" />

            <Text style={styles.createButtonText}>Create an Account</Text>
          </Pressable>

          <View style={styles.securityCard}>
            <View style={styles.securityIcon}>
              <Ionicons name="lock-closed" size={20} color="#2E7D6B" />
            </View>

            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>Secure Account Access</Text>

              <Text style={styles.securityText}>
                Your account is protected using secure authentication and
                encrypted passwords.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    marginTop: 12,
  },

  paw: {
    fontSize: 38,
  },

  logo: {
    fontSize: 39,
    fontWeight: "900",
    color: "#2E7D6B",
    letterSpacing: 2,
    marginTop: -6,
  },

  header: {
    alignItems: "center",
    marginTop: 14,
    marginBottom: 22,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#2E3A34",
  },

  subtitle: {
    fontSize: 16,
    color: "#6B7C73",
    lineHeight: 23,
    textAlign: "center",
    marginTop: 7,
    paddingHorizontal: 15,
  },

  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E3A34",
    marginBottom: 7,
  },

  inputContainer: {
    minHeight: 58,
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

  forgotContainer: {
    alignSelf: "flex-end",
    marginTop: -5,
    marginBottom: 14,
    minHeight: 44,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  forgotText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2E7D6B",
  },

  loginButton: {
    height: 58,
    backgroundColor: "#2E7D6B",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
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
    backgroundColor: "#CFE8DD",
    borderRadius: 13,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },

  roleInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#56B091",
    marginLeft: 8,
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#CFE8DD",
  },

  dividerText: {
    fontSize: 13,
    color: "#6B7C73",
    marginHorizontal: 10,
  },

  createButton: {
    height: 55,
    borderWidth: 1.5,
    borderColor: "#2E7D6B",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  createButtonText: {
    color: "#2E7D6B",
    fontSize: 16,
    fontWeight: "800",
  },

  securityCard: {
    backgroundColor: "#CFE8DD",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    marginTop: 18,
  },

  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  securityContent: {
    flex: 1,
    marginLeft: 10,
  },

  securityTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2E3A34",
  },

  securityText: {
    fontSize: 13,
    color: "#6B7C73",
    lineHeight: 19,
    marginTop: 3,
  },
});
