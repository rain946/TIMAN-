import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
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

  const isScheduleMode =
    params.mode === "schedule";

  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);



  const SERVER_URL = API_URL.replace(/\/api\/?$/, "");



  const getPhotoUrl = (photoUrl: string | null) => {
    if (!photoUrl) {
      return null;
    }

    if (
      photoUrl.startsWith("http://") ||
      photoUrl.startsWith("https://")
    ) {
      return photoUrl;
    }

    return `${SERVER_URL}${photoUrl}`;
  };



  const loadPets = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

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
          `${API_URL}/pets`,
          {
            method: "GET",

            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        console.log(
          "GET PETS STATUS:",
          response.status
        );

        console.log(
          "GET PETS RESPONSE:",
          data
        );

        if (!response.ok) {
          Alert.alert(
            "Unable to Load Pets",
            data.message ||
              "Unable to load your pets."
          );

          return;
        }

        setPets(data.pets || []);
      } catch (error) {
        console.log(
          "LOAD PETS ERROR:",
          error
        );

        Alert.alert(
          "Connection Error",
          "Unable to connect to the TIMAN server."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }

        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadPets();

      return () => {};
    }, [loadPets])
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
      pathname: "/vet-records",
      params: {
        petId: pet.pet_id.toString(),
      },
    });
  };


  const openSchedule = (pet: Pet) => {
    router.push({
      pathname: "/schedules",
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
          <Ionicons
            name="chevron-back"
            size={27}
            color="#173D2A"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          {isScheduleMode
            ? "Select Pet"
            : "My Pets"}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressedLight,
          ]}
          onPress={() => router.push("/add-pet")}
        >
          <Ionicons
            name="add"
            size={29}
            color="#176B3A"
          />
        </Pressable>
      </View>


      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text style={styles.loadingText}>
            Loading your pets...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        >

          <View style={styles.introSection}>
            <Text style={styles.introTitle}>
              {isScheduleMode
                ? "Choose a Pet"
                : "Your Pets"}
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
                <Ionicons
                  name="paw"
                  size={48}
                  color="#7EA48A"
                />
              </View>

              <Text style={styles.emptyTitle}>
                No pets registered yet
              </Text>

              <Text style={styles.emptyDescription}>
                Add your first pet to create a
                permanent TIMAN QR identification.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.addFirstPetButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  router.push("/add-pet")
                }
              >
                <Ionicons
                  name="add-circle-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.addFirstPetText}
                >
                  Register Pet
                </Text>
              </Pressable>
            </View>
          ) : (
            <>


              <View style={styles.countRow}>
                <Text style={styles.countText}>
                  {pets.length}{" "}
                  {pets.length === 1
                    ? "Pet"
                    : "Pets"}
                </Text>

                <Text style={styles.refreshHint}>
                  Pull down to refresh
                </Text>
              </View>

              {pets.map((pet) => {
                const photoUrl =
                  getPhotoUrl(pet.photo_url);

                const isMissing =
                  pet.pet_status === "Missing";

                const isFound =
                  pet.pet_status === "Found";

                let statusBackground =
                  "#E5F4E8";

                let statusColor =
                  "#267542";

                if (isMissing) {
                  statusBackground =
                    "#FFF0F0";

                  statusColor =
                    "#B54545";
                }

                if (isFound) {
                  statusBackground =
                    "#FFF5DC";

                  statusColor =
                    "#A36C18";
                }

                return (
                  <View
                    key={pet.pet_id}
                    style={styles.petCard}
                  >

                    <Pressable style={({ pressed }) => [
                        styles.petMainArea,
                        pressed &&
                          styles.pressedLight,
                      ]}
                      onPress={() => {
                        if (isScheduleMode) {
                          openSchedule(pet);
                        } else {
                          openPet(pet);
                        }
                      }}
                    >

                      <View style={styles.petImageContainer }>
                        {photoUrl ? (
                          <Image source={{uri: photoUrl,}}
                            style={styles.petImage }
                            resizeMode="cover"/>
                        ) : (
                          <View style={styles.petPlaceholder} >
                            <Ionicons
                              name="paw"
                              size={36}
                              color="#7EA48A"
                            />
                          </View>
                        )}
                      </View>


                      <View style={styles.petInformation}>
                        <View style={styles.nameStatusRow}>
                          <Text style={styles.petName}
                            numberOfLines={2}>
                            {pet.pet_name}
                          </Text>

                          <View style={[styles.statusBadge,
                              {
                                backgroundColor:
                                  statusBackground,
                              },
                            ]}
                          >
                            <View style={[styles.statusDot,
                                {
                                  backgroundColor:
                                    statusColor,
                                },
                              ]}
                            />

                            <Text style={[styles.statusText,
                                {
                                  color:
                                    statusColor,
                                },
                              ]}
                            >
                              {pet.pet_status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.petDetailsRow}>
                          <Text
                            style={styles.petDetail}
                            numberOfLines={1}
                          >
                            {pet.species}  •  {pet.sex}
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
                        color="#A0AAA4"
                      />
                    </Pressable>

                    <View style={styles.quickActions}>
                      <PetAction
                        icon="qr-code-outline"
                        label="QR Code"
                        onPress={() =>
                          openQR(pet)
                        }
                      />

                      <PetAction
                        icon="medical-outline"
                        label="Records"
                        onPress={() =>
                          openRecords(pet)
                        }
                      />

                      <PetAction
                        icon="calendar-outline"
                        label="Schedule"
                        onPress={() =>
                          openSchedule(pet)
                        }
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
      <Ionicons
        name={icon}
        size={19}
        color="#176B3A"
      />

      <Text style={styles.petActionText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },

  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EE",
    backgroundColor: "#FFFDF7",
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
    color: "#1E2D24",
  },

  content: {
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
    color: "#7A867F",
  },

  introSection: {
    marginBottom: 24,
  },

  introTitle: {
    fontSize: 27,
    fontWeight: "900",
    color: "#1E2D24",
  },

  introDescription: {
    marginTop: 6,
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 20,
    color: "#7A867F",
  },

  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  countText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#405248",
  },

  refreshHint: {
    fontSize: 12,
    color: "#9AA49E",
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
    backgroundColor: "#E8F2E9",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "800",
    color: "#27362C",
  },

  emptyDescription: {
    marginTop: 7,
    maxWidth: 300,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#7B877F",
  },

  addFirstPetButton: {
    marginTop: 22,
    minWidth: 180,
    height: 51,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "#176B3A",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7E3",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
  },

  petMainArea: {
    padding: 15,
    minHeight: 130,
    flexDirection: "row",
    alignItems: "center",
  },

  petImageContainer: {
    width: 92,
    height: 92,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E8F2E9",
  },

  petImage: {
    width: "100%",
    height: "100%",
  },

  petPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F2E9",
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
    color: "#213027",
  },

  petBreed: {
    marginTop: 5,
    fontSize: 14,
    color: "#66756C",
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
    color: "#89938D",
  },

  viewProfileText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#176B3A",
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
    borderTopColor: "#EDF0EE",
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
    borderColor: "#CFE0D4",
    borderRadius: 12,
    backgroundColor: "#F7FBF8",
  },

  petActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#176B3A",
  },

  pressed: {
    opacity: 0.7,
  },

  pressedLight: {
    opacity: 0.75,
  },
});
