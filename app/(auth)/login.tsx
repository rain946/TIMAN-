import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useRef, useState } from "react";

import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  const { width, height } = useWindowDimensions();
  const petImageHeight = Math.min(Math.max(height * 0.255, 210), 242);
  const petImageWidth = Math.min(width - 32, 456);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle,
  } = useKeyboardAwareScroll(40, 96);
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
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
          <View style={styles.hero}>
            <View style={styles.heroMintShape} pointerEvents="none" />
            <View style={styles.heroMintLayer} pointerEvents="none" />
            <View style={styles.heroAccentShape} pointerEvents="none" />
            <Ionicons
              name="paw"
              size={22}
              color="rgba(46, 125, 107, 0.2)"
              style={styles.heroPawLeft}
            />
            <Ionicons
              name="paw"
              size={17}
              color="rgba(86, 176, 145, 0.3)"
              style={styles.heroPawRight}
            />
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              disabled={loading}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={26} color="#2E7D6B" />
            </Pressable>

            <View style={styles.heroBranding} pointerEvents="none">
              <Image
                source={require("../../assets/images/timan-wordmark.png")}
                style={styles.heroWordmark}
                resizeMode="contain"
              />
              <Text style={styles.heroSystemTitle}>
                Pet Identification and{"\n"}Veterinary Monitoring System
              </Text>
              <View style={styles.heroDivider} />
              <Text style={styles.heroCommunityText}>
                A safer community{"\n"}for every pet
              </Text>
            </View>

            <View
              style={[styles.petStage, { height: petImageHeight }]}
              pointerEvents="none"
            >
              <Image
                source={require("../../assets/images/timan-login-multi-pet-hero-v2.png")}
                style={[
                  styles.heroPets,
                  { width: petImageWidth, height: petImageHeight },
                ]}
                resizeMode="contain"
                accessible
                accessibilityLabel="A dog, cat, rabbit, parrot, guinea pig, and turtle surrounded by flowers and leaves"
              />
            </View>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome to TIMAN!</Text>
              <Text style={styles.subtitle}>
                Log in to continue to your account
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Ionicons name="mail-outline" size={20} color="#2E7D6B" />
              </View>
              <View style={styles.inputTextBlock}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  ref={emailInputRef}
                  onFocus={() => handleInputFocus(emailInputRef.current)}
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#9AA7A1"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#2E7D6B"
                />
              </View>
              <View style={styles.inputTextBlock}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  ref={passwordInputRef}
                  onFocus={() => handleInputFocus(passwordInputRef.current)}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9AA7A1"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              <Pressable
                disabled={loading}
                style={({ pressed }) => [
                  styles.eyeButton,
                  pressed && styles.buttonPressed,
                  loading && styles.disabledButton,
                ]}
                onPress={() => {
                  setShowPassword((current) => !current);
                  handleInputFocus(passwordInputRef.current);
                }}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={21}
                  color="#6B7C73"
                />
              </Pressable>
            </View>

            <Pressable
              disabled={loading}
              style={({ pressed }) => [
                styles.forgotButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() =>
                Alert.alert(
                  "Forgot Password",
                  "Password reset will be connected next.",
                )
              }
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
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
                {loading ? "Logging In..." : "Login"}
              </Text>
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.signUpRow}>
              <Text style={styles.signUpPrompt}>
                Don&apos;t have an account?{" "}
              </Text>
              <Pressable
                disabled={loading}
                style={({ pressed }) => pressed && styles.buttonPressed}
                onPress={() => router.push("/register")}
              >
                <Text style={styles.signUpLink}>Sign Up</Text>
              </Pressable>
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
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    position: "relative",
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  heroBranding: {
    width: "100%",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 0,
    zIndex: 2,
  },
  heroWordmark: {
    width: 168,
    height: 54,
  },
  heroSystemTitle: {
    marginTop: 1,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "700",
    color: "#456158",
  },
  heroDivider: {
    width: 38,
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: "#56B091",
  },
  heroCommunityText: {
    marginTop: 5,
    textAlign: "center",
    lineHeight: 17,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#2E7D6B",
  },

  hero: {
    width: "100%",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#FFF5E9",
    borderRadius: 34,
    zIndex: 2,
  },
  heroMintShape: {
    position: "absolute",
    width: 250,
    height: 220,
    borderRadius: 110,
    right: -98,
    top: -96,
    backgroundColor: "#CFE8DD",
    transform: [{ rotate: "18deg" }],
  },
  heroMintLayer: {
    position: "absolute",
    width: 168,
    height: 150,
    borderRadius: 82,
    right: -62,
    top: -76,
    backgroundColor: "rgba(86, 176, 145, 0.34)",
    transform: [{ rotate: "-12deg" }],
  },
  heroAccentShape: {
    position: "absolute",
    width: 132,
    height: 172,
    borderRadius: 72,
    left: -86,
    bottom: 4,
    backgroundColor: "#FAD7A0",
    opacity: 0.52,
    transform: [{ rotate: "-22deg" }],
  },
  heroPawLeft: {
    position: "absolute",
    left: 30,
    top: 72,
    transform: [{ rotate: "-18deg" }],
  },
  heroPawRight: {
    position: "absolute",
    right: 30,
    top: 65,
    transform: [{ rotate: "16deg" }],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 3,
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  petStage: {
    width: "100%",
    alignItems: "center",
    position: "relative",
    zIndex: 2,
  },
  heroPets: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
    zIndex: 3,
  },
  loginCard: {
    width: "100%",
    alignSelf: "center",
    marginTop: -16,
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 24,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(207, 232, 221, 0.82)",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.11,
    shadowRadius: 22,
    elevation: 6,
    zIndex: 5,
  },
  header: { alignItems: "center", marginBottom: 20 },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: "#0B6658",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7C73",
    marginTop: 4,
    textAlign: "center",
  },
  inputContainer: {
    minHeight: 64,
    backgroundColor: "#F9FCFA",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    marginBottom: 12,
  },
  inputIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E7F3ED",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: "100%",
    fontSize: 15,
    color: "#2E3A34",
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  inputTextBlock: {
    flex: 1,
    marginLeft: 11,
    justifyContent: "center",
  },
  inputLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#2E3A34",
    marginBottom: 2,
  },
  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  forgotText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2E7D6B",
  },
  forgotButton: {
    minHeight: 32,
    alignSelf: "flex-end",
    justifyContent: "center",
    marginTop: -6,
    marginBottom: 8,
  },
  loginButton: {
    height: 56,
    backgroundColor: "#2E7D6B",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 0,
    shadowColor: "#2E7D6B",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
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

  signUpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  signUpPrompt: {
    fontSize: 14,
    color: "#6B7C73",
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: "900",
    color: "#2E7D6B",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#CFE8DD",
  },
  orText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7C73",
  },
});
