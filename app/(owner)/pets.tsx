import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { timanShadow } from "../../components/timan/theme";
import { API_URL } from "../../config/api";

type PetStatus = "Safe" | "Missing" | "Found";

type Pet = {
  pet_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  sex: string;
  birth_date: string | null;
  color: string | null;
  identifying_marks: string | null;
  photo_url: string | null;
  qr_code: string;
  pet_status: PetStatus;
  created_at: string;
};

export default function PetsScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
  }>();

  const isScheduleMode = params.mode === "schedule";

  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const SERVER_URL = API_URL.replace(/\/api\/?$/, "");

  const getPhotoUrl = (photoUrl: string | null) => {
    if (!photoUrl) {
      return null;
    }

    if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
      return photoUrl;
    }

    return `${SERVER_URL}${photoUrl}`;
  };

  const loadPets = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/pets`, {
        method: "GET",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      console.log("GET PETS STATUS:", response.status);

      console.log("GET PETS RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Load Pets",
          data.message || "Unable to load your pets.",
        );

        return;
      }

      setPets(data.pets || []);
    } catch (error) {
      console.log("LOAD PETS ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }

      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPets();

      return () => {};
    }, [loadPets]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadPets(false);
  };

  const openPet = (pet: Pet) => {
    router.push({
      pathname: "/pet-profile",
      params: {
        petId: pet.pet_id.toString(),
      },
    });
  };

  const openQR = (pet: Pet) => {
    router.push({
      pathname: "/pet-qr",
      params: {
        petId: pet.pet_id.toString(),
      },
    });
  };

  const openRecords = (pet: Pet) => {
    router.push({
      pathname: "/(veterinary)/pet-health-records",
      params: {
        petId: pet.pet_id.toString(),
      },
    });
  };

  const openSchedule = (pet: Pet) => {
    router.push({
      pathname: "/(veterinary)/schedules",
      params: {
        petId: pet.pet_id.toString(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressedLight,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
        </Pressable>

        <Text style={styles.headerTitle}>
          {isScheduleMode ? "Select Pet" : "My Pets"}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressedLight,
          ]}
          onPress={() => router.push("/add-pet")}
        >
          <Ionicons name="add" size={29} color="#2E7D6B" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Loading your pets...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.introSection}>
            <Text style={styles.introTitle}>
              {isScheduleMode ? "Choose a Pet" : "Your Pets"}
            </Text>

            <Text style={styles.introDescription}>
              {isScheduleMode
                ? "Select the pet whose health schedule you want to view."
                : "Manage your pets, permanent QR identification, health records, and schedules."}
            </Text>
          </View>

          {pets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="paw" size={48} color="#56B091" />
              </View>

              <Text style={styles.emptyTitle}>No pets registered yet</Text>

              <Text style={styles.emptyDescription}>
                Add your first pet to create a permanent TIMAN QR
                identification.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.addFirstPetButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push("/add-pet")}
              >
                <Ionicons name="add-circle-outline" size={21} color="#FFFFFF" />

                <Text style={styles.addFirstPetText}>Register Pet</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.countRow}>
                <Text style={styles.countText}>
                  {pets.length} {pets.length === 1 ? "Pet" : "Pets"}
                </Text>
              </View>

              {pets.map((pet) => {
                const photoUrl = getPhotoUrl(pet.photo_url);

                const isMissing = pet.pet_status === "Missing";

                const isFound = pet.pet_status === "Found";

                let statusBackground = "#FFF5E9";

                let statusColor = "#56B091";

                if (isMissing) {
                  statusBackground = "rgba(229, 115, 115, 0.14)";

                  statusColor = "#E57373";
                }

                if (isFound) {
                  statusBackground = "#FAD7A0";

                  statusColor = "#E57373";
                }

                return (
                  <View key={pet.pet_id} style={styles.petCard}>
                    <View style={styles.petDecor} pointerEvents="none">
                      <Ionicons name="paw" size={34} color="#56B091" />
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.petMainArea,
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => {
                        if (isScheduleMode) {
                          openSchedule(pet);
                        } else {
                          openPet(pet);
                        }
                      }}
                    >
                      <View style={styles.petImageContainer}>
                        {photoUrl ? (
                          <Image
                            source={{ uri: photoUrl }}
                            style={styles.petImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.petPlaceholder}>
                            <Ionicons name="paw" size={36} color="#56B091" />
                          </View>
                        )}
                      </View>

                      <View style={styles.petInformation}>
                        <View style={styles.nameStatusRow}>
                          <Text style={styles.petName} numberOfLines={2}>
                            {pet.pet_name}
                          </Text>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: statusBackground,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                {
                                  backgroundColor: statusColor,
                                },
                              ]}
                            />

                            <Text
                              style={[
                                styles.statusText,
                                {
                                  color: statusColor,
                                },
                              ]}
                            >
                              {pet.pet_status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.petDetailsRow}>
                          <Text style={styles.petDetail} numberOfLines={1}>
                            {pet.species} • {pet.sex}
                          </Text>
                        </View>

                        <Text style={styles.viewProfileText}>
                          {isScheduleMode
                            ? "View Health Schedule"
                            : "View Pet Profile"}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={21}
                        color="#6B7C73"
                      />
                    </Pressable>

                    <View style={styles.quickActions}>
                      <PetAction
                        icon="qr-code-outline"
                        label="QR Code"
                        onPress={() => openQR(pet)}
                      />

                      <PetAction
                        icon="medical-outline"
                        label="Records"
                        onPress={() => openRecords(pet)}
                      />

                      <PetAction
                        icon="calendar-outline"
                        label="Schedule"
                        onPress={() => openSchedule(pet)}
                      />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PetAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.petAction,
        pressed && styles.pressedLight,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={19} color="#2E7D6B" />

      <Text style={styles.petActionText}>{label}</Text>
    </Pressable>
  );
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
    backgroundColor: "#FFF5E9",
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7C73",
  },

  introSection: {
    marginBottom: 24,
  },

  introTitle: {
    fontSize: 27,
    fontWeight: "900",
    color: "#2E3A34",
  },

  introDescription: {
    marginTop: 6,
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7C73",
  },

  countRow: {
    marginBottom: 12,
  },

  countText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2E3A34",
  },

  emptyContainer: {
    marginTop: 35,
    alignItems: "center",
    paddingHorizontal: 25,
  },

  emptyIcon: {
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "800",
    color: "#2E3A34",
  },

  emptyDescription: {
    marginTop: 7,
    maxWidth: 300,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7C73",
  },

  addFirstPetButton: {
    marginTop: 22,
    minWidth: 180,
    height: 51,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "#2E7D6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  addFirstPetText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  petCard: {
    ...timanShadow,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  petDecor: {
    position: "absolute",
    right: -10,
    top: -10,
    width: 72,
    height: 72,
    borderBottomLeftRadius: 42,
    backgroundColor: "#CFE8DD",
    opacity: 0.42,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-14deg" }],
  },

  petMainArea: {
    padding: 15,
    minHeight: 130,
    flexDirection: "row",
    alignItems: "center",
  },

  petImageContainer: {
    width: 108,
    height: 118,
    borderTopLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    overflow: "hidden",
    backgroundColor: "#CFE8DD",
  },

  petImage: {
    width: "100%",
    height: "100%",
  },

  petPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CFE8DD",
  },

  petInformation: {
    flex: 1,
    marginLeft: 14,
    marginRight: 7,
  },

  nameStatusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },

  petName: {
    flexShrink: 1,
    fontSize: 21,
    fontWeight: "900",
    color: "#2E3A34",
  },

  petBreed: {
    marginTop: 5,
    fontSize: 14,
    color: "#6B7C73",
  },

  petDetailsRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 20,
  },

  petDetail: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    paddingRight: 4,
    color: "#6B7C73",
  },

  viewProfileText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#2E7D6B",
  },

  statusBadge: {
    flexShrink: 0,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "900",
  },

  quickActions: {
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: "#CFE8DD",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  petAction: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    borderRadius: 12,
    backgroundColor: "#FFF5E9",
  },

  petActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D6B",
  },

  pressed: {
    opacity: 0.7,
  },

  pressedLight: {
    opacity: 0.75,
  },
});
