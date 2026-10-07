import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PublicPetScreen() {
  const pet = {
    name: "Buddy",
    species: "Dog",
    breed: "Golden Retriever",
    sex: "Male",
    color: "Golden",
    identifyingMarks: "Small white mark on the chest.",
    status: "Missing",
    ownerName: "Rainier",
    contactNumber: "09123456789",
  };

  const handleContactOwner = () => {
    Linking.openURL(`tel:${pet.contactNumber}`);
  };

  const handleReportFound = () => {
    Alert.alert(
      "Report Pet Found",
      `Let ${pet.ownerName} know that you found ${pet.name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Report Found",
          onPress: () => {
            Alert.alert(
              "Report Sent",
              `${pet.ownerName} has been notified that ${pet.name} was found.`,
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
        </Pressable>

        <View style={styles.logoRow}>
          <Ionicons name="paw" size={19} color="#2E7D6B" />

          <Text style={styles.logo}>TIMAN</Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.verifiedCard}>
          <Ionicons name="checkmark-circle" size={22} color="#56B091" />

          <View style={styles.verifiedContent}>
            <Text style={styles.verifiedTitle}>TIMAN Pet Profile</Text>

            <Text style={styles.verifiedText}>
              This pet was identified using its registered QR code.
            </Text>
          </View>
        </View>

        <View style={styles.imageCard}>
          <Image
            source={require("../../assets/images/pets.png")}
            style={styles.petImage}
            resizeMode="cover"
          />

          {pet.status === "Missing" && (
            <View style={styles.missingBadge}>
              <Ionicons name="alert-circle" size={15} color="#FFFFFF" />

              <Text style={styles.missingBadgeText}>MISSING</Text>
            </View>
          )}
        </View>

        <View style={styles.petHeader}>
          <Text style={styles.petName}>{pet.name}</Text>

          <Text style={styles.petBreed}>{pet.breed}</Text>
        </View>

        {pet.status === "Missing" && (
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <Ionicons name="heart" size={24} color="#E57373" />
            </View>

            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Help Buddy Get Home</Text>

              <Text style={styles.alertText}>
                Buddy&apos;s owner has marked this pet as missing. If you found
                Buddy, please contact the owner or send a found report below.
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>About {pet.name}</Text>

        <View style={styles.infoCard}>
          <InfoRow icon="paw-outline" label="Species" value={pet.species} />

          <Divider />

          <InfoRow
            icon="information-circle-outline"
            label="Breed"
            value={pet.breed}
          />

          <Divider />

          <InfoRow icon="male-outline" label="Sex" value={pet.sex} />

          <Divider />

          <InfoRow
            icon="color-palette-outline"
            label="Color"
            value={pet.color}
          />
        </View>

        <Text style={styles.sectionTitle}>Identifying Marks</Text>

        <View style={styles.markCard}>
          <Ionicons name="search-outline" size={22} color="#2E7D6B" />

          <Text style={styles.markText}>{pet.identifyingMarks}</Text>
        </View>

        <Text style={styles.sectionTitle}>Pet Owner</Text>

        <View style={styles.ownerCard}>
          <View style={styles.ownerAvatar}>
            <Ionicons name="person-outline" size={24} color="#2E7D6B" />
          </View>

          <View style={styles.ownerInfo}>
            <Text style={styles.ownerLabel}>Owner</Text>

            <Text style={styles.ownerName}>{pet.ownerName}</Text>

            <Text style={styles.ownerPrivacy}>
              Limited information shown for privacy
            </Text>
          </View>

          <Ionicons name="shield-checkmark-outline" size={21} color="#2E7D6B" />
        </View>

        {pet.status === "Missing" && (
          <>
            <Text style={styles.sectionTitle}>Found This Pet?</Text>

            <Pressable
              style={({ pressed }) => [
                styles.contactButton,
                pressed && styles.pressed,
              ]}
              onPress={handleContactOwner}
            >
              <Ionicons name="call-outline" size={21} color="#FFFFFF" />

              <Text style={styles.contactButtonText}>Contact Owner</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.foundButton,
                pressed && styles.pressed,
              ]}
              onPress={handleReportFound}
            >
              <Ionicons name="location-outline" size={21} color="#2E7D6B" />

              <Text style={styles.foundButtonText}>Report Pet Found</Text>
            </Pressable>
          </>
        )}

        <View style={styles.privacyCard}>
          <Ionicons name="lock-closed-outline" size={20} color="#2E7D6B" />

          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Privacy Protected</Text>

            <Text style={styles.privacyText}>
              Only limited pet and owner information is displayed publicly.
              Veterinary and private account information is not available on
              this page.
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>Powered by TIMAN</Text>
      </ScrollView>
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

      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5E9",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },

  headerButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
  },

  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  logo: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#2E7D6B",
  },

  content: {
    paddingHorizontal: 22,
    paddingBottom: 45,
  },

  verifiedCard: {
    backgroundColor: "#CFE8DD",
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  verifiedContent: {
    flex: 1,
    marginLeft: 9,
  },

  verifiedTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E3A34",
  },

  verifiedText: {
    fontSize: 9,
    color: "#6B7C73",
    marginTop: 2,
  },

  imageCard: {
    height: 230,
    borderRadius: 23,
    overflow: "hidden",
    backgroundColor: "#CFE8DD",
    marginTop: 15,
  },

  petImage: {
    width: "100%",
    height: "100%",
  },

  missingBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "#E57373",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  missingBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  petHeader: {
    alignItems: "center",
    marginTop: 16,
  },

  petName: {
    fontSize: 27,
    fontWeight: "900",
    color: "#2E3A34",
  },

  petBreed: {
    fontSize: 12,
    color: "#6B7C73",
    marginTop: 3,
  },

  alertCard: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.14)",
    borderRadius: 17,
    padding: 14,
    flexDirection: "row",
    marginTop: 18,
  },

  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  alertContent: {
    flex: 1,
    marginLeft: 11,
  },

  alertTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#E57373",
  },

  alertText: {
    fontSize: 10,
    lineHeight: 16,
    color: "#E57373",
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 17,
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
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  infoRow: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
  },

  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  infoLabel: {
    flex: 1,
    fontSize: 11,
    color: "#6B7C73",
    marginLeft: 10,
  },

  infoValue: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E3A34",
  },

  divider: {
    height: 1,
    backgroundColor: "#CFE8DD",
  },

  markCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  markText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 11,
    lineHeight: 17,
    color: "#6B7C73",
  },

  ownerCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2E3A34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  ownerAvatar: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  ownerInfo: {
    flex: 1,
    marginLeft: 11,
  },

  ownerLabel: {
    fontSize: 8,
    color: "#6B7C73",
  },

  ownerName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2E3A34",
    marginTop: 2,
  },

  ownerPrivacy: {
    fontSize: 8,
    color: "#6B7C73",
    marginTop: 2,
  },

  contactButton: {
    height: 56,
    backgroundColor: "#2E7D6B",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  contactButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  foundButton: {
    height: 56,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#81C784",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },

  foundButtonText: {
    color: "#81C784",
    fontSize: 14,
    fontWeight: "800",
  },

  privacyCard: {
    backgroundColor: "#CFE8DD",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    marginTop: 25,
  },

  privacyContent: {
    flex: 1,
    marginLeft: 10,
  },

  privacyTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E3A34",
  },

  privacyText: {
    fontSize: 9,
    lineHeight: 15,
    color: "#6B7C73",
    marginTop: 3,
  },

  footer: {
    textAlign: "center",
    fontSize: 9,
    color: "#6B7C73",
    marginTop: 25,
  },

  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
