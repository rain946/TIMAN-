import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EditProfileModal from "../../components/EditProfileModal";
import ChangePasswordModal from "../../components/ChangePasswordModal";

import { API_URL } from "../../config/api";


type OwnerProfile = {
  user_id: number;
  full_name: string;
  email: string;
  contact_number: string;
  address: string;
  role: string;
  clinic_name?: string | null;
};

export default function ProfileScreen() {
  const [profile, setProfile] =
    useState<OwnerProfile | null>(null);

  const [loading, setLoading] =
    useState(true);

  // Edit Profile modal
  const [
    editProfileVisible,
    setEditProfileVisible,
  ] = useState(false);

  // Change Password modal
  const [
    changePasswordVisible,
    setChangePasswordVisible,
  ] = useState(false);

  // ===================================================
  // LOAD PROFILE
  // ===================================================

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to load profile."
        );
      }

      setProfile(data.user);
    } catch (error) {
      console.error(
        "LOAD PROFILE ERROR:",
        error
      );

      Alert.alert(
        "Profile Error",
        error instanceof Error
          ? error.message
          : "Unable to load profile."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ===================================================
  // RELOAD WHEN PROFILE GAINS FOCUS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // ===================================================
  // PROFILE UPDATED
  // ===================================================

  const handleProfileUpdated = (
    updatedProfile: OwnerProfile
  ) => {
    setProfile(updatedProfile);
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of TIMAN?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                "token",
                "user",
              ]);

              router.replace("/login");
            } catch (error) {
              console.error(
                "LOGOUT ERROR:",
                error
              );

              Alert.alert(
                "Log Out Failed",
                "Unable to log out. Please try again."
              );
            }
          },
        },
      ]
    );
  };


  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text style={styles.loadingProfileText}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Profile
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons
              name="person"
              size={42}
              color="#176B3A"
            />
          </View>

          <Text style={styles.ownerName}>
            {profile?.full_name || "Pet Owner"}
          </Text>

          <Text style={styles.ownerEmail}>
           {profile?.email || ""}
          </Text>

          <View style={styles.ownerBadge}>
            <Ionicons
              name="paw"
              size={14}
              color="#267542"
            />

            <Text style={styles.ownerBadgeText}>
              Pet Owner
            </Text>
          </View>
        </View>

        {/* ACCOUNT INFORMATION */}
        <Text style={styles.sectionTitle}>
          Account Information
        </Text>

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

        {/* ACCOUNT */}
        <Text style={styles.sectionTitle}>
          Account
        </Text>

        <View style={styles.menuCard}>
          {/* EDIT PROFILE */}
          <MenuItem
            icon="create-outline"
            title="Edit Profile"
            description="Update your personal information"
            onPress={() =>
              setEditProfileVisible(true)
            }
          />

          <MenuDivider />

          {/* CHANGE PASSWORD */}
          <MenuItem
            icon="lock-closed-outline"
            title="Change Password"
            description="Update your account password"
            onPress={() =>
              setChangePasswordVisible(true)
            }
          />
        </View>

        {/* PRIVACY */}
        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Ionicons
              name="shield-checkmark"
              size={25}
              color="#176B3A"
            />
          </View>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Your Information is Protected
            </Text>

            <Text style={styles.securityText}>
              TIMAN only displays limited owner
              information on a pet&apos;s public QR
              profile. Private account and veterinary
              information is not publicly shown.
            </Text>
          </View>
        </View>

        {/* LOG OUT */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out-outline"
            size={21}
            color="#A14343"
          />

          <Text style={styles.logoutText}>
            Log Out
          </Text>
        </Pressable>

        {/* APP INFORMATION */}
        <View style={styles.appInfo}>
          <View style={styles.appLogo}>
            <Ionicons
              name="paw"
              size={19}
              color="#176B3A"
            />

            <Text style={styles.appName}>
              TIMAN
            </Text>
          </View>

          <Text style={styles.version}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>


      <EditProfileModal
        visible={editProfileVisible}
        profile={profile}
        onClose={() =>
          setEditProfileVisible(false)
        }
        onUpdated={handleProfileUpdated}
      />

      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() =>
          setChangePasswordVisible(false)
        }
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
        <Ionicons
          name={icon}
          size={18}
          color="#176B3A"
        />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
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
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuIcon}>
        <Ionicons
          name={icon}
          size={21}
          color="#176B3A"
        />
      </View>

      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>
          {title}
        </Text>

        <Text style={styles.menuDescription}>
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color="#A0AAA4"
      />
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
    backgroundColor: "#FFFDF7",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EE",
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1E2D24",
  },

  content: {
    paddingHorizontal: 22,
    paddingBottom: 110,
  },

  profileCard: {
    backgroundColor: "#EAF4EB",
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
    borderColor: "#CFE4D1",
  },

  ownerName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#26392D",
    marginTop: 12,
  },

  ownerEmail: {
    fontSize: 10,
    color: "#718077",
    marginTop: 4,
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
    fontSize: 9,
    fontWeight: "800",
    color: "#267542",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E2D24",
    marginTop: 25,
    marginBottom: 11,
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
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
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoLabel: {
    fontSize: 8,
    color: "#929C96",
  },

  infoValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4C5B52",
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF1EF",
  },

  menuCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
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
    backgroundColor: "#F5F8F5",
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  menuContent: {
    flex: 1,
    marginLeft: 11,
  },

  menuTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3A4A40",
  },

  menuDescription: {
    fontSize: 9,
    color: "#89948D",
    marginTop: 3,
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#EEF1EF",
    marginLeft: 67,
  },

  securityCard: {
    backgroundColor: "#EAF4EB",
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
    fontSize: 11,
    fontWeight: "800",
    color: "#294C34",
  },

  securityText: {
    fontSize: 9,
    lineHeight: 15,
    color: "#66766B",
    marginTop: 3,
  },

  logoutButton: {
    height: 54,
    backgroundColor: "#FFF8F8",
    borderWidth: 1,
    borderColor: "#E8CECE",
    borderRadius: 14,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  logoutText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#A14343",
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
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#176B3A",
  },

  version: {
    fontSize: 8,
    color: "#A0AAA4",
    marginTop: 4,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFDF7",
  },

  loadingProfileText: {
    marginTop: 10,
    fontSize: 12,
    color: "#7B877F",
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
