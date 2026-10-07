import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { timanShadow } from "../../components/timan/theme";
import EditProfileModal from "../../components/modals/EditProfileModal";
import ChangePasswordModal from "../../components/modals/ChangePasswordModal";

import { API_URL, getImageUrl } from "../../config/api";
import { unregisterDevicePushToken } from "../../services/notificationService";

type OwnerProfile = {
  user_id: number;
  full_name: string;
  email: string;
  contact_number: string;
  address: string;
  role: string;
  clinic_name?: string | null;
  profile_photo_url?: string | null;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const [editProfileVisible, setEditProfileVisible] = useState(false);

  const [changePasswordVisible, setChangePasswordVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load profile.");
      }

      setProfile(data.user);

      const savedPhoto = await AsyncStorage.getItem(
        `owner_profile_photo_${data.user.user_id}`,
      );
      setProfilePhoto(getImageUrl(data.user.profile_photo_url) || savedPhoto);
    } catch (error) {
      console.error("LOAD PROFILE ERROR:", error);

      Alert.alert(
        "Profile Error",
        error instanceof Error ? error.message : "Unable to load profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleProfileUpdated = (updatedProfile: OwnerProfile) => {
    setProfile(updatedProfile);
  };

  const saveProfilePhoto = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]?.uri || !profile?.user_id) {
      return;
    }

    const asset = result.assets[0];
    const token = await AsyncStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("photo", {
        uri: asset.uri,
        name: asset.fileName || `owner-${profile.user_id}.jpg`,
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

      const photoUrl = getImageUrl(data.profile_photo_url) || asset.uri;
      setProfilePhoto(photoUrl);
      await AsyncStorage.setItem(
        `owner_profile_photo_${profile.user_id}`,
        photoUrl,
      );
      setProfile((current) =>
        current
          ? {
              ...current,
              profile_photo_url: data.profile_photo_url,
            }
          : current,
      );
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        error instanceof Error
          ? error.message
          : "Unable to update profile photo.",
      );
    }
  };

  const chooseProfilePhotoFromGallery = async () => {
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

    await saveProfilePhoto(result);
  };

  const takeProfilePhoto = async () => {
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

    await saveProfilePhoto(result);
  };

  const chooseProfilePhoto = () => {
    Alert.alert("Profile Photo", "Choose where to get your profile photo.", [
      {
        text: "Take Photo",
        onPress: () => {
          void takeProfilePhoto();
        },
      },
      {
        text: "Choose from Gallery",
        onPress: () => {
          void chooseProfilePhotoFromGallery();
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out of TIMAN?", [
      {
        text: "Cancel",
        style: "cancel",
      },
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
          } catch (error) {
            console.error("LOGOUT ERROR:", error);

            Alert.alert(
              "Log Out Failed",
              "Unable to log out. Please try again.",
            );
          }
        },
      },
    ]);
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingProfileText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.profileCard}>
          <Pressable
            onPress={chooseProfilePhoto}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={42} color="#2E7D6B" />
            )}

            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={15} color="#FFFFFF" />
            </View>
          </Pressable>

          <Text style={styles.ownerName}>
            {profile?.full_name || "Pet Owner"}
          </Text>

          <View style={styles.ownerBadge}>
            <Ionicons name="paw" size={14} color="#56B091" />

            <Text style={styles.ownerBadgeText}>Pet Owner</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Account Information</Text>

        <View style={styles.infoCard}>
          <InfoRow
            icon="person-outline"
            label="Full Name"
            value={profile?.full_name || ""}
          />

          <Divider />

          <InfoRow
            icon="mail-outline"
            label="Email"
            value={profile?.email || ""}
          />

          <Divider />

          <InfoRow
            icon="call-outline"
            label="Contact Number"
            value={profile?.contact_number || ""}
          />

          <Divider />

          <InfoRow
            icon="location-outline"
            label="Address"
            value={profile?.address || ""}
          />
        </View>

        <Text style={styles.sectionTitle}>Pet Management</Text>

        <View style={styles.menuCard}>
          <MenuItem
            icon="shield-checkmark-outline"
            title="Clinic Authorization"
            description="Review and manage clinic access requests"
            onPress={() => router.push("/clinic-authorization")}
          />

          <MenuDivider />

          <MenuItem
            icon="archive-outline"
            title="Archived Pets"
            description="View or restore hidden pets"
            onPress={() => router.push("/(pets)/archived-pets")}
          />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.menuCard}>
          <MenuItem
            icon="create-outline"
            title="Edit Profile"
            description="Update your personal information"
            onPress={() => setEditProfileVisible(true)}
          />

          <MenuDivider />

          <MenuItem
            icon="lock-closed-outline"
            title="Change Password"
            description="Update your account password"
            onPress={() => setChangePasswordVisible(true)}
          />
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Ionicons name="shield-checkmark" size={25} color="#2E7D6B" />
          </View>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Your Information is Protected
            </Text>

            <Text style={styles.securityText}>
              TIMAN only displays limited owner information on a pet&apos;s
              public QR profile. Private account and veterinary information is
              not publicly shown.
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={21} color="#E57373" />

          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <View style={styles.appInfo}>
          <View style={styles.appLogo}>
            <Ionicons name="paw" size={19} color="#2E7D6B" />

            <Text style={styles.appName}>TIMAN</Text>
          </View>

          <Text style={styles.version}>Version 1.0.0</Text>
        </View>
      </ScrollView>

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

