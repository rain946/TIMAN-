import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useState, useRef } from "react";

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

import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { API_URL, getImageUrl } from "../../config/api";





type Pet = {
  pet_id: number;
  owner_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  sex: string;
  birth_date: string | null;
  color: string | null;
  identifying_marks: string | null;
  photo_url: string | null;
  qr_code: string | null;
  pet_status: "Safe" | "Missing" | "Found";
  created_at: string;
};



export default function PetQRScreen() {
  const { petId } = useLocalSearchParams<{
    petId?: string;
  }>();

  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);

  const qrRef = useRef<any>(null);
  const [savingQR, setSavingQR] = useState(false);

  const saveQRCode = async () => {
    if (!qrRef.current || !pet) {
      Alert.alert(
        "QR Unavailable",
        "The QR code is not ready yet."
      );
      return;
    }

    try {
      setSavingQR(true);

      const permission =
        await MediaLibrary.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow TIMAN to save images to your device."
        );
        return;
      }

      qrRef.current.toDataURL(async (data: string) => {
        try {
          const fileName =
            `TIMAN-${pet.pet_name.replace(/\s+/g, "-")}-QR.png`;

          const fileUri =
            `${FileSystem.cacheDirectory}${fileName}`;

          await FileSystem.writeAsStringAsync(
            fileUri,
            data,
            {
              encoding:
                FileSystem.EncodingType.Base64,
            }
          );

          await MediaLibrary.saveToLibraryAsync(
            fileUri
          );

          Alert.alert(
            "QR Saved",
            `${pet.pet_name}'s QR code has been saved to your gallery.`
          );
        } catch (error) {
          console.log(
            "SAVE QR ERROR:",
            error
          );

          Alert.alert(
            "Save Failed",
            "Unable to save the QR code."
          );
        } finally {
          setSavingQR(false);
        }
      });
    } catch (error) {
      console.log(
        "QR PERMISSION ERROR:",
        error
      );

      setSavingQR(false);

      Alert.alert(
        "Save Failed",
        "Unable to save the QR code."
      );
    }
  };


  const loadPet = useCallback(async () => {
    if (!petId) {
      setLoading(false);

      Alert.alert(
        "Pet Error",
        "No pet was selected.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );

      return;
    }

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
        `${API_URL}/pets/${petId}`,
        {
          method: "GET",

          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const responseText =
        await response.text();

      let data: any = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        data = {
          message: responseText,
        };
      }

      console.log(
        "PET QR STATUS:",
        response.status
      );

      console.log(
        "PET QR RESPONSE:",
        data
      );

      if (!response.ok) {
        Alert.alert(
          "Unable to Load QR",
          data.message ||
            "Unable to load pet information."
        );

        return;
      }

      setPet(data.pet);
    } catch (error) {
      console.log(
        "PET QR ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    } finally {
      setLoading(false);
    }
  }, [petId]);


  useFocusEffect(
    useCallback(() => {
      loadPet();

      return () => {};
    }, [loadPet])
  );


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text style={styles.loadingText}>
            Loading pet QR...
          </Text>
        </View>
      </SafeAreaView>
    );
  }




  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.center}>
          <Ionicons
            name="qr-code-outline"
            size={70}
            color="#91A097"
          />

          <Text style={styles.errorTitle}>
            QR unavailable
          </Text>

          <Text style={styles.errorText}>
            Unable to load this pet&apos;s QR code.
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  const photoUrl =
    getImageUrl(pet.photo_url);

  const petCode =
    `PET-${String(pet.pet_id).padStart(
      4,
      "0"
    )}`;

  const PUBLIC_WEB_URL =
    "https://bundle-inn-varies-colin.trycloudflare.com";

  const publicProfileUrl = pet.qr_code
    ? `${PUBLIC_WEB_URL}/public/pet/${encodeURIComponent(
        pet.qr_code
      )}`
    : null;


  return (
    <SafeAreaView style={styles.container}>
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        <View style={styles.titleSection}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="qr-code"
              size={28}
              color="#176B3A"
            />
          </View>

          <Text style={styles.title}>
            Permanent Pet QR
          </Text>

          <Text style={styles.subtitle}>
            This QR is permanently assigned to{" "}
            {pet.pet_name}.
          </Text>
        </View>


        <View style={styles.petCard}>
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image
                source={{
                  uri: photoUrl,
                }}
                style={styles.petPhoto}
                resizeMode="cover"
              />
            ) : (
              <View
                style={
                  styles.photoPlaceholder
                }
              >
                <Ionicons
                  name="paw"
                  size={30}
                  color="#7EA48A"
                />
              </View>
            )}
          </View>

          <View style={styles.petInformation}>
            <Text style={styles.petName}>
              {pet.pet_name}
            </Text>

            <Text style={styles.petDetails}>
              {pet.breed ||
                pet.species}
            </Text>

            <Text style={styles.petCode}>
              {petCode}
            </Text>
          </View>

          <StatusBadge
            status={pet.pet_status}
          />
        </View>


        <View style={styles.qrCard}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="paw"
              size={21}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.brand}>
            TIMAN
          </Text>

          <Text style={styles.qrLabel}>
            PERMANENT PET IDENTIFICATION
          </Text>

          <View style={styles.qrBox}>
            {publicProfileUrl ? (
              <QRCode
                value={publicProfileUrl}
                size={220}
                backgroundColor="#FFFFFF"
                color="#173D2A"
                getRef={(ref) => {
                  qrRef.current = ref;
                }}
              />
            ) : (
              <View style={styles.noQr}>
                <Ionicons
                  name="qr-code-outline"
                  size={70}
                  color="#9BA69F"
                />

                <Text style={styles.noQrText}>
                  No permanent QR assigned
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.qrPetName}>
            {pet.pet_name}
          </Text>

          <Text style={styles.qrPetCode}>
            {petCode}
          </Text>

          <View style={styles.permanentBadge}>
            <Ionicons
              name="shield-checkmark"
              size={16}
              color="#176B3A"
            />

            <Text style={styles.permanentText}>
              Permanent QR
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.saveQRButton,
              pressed && styles.buttonPressed,
              savingQR && styles.disabledButton,
            ]}
            onPress={saveQRCode}
            disabled={savingQR || !publicProfileUrl}
          >
            {savingQR ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Ionicons
                name="download-outline"
                size={21}
                color="#FFFFFF"
              />
            )}

            <Text style={styles.saveQRText}>
              {savingQR
                ? "Saving..."
                : "Save QR Code"}
            </Text>
          </Pressable>
        </View>


        <Text style={styles.sectionTitle}>
          How it works
        </Text>

        <View style={styles.stepsCard}>
          <Step
            number="1"
            icon="pricetag-outline"
            title="Attach QR Tag"
            description="Place this permanent QR on the pet's collar."
          />

          <Divider />

          <Step
            number="2"
            icon="scan-outline"
            title="Finder Scans QR"
            description="Anyone can scan it using a normal phone camera."
          />

          <Divider />

          <Step
            number="3"
            icon="globe-outline"
            title="Public Profile Opens"
            description="The finder sees limited information needed to identify the pet."
          />

          <Divider />

          <Step
            number="4"
            icon="call-outline"
            title="Contact Owner"
            description="The finder can use the public profile to contact the owner."
          />
        </View>


        <Pressable
          style={({ pressed }) => [
            styles.doneButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.doneText}>
            Done
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}


