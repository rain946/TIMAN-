import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
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
  const { width, height } = useWindowDimensions();
  const petHeroHeight = Math.min(Math.max(height * 0.27, 210), 270);
  const petHeroWidth = Math.min(width * 0.96, 595);
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
            { width: Math.min(width, 620) },
            keyboardContentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.backgroundDecorations} pointerEvents="none">
            <View style={styles.topMintShape} />
            <View style={styles.topMintLayer} />
            <View style={styles.sideCreamShape} />
            <View style={styles.bottomMintShape} />
            <Ionicons
              name="paw"
              size={24}
              color="rgba(46, 125, 107, 0.15)"
              style={styles.topPaw}
            />
            <Ionicons
              name="paw"
              size={20}
              color="rgba(250, 183, 98, 0.34)"
              style={styles.bottomPaw}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color="#2E7D6B" />
          </Pressable>

          <View style={styles.branding} pointerEvents="none">
            <Image
              source={require("../../assets/images/timan-wordmark.png")}
              style={styles.wordmark}
              resizeMode="contain"
            />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>

            <Text style={styles.subtitle}>
              Join TIMAN and keep your pet&apos;s records in one place.
            </Text>
          </View>

          <View
            style={[styles.petHeroStage, { height: petHeroHeight }]}
            pointerEvents="none"
          >
            <View style={styles.foliageLeft}>
              <View style={[styles.leaf, styles.leafLeftOne]} />
              <View style={[styles.leaf, styles.leafLeftTwo]} />
              <View style={[styles.leaf, styles.leafLeftThree]} />
            </View>
            <View style={styles.foliageRight}>
              <View style={[styles.leaf, styles.leafRightOne]} />
              <View style={[styles.leaf, styles.leafRightTwo]} />
              <View style={[styles.leaf, styles.leafRightThree]} />
            </View>
            <Image
              source={require("../../assets/images/timan-multi-pet-hero.png")}
              style={{ width: petHeroWidth, height: petHeroHeight }}
              resizeMode="contain"
              accessible
              accessibilityLabel="A dog, cat, rabbit, parrot, guinea pig, and tortoise"
            />
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
            <View style={styles.inputIcon}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#2E7D6B"
              />
            </View>

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
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={21}
                color="#6B7C73"
              />
            </Pressable>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#2E7D6B"
              />
            </View>

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
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
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
      <View style={styles.inputIcon}>
        <Ionicons name={icon} size={20} color="#2E7D6B" />
      </View>

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
    flexGrow: 1,
    boxSizing: "border-box",
    alignSelf: "center",
    paddingBottom: 36,
    position: "relative",
    overflow: "hidden",
  },

  backgroundDecorations: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

  topMintShape: {
    position: "absolute",
    width: 265,
    height: 230,
    borderRadius: 120,
    right: -105,
    top: -112,
    backgroundColor: "#CFE8DD",
    transform: [{ rotate: "18deg" }],
  },

  topMintLayer: {
    position: "absolute",
    width: 170,
    height: 165,
    borderRadius: 86,
    right: -63,
    top: -84,
    backgroundColor: "rgba(86, 176, 145, 0.35)",
    transform: [{ rotate: "-12deg" }],
  },

  sideCreamShape: {
    position: "absolute",
    width: 150,
    height: 230,
    borderRadius: 80,
    left: -112,
    top: 310,
    backgroundColor: "rgba(250, 215, 160, 0.62)",
    transform: [{ rotate: "-18deg" }],
  },

  bottomMintShape: {
    position: "absolute",
    width: 310,
    height: 250,
    borderRadius: 150,
    right: -150,
    bottom: -145,
    backgroundColor: "rgba(207, 232, 221, 0.7)",
    transform: [{ rotate: "21deg" }],
  },

  topPaw: {
    position: "absolute",
    left: 24,
    top: 108,
    transform: [{ rotate: "-18deg" }],
  },

  bottomPaw: {
    position: "absolute",
    right: 24,
    bottom: 86,
    transform: [{ rotate: "17deg" }],
  },

  backButton: {
    position: "absolute",
    left: 14,
    top: 5,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.76)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },

  branding: {
    alignItems: "center",
    paddingTop: 12,
    zIndex: 1,
  },

  wordmark: {
    width: 190,
    height: 62,
  },

  header: {
    alignItems: "center",
    marginTop: 1,
    marginBottom: 7,
    zIndex: 1,
  },

  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: "#0B6658",
  },

  subtitle: {
    marginTop: 5,
    textAlign: "center",
    color: "#6B7C73",
    fontSize: 14.5,
    lineHeight: 20,
    paddingHorizontal: 20,
    maxWidth: 390,
  },

  petHeroStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
    marginBottom: 8,
    zIndex: 1,
  },

  foliageLeft: {
    position: "absolute",
    left: -22,
    bottom: 10,
    width: 100,
    height: 125,
    zIndex: 0,
  },

  foliageRight: {
    position: "absolute",
    right: -22,
    bottom: 7,
    width: 100,
    height: 125,
    zIndex: 0,
  },

  leaf: {
    position: "absolute",
    width: 30,
    height: 70,
    borderTopLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: "#2E7D6B",
  },

  leafLeftOne: {
    left: 5,
    bottom: 0,
    transform: [{ rotate: "-24deg" }],
  },

  leafLeftTwo: {
    left: 35,
    bottom: 23,
    backgroundColor: "#56B091",
    transform: [{ rotate: "17deg" }, { scale: 0.82 }],
  },

  leafLeftThree: {
    left: 63,
    bottom: -3,
    backgroundColor: "#CFE8DD",
    transform: [{ rotate: "38deg" }, { scale: 0.86 }],
  },

  leafRightOne: {
    right: 5,
    bottom: 0,
    transform: [{ rotate: "28deg" }],
  },

  leafRightTwo: {
    right: 35,
    bottom: 23,
    backgroundColor: "#56B091",
    transform: [{ rotate: "-17deg" }, { scale: 0.82 }],
  },

  leafRightThree: {
    right: 63,
    bottom: -3,
    backgroundColor: "#CFE8DD",
    transform: [{ rotate: "-38deg" }, { scale: 0.86 }],
  },

  label: {
    fontSize: 16,
    color: "#2E3A34",
    fontWeight: "800",
    marginHorizontal: 20,
    marginBottom: 9,
    zIndex: 1,
  },

  roleContainer: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 18,
    zIndex: 1,
  },

  roleButton: {
    flex: 1,
    minWidth: 0,
    height: 62,
    borderWidth: 1.5,
    borderColor: "#2E7D6B",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
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
    minHeight: 62,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    marginHorizontal: 20,
    marginBottom: 11,
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    zIndex: 1,
  },

  inputIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E7F3ED",
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    marginLeft: 11,
    fontSize: 16,
    color: "#2E3A34",
    paddingVertical: 13,
  },

  signUpButton: {
    height: 58,
    backgroundColor: "#2E7D6B",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 8,
    shadowColor: "#2E7D6B",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 1,
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
    marginTop: 14,
    zIndex: 1,
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