function MenuItem({
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
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
      onPress={onPress}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={21} color="#2E7D6B" />
      </View>

      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>

        <Text style={styles.menuDescription}>{description}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#6B7C73" />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function MenuDivider() {
  return <View style={styles.menuDivider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5E9",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#2E3A34",
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  profileCard: {
    ...timanShadow,
    backgroundColor: "#CFE8DD",
    borderRadius: 22,
    paddingVertical: 24,
    alignItems: "center",
    marginTop: 20,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#CFE8DD",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 41,
  },

  cameraButton: {
    position: "absolute",
    right: -2,
    bottom: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2E7D6B",
    borderWidth: 2,
    borderColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  ownerName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2E3A34",
    marginTop: 12,
  },

  ownerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },

  ownerBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#56B091",
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#2E3A34",
    marginTop: 25,
    marginBottom: 11,
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 17,
    paddingHorizontal: 14,
  },

  infoRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
  },

  infoIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoLabel: {
    fontSize: 11,
    color: "#6B7C73",
  },

  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#56B091",
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: "#CFE8DD",
  },

  menuCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 17,
    overflow: "hidden",
  },

  menuItem: {
    minHeight: 70,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  menuPressed: {
    backgroundColor: "#FFF5E9",
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  menuContent: {
    flex: 1,
    marginLeft: 11,
  },

  menuTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2E3A34",
  },

  menuDescription: {
    fontSize: 12,
    color: "#6B7C73",
    marginTop: 3,
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#CFE8DD",
    marginLeft: 67,
  },

  securityCard: {
    backgroundColor: "#CFE8DD",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    marginTop: 25,
  },

  securityIcon: {
    width: 43,
    height: 43,
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
    fontSize: 13,
    fontWeight: "800",
    color: "#2E3A34",
  },

  securityText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#6B7C73",
    marginTop: 3,
  },

  logoutButton: {
    height: 54,
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 14,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  logoutText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#E57373",
  },

  appInfo: {
    alignItems: "center",
    marginTop: 28,
  },

  appLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  appName: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#2E7D6B",
  },

  version: {
    fontSize: 10,
    color: "#6B7C73",
    marginTop: 4,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF5E9",
  },

  loadingProfileText: {
    marginTop: 10,
    fontSize: 14,
    color: "#6B7C73",
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
