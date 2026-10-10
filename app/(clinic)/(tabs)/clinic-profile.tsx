import { AppAlert as Alert } from "@/components/dialogs/AppDialog";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { timanShadow } from "../../../components/timan/theme";

import ChangePasswordModal from "../../../components/modals/ChangePasswordModal";
import EditProfileModal from "../../../components/modals/EditProfileModal";
import { API_URL, getImageUrl } from "../../../config/api";
import { unregisterDevicePushToken } from "../../../services/notificationService";

type ClinicProfile = {
  user_id: number;
  full_name: string;
  email: string;
  contact_number: string;
  address: string;
  role: string;
  clinic_name?: string | null;
  profile_photo_url?: string | null;
};

export default function ClinicProfileScreen() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const requestInFlight = useRef(false);

  const loadProfile = useCallback(async (showLoading = true) => {
    if (requestInFlight.current) {
      setRefreshing(false);
      return;
    }
    requestInFlight.current = true;

    try {
      if (showLoading) setLoading(true);
      setError(false);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/profile`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const responseText = await response.text();
      let data: any = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText };
      }

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load profile.");
      }

      setProfile(data.user);
      setProfilePhoto(getImageUrl(data.user.profile_photo_url));
    } catch (loadError) {
      console.log("CLINIC PROFILE LOAD ERROR:", loadError);
      setError(true);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleProfileUpdated = (updatedProfile: ClinicProfile) => {
    setProfile(updatedProfile);
    void loadProfile(false);
  };

  const uploadProfilePhoto = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]?.uri || !profile?.user_id) return;

    const asset = result.assets[0];
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("photo", {
        uri: asset.uri,
        name: asset.fileName || `clinic-${profile.user_id}.jpg`,
        type: asset.mimeType || "image/jpeg",
      } as any);

      const response = await fetch(`${API_URL}/profile/photo`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update profile photo.");
      }

      setProfilePhoto(getImageUrl(data.profile_photo_url));
      setProfile((current) =>
        current
          ? {
              ...current,
              profile_photo_url: data.profile_photo_url,
            }
          : current,
      );
    } catch (uploadError) {
      Alert.alert(
        "Upload Failed",
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to update profile photo.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const chooseFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow TIMAN to access your photos.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    await uploadProfilePhoto(result);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow TIMAN to use your camera.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    await uploadProfilePhoto(result);
  };

  const chooseProfilePhoto = () => {
    Alert.alert("Clinic Photo", "Choose where to get your clinic photo.", [
      { text: "Take Photo", onPress: () => void takePhoto() },
      { text: "Choose from Gallery", onPress: () => void chooseFromGallery() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("Log Out?", "Are you sure you want to log out of TIMAN?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await unregisterDevicePushToken();
            await AsyncStorage.multiRemove([
              "token",
              "user",
              "timan_expo_push_token",
            ]);
            router.replace("/login");
          } catch (logoutError) {
            console.error("CLINIC LOGOUT ERROR:", logoutError);
            Alert.alert(
              "Log Out Failed",
              "Unable to log out. Please try again.",
            );
          }
        },
      },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    void loadProfile(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clinic Profile</Text>
      </View>

      {loading && !profile ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2E7D6B" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : error && !profile ? (
        <View style={styles.stateContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={30} color="#E57373" />
          </View>
          <Text style={styles.stateTitle}>Unable to load profile.</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
            onPress={() => loadProfile()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2E7D6B"
              colors={["#2E7D6B"]}
            />
          }
        >
          {error && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.inlineError,
                pressed && styles.pressed,
              ]}
              onPress={() => loadProfile(false)}
            >
              <Ionicons name="alert-circle-outline" size={19} color="#E57373" />
              <Text style={styles.inlineErrorText}>
                Unable to refresh profile. Tap to retry.
              </Text>
            </Pressable>
          )}

          <View style={styles.identityCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change clinic profile photo"
              disabled={uploadingPhoto}
              onPress={chooseProfilePhoto}
              style={({ pressed }) => [
                styles.clinicIconOuter,
                pressed && styles.pressed,
              ]}
            >
              {profilePhoto ? (
                <Image
                  source={{ uri: profilePhoto }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.clinicIconInner}>
                  <Ionicons name="medkit" size={38} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.cameraButton}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={15} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
            <Text style={styles.clinicName} numberOfLines={2}>
              {profile?.clinic_name ||
                profile?.full_name ||
                "Veterinary Clinic"}
            </Text>
            <View style={styles.roleBadge}>
              <Ionicons name="medical" size={13} color="#2E7D6B" />
              <Text style={styles.roleBadgeText}>Veterinary Clinic</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Clinic Information</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon="business-outline"
              label="Clinic Name"
              value={profile?.clinic_name || "Not provided"}
            />
            <Divider />
            <InfoRow
              icon="person-outline"
              label="Representative / Full Name"
              value={profile?.full_name || "Not provided"}
            />
            <Divider />
            <InfoRow
              icon="mail-outline"
              label="Email"
              value={profile?.email || "Not provided"}
            />
            <Divider />
            <InfoRow
              icon="call-outline"
              label="Contact Number"
              value={profile?.contact_number || "Not provided"}
            />
            <Divider />
            <InfoRow
              icon="location-outline"
              label="Address"
              value={profile?.address || "Not provided"}
            />
          </View>

          <Text style={styles.sectionTitle}>Clinic Management</Text>
          <View style={styles.actionCard}>
            <ActionRow
              icon="document-text-outline"
              title="Veterinary Records"
              description="View records created for authorized pets"
              onPress={() => router.push("/(clinic)/(tabs)/vet-records")}
            />
            <Divider inset />
            <ActionRow
              icon="bar-chart-outline"
              title="Clinic Reports"
              description="View accurate clinic schedule and treatment totals"
              onPress={() => router.push("/(clinic)/clinic-reports")}
            />
          </View>

          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.actionCard}>
            <ActionRow
              icon="create-outline"
              title="Edit Profile"
              description="Update clinic and contact information"
              onPress={() => setEditProfileVisible(true)}
            />
            <Divider inset />
            <ActionRow
              icon="lock-closed-outline"
              title="Change Password"
              description="Update your account password"
              onPress={() => setChangePasswordVisible(true)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.pressed,
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={21} color="#E57373" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </ScrollView>
      )}

      <EditProfileModal
        visible={editProfileVisible}
        profile={profile}
        onClose={() => setEditProfileVisible(false)}
        onUpdated={handleProfileUpdated}
      />
      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#64B5F6" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.actionRow,
        pressed && styles.actionPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color="#2E7D6B" />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#6B7C73" />
    </Pressable>
  );
}

function Divider({ inset = false }: { inset?: boolean }) {
  return <View style={[styles.divider, inset && styles.dividerInset]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  header: {
    minHeight: 60,
    paddingHorizontal: 20,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#2E3A34" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160 },
  stateContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7C73" },
  errorIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: "900",
    color: "#2E3A34",
  },
  retryButton: {
    minWidth: 112,
    minHeight: 44,
    marginTop: 17,
    borderRadius: 13,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  inlineError: {
    minHeight: 48,
    marginBottom: 14,
    borderRadius: 13,
    paddingHorizontal: 13,
    backgroundColor: "#FFF5E9",
    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.14)",
    flexDirection: "row",
    alignItems: "center",
  },
  inlineErrorText: { flex: 1, marginLeft: 9, fontSize: 12, color: "#E57373" },
  identityCard: {
    minHeight: 232,
    borderRadius: 22,
    padding: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
  },
  clinicIconOuter: {
    width: 92,
    height: 92,
    borderRadius: 29,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  clinicIconInner: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: { width: 92, height: 92, borderRadius: 29 },
  cameraButton: {
    position: "absolute",
    right: -3,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2E7D6B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  clinicName: {
    maxWidth: 290,
    marginTop: 14,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2E3A34",
    textAlign: "center",
  },
  roleBadge: {
    minHeight: 29,
    marginTop: 9,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "900", color: "#2E7D6B" },
  sectionTitle: {
    marginTop: 27,
    marginBottom: 12,
    fontSize: 19,
    fontWeight: "900",
    color: "#2E3A34",
  },
  infoCard: {
    ...timanShadow,
    borderRadius: 19,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  infoRow: {
    minHeight: 72,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: { flex: 1, minWidth: 0, marginLeft: 12 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7C73",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  infoValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#2E3A34",
  },
  divider: { height: 1, backgroundColor: "#FFF5E9" },
  dividerInset: { marginLeft: 65 },
  actionCard: {
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    overflow: "hidden",
  },
  actionRow: {
    minHeight: 76,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  actionPressed: { backgroundColor: "#FFF5E9" },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  actionContent: { flex: 1, marginLeft: 12 },
  actionTitle: { fontSize: 15, fontWeight: "900", color: "#2E3A34" },
  actionDescription: { marginTop: 3, fontSize: 11, color: "#6B7C73" },
  logoutButton: {
    minHeight: 54,
    marginTop: 28,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { fontSize: 14, fontWeight: "900", color: "#E57373" },
  pressed: { opacity: 0.72 },
});