function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => router.back()}
      >
        <Ionicons
          name="chevron-back"
          size={27}
          color="#173D2A"
        />
      </Pressable>

      <Text style={styles.headerTitle}>
        Pet QR Code
      </Text>

      <View style={styles.headerButton} />
    </View>
  );
}


function StatusBadge({
  status,
}: {
  status: Pet["pet_status"];
}) {
  let badgeStyle =
    styles.safeBadge;

  let textStyle =
    styles.safeText;

  if (status === "Missing") {
    badgeStyle =
      styles.missingBadge;

    textStyle =
      styles.missingText;
  }

  if (status === "Found") {
    badgeStyle =
      styles.foundBadge;

    textStyle =
      styles.foundText;
  }

  return (
    <View
      style={[
        styles.statusBadge,
        badgeStyle,
      ]}
    >
      <View
        style={[
          styles.statusDot,

          status === "Missing" &&
            styles.missingDot,

          status === "Found" &&
            styles.foundDot,
        ]}
      />

      <Text
        style={[
          styles.statusText,
          textStyle,
        ]}
      >
        {status}
      </Text>
    </View>
  );
}


function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>
          {number}
        </Text>
      </View>

      <View style={styles.stepIcon}>
        <Ionicons
          name={icon}
          size={21}
          color="#176B3A"
        />
      </View>

      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>
          {title}
        </Text>

        <Text
          style={
            styles.stepDescription
          }
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  return (
    <View style={styles.divider} />
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },

  header: {
    height: 64,
    paddingHorizontal: 20,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EE",
  },

  headerButton: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E2D24",
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 23,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#7A867F",
  },

  errorTitle: {
    marginTop: 15,
    fontSize: 22,
    fontWeight: "800",
    color: "#26352B",
  },

  errorText: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: "#7A867F",
    textAlign: "center",
  },


  titleSection: {
    alignItems: "center",
    marginBottom: 22,
  },

  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#E8F3EA",

    alignItems: "center",
    justifyContent: "center",

    marginBottom: 11,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1E2D24",
  },

  subtitle: {
    marginTop: 7,
    maxWidth: 320,

    fontSize: 15,
    lineHeight: 21,

    textAlign: "center",
    color: "#7A867F",
  },


  petCard: {
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 17,

    padding: 14,

    flexDirection: "row",
    alignItems: "center",

    marginBottom: 18,
  },

  photoContainer: {
    width: 66,
    height: 66,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#E8F2E9",
  },

  petPhoto: {
    width: "100%",
    height: "100%",
  },

  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  petInformation: {
    flex: 1,
    marginLeft: 13,
  },

  petName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#26352B",
  },

  petDetails: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    color: "#7B877F",
  },

  petCode: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
    color: "#176B3A",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,

    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#267542",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },

  safeBadge: {
    backgroundColor: "#E6F3E8",
  },

  safeText: {
    color: "#267542",
  },

  missingBadge: {
    backgroundColor: "#FDE7E4",
  },

  missingText: {
    color: "#B64236",
  },

  missingDot: {
    backgroundColor: "#B64236",
  },

  foundBadge: {
    backgroundColor: "#FFF1CF",
  },

  foundText: {
    color: "#8C6A16",
  },

  foundDot: {
    backgroundColor: "#8C6A16",
  },


  qrCard: {
    backgroundColor: "#FFFFFF",

    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DDE7E0",

    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 25,

    alignItems: "center",
  },

  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,

    backgroundColor: "#176B3A",

    alignItems: "center",
    justifyContent: "center",
  },

  brand: {
    marginTop: 9,

    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,

    color: "#173D2A",
  },

  qrLabel: {
    marginTop: 4,

    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,

    color: "#89958E",
  },

  qrBox: {
    marginTop: 20,

    width: 255,
    height: 255,

    borderRadius: 17,

    borderWidth: 1,
    borderColor: "#E2E8E4",

    backgroundColor: "#FFFFFF",

    alignItems: "center",
    justifyContent: "center",
  },

  noQr: {
    alignItems: "center",
  },

  noQrText: {
    marginTop: 9,
    fontSize: 14,
    color: "#89958E",
  },

  qrPetName: {
    marginTop: 17,

    fontSize: 25,
    fontWeight: "900",

    color: "#26352B",
  },

  qrPetCode: {
    marginTop: 4,
    fontSize: 14,
    color: "#7A867F",
  },

  permanentBadge: {
    marginTop: 11,

    paddingHorizontal: 13,
    paddingVertical: 7,

    borderRadius: 20,

    backgroundColor: "#EAF4EB",

    flexDirection: "row",
    alignItems: "center",

    gap: 5,
  },

  permanentText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#176B3A",
  },


  sectionTitle: {
    marginTop: 27,
    marginBottom: 12,

    fontSize: 21,
    fontWeight: "800",

    color: "#1E2D24",
  },

  stepsCard: {
    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E2E8E4",

    borderRadius: 17,

    paddingHorizontal: 14,
  },

  step: {
    minHeight: 90,

    flexDirection: "row",
    alignItems: "center",
  },

  stepNumber: {
    width: 28,
    height: 28,

    borderRadius: 14,

    backgroundColor: "#176B3A",

    alignItems: "center",
    justifyContent: "center",
  },

  stepNumberText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  stepIcon: {
    width: 44,
    height: 44,

    marginLeft: 10,

    borderRadius: 13,

    backgroundColor: "#EAF4EB",

    alignItems: "center",
    justifyContent: "center",
  },

  stepContent: {
    flex: 1,
    marginLeft: 12,
  },

  stepTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#31453A",
  },

  stepDescription: {
    marginTop: 4,

    fontSize: 13,
    lineHeight: 19,

    color: "#7B877F",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF1EF",
    marginLeft: 82,
  },


  privacyCard: {
    marginTop: 18,
    padding: 16,

    borderRadius: 16,

    borderWidth: 1,
    borderColor: "#E2E8E4",

    backgroundColor: "#FFFFFF",

    flexDirection: "row",
  },

  doneButton: {
    marginTop: 25,
    height: 56,

    borderRadius: 15,
    backgroundColor: "#176B3A",

    alignItems: "center",
    justifyContent: "center",
  },

  doneText: {
    color: "#FFFFFF",

    fontSize: 17,
    fontWeight: "800",
  },

  buttonPressed: {
    opacity: 0.8,
  },

  saveQRButton: {
    marginTop: 18,
    width: "100%",
    height: 54,

    borderRadius: 14,
    backgroundColor: "#176B3A",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,
  },

  saveQRText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },
});
