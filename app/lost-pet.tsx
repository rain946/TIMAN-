import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL } from "../config/api";

// ========================================
// TYPES
// ========================================

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

type LostReport = {
  lost_report_id: number;
  pet_id: number;
  owner_id: number;
  current_condition: string;
  owner_message: string;
  last_seen_latitude: string | number | null;
  last_seen_longitude: string | number | null;
  missing_since: string;
  recovered_at: string | null;
  case_status: "Active" | "Recovered";
  created_at: string;
};

type QRScan = {
  scanId: number;
  latitude: string | number | null;
  longitude: string | number | null;
  locationShared: boolean;
  scannedAt: string;
};

// ========================================
// SCREEN
// ========================================

export default function LostPetScreen() {
  const params = useLocalSearchParams<{
    petId?: string;
    id?: string;
  }>();

  const petId = params.petId ?? params.id;

  const [pet, setPet] = useState<Pet | null>(null);
  const [lostReport, setLostReport] =
    useState<LostReport | null>(null);
  const [scanHistory, setScanHistory] =
    useState<QRScan[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recovering, setRecovering] = useState(false);

  // ========================================
  // LOAD LOST PET DETAILS
  // ========================================

  const loadLostPetDetails = useCallback(
    async (showLoading = true) => {
      if (!petId) {
        if (showLoading) {
          setLoading(false);
        }

        return;
      }

      try {
        if (showLoading) {
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

        // ========================================
        // LOAD PET
        // ========================================

        const petResponse = await fetch(
          `${API_URL}/pets/${petId}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const petData =
          await petResponse.json();

        console.log(
          "LOST PET - PET STATUS:",
          petResponse.status
        );

        console.log(
          "LOST PET - PET RESPONSE:",
          petData
        );

        if (!petResponse.ok) {
          throw new Error(
            petData.message ||
              "Unable to load pet."
          );
        }

        setPet(petData.pet);

        // ========================================
        // LOAD ACTIVE LOST REPORT
        // ========================================

        if (
          petData.pet.pet_status ===
          "Missing"
        ) {
          const reportResponse =
            await fetch(
              `${API_URL}/lost-pets/${petId}`,
              {
                method: "GET",
                headers: {
                  Accept:
                    "application/json",
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          const reportData =
            await reportResponse.json();

          console.log(
            "LOST REPORT STATUS:",
            reportResponse.status
          );

          console.log(
            "LOST REPORT RESPONSE:",
            reportData
          );

          if (reportResponse.ok) {
            setLostReport(
              reportData.report ||
                reportData.lostReport ||
                null
            );

            const scans =
              reportData.scanHistory ||
              reportData.scans ||
              [];

            setScanHistory(
              Array.isArray(scans)
                ? scans
                : []
            );
          } else {
            setLostReport(null);
            setScanHistory([]);
          }
        } else {
          setLostReport(null);
          setScanHistory([]);
        }
      } catch (error) {
        console.error(
          "LOAD LOST PET DETAILS ERROR:",
          error
        );

        Alert.alert(
          "Unable to Load Details",
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [petId]
  );

  // ========================================
  // FIRST LOAD
  // ========================================

  useEffect(() => {
    loadLostPetDetails();
  }, [loadLostPetDetails]);

  // ========================================
  // REFRESH
  // ========================================

  const handleRefresh = async () => {
    setRefreshing(true);

    await loadLostPetDetails(false);

    setRefreshing(false);
  };

  // ========================================
  // FORMAT DATE AND TIME
  // ========================================

  const formatDateTime = (
    value: string | null | undefined
  ) => {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // ========================================
  // LATEST QR SCAN
  // ========================================

  const latestScan =
    scanHistory.length > 0
      ? scanHistory[0]
      : null;

  // ========================================
  // LATEST AVAILABLE LOCATION
  // ========================================

  const latestLocationScan =
    scanHistory.find((scan) => {
      const latitude =
        scan.latitude != null
          ? Number(scan.latitude)
          : NaN;

      const longitude =
        scan.longitude != null
          ? Number(scan.longitude)
          : NaN;

      return (
        scan.locationShared &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      );
    }) ?? null;

  const latestLocationLatitude =
    latestLocationScan?.latitude != null
      ? Number(
          latestLocationScan.latitude
        )
      : null;

  const latestLocationLongitude =
    latestLocationScan?.longitude != null
      ? Number(
          latestLocationScan.longitude
        )
      : null;

  const hasLatestAvailableLocation =
    latestLocationLatitude !== null &&
    latestLocationLongitude !== null &&
    Number.isFinite(
      latestLocationLatitude
    ) &&
    Number.isFinite(
      latestLocationLongitude
    );



  // OPEN LOCATION IN GOOGLE MAPS


  const openScanLocation = async (
    latitude: number,
    longitude: number
  ) => {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      Alert.alert(
        "Location Unavailable",
        "This scan does not have a valid location."
      );

      return;
    }

    const googleMapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      `${latitude},${longitude}`;

    try {
      await Linking.openURL(googleMapsUrl);
    } catch (error) {
      console.error(
        "OPEN GOOGLE MAPS ERROR:",
        error
      );

      Alert.alert(
        "Unable to Open Map",
        "Google Maps could not be opened."
      );
    }
  };

  // OPEN LATEST AVAILABLE LOCATION

  const openLastScanLocation =
    async () => {
      if (
        !hasLatestAvailableLocation ||
        latestLocationLatitude === null ||
        latestLocationLongitude === null
      ) {
        Alert.alert(
          "Location Unavailable",
          "No shared scan location is available yet."
        );

        return;
      }

      await openScanLocation(
        latestLocationLatitude,
        latestLocationLongitude
      );
    };

  // RECOVER PET

  const recoverPet = async () => {
    if (
      !pet ||
      !petId ||
      recovering
    ) {
      return;
    }

    try {
      setRecovering(true);

      const token =
        await AsyncStorage.getItem(
          "token"
        );

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please log in again."
        );

        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/lost-pets/${petId}/recovered`,
        {
          method: "PATCH",
          headers: {
            Accept:
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      console.log(
        "RECOVER PET STATUS:",
        response.status
      );

      console.log(
        "RECOVER PET RESPONSE:",
        data
      );

      if (!response.ok) {
        Alert.alert(
          "Unable to Update Pet",
          data.message ||
            "Please try again."
        );

        return;
      }

      Alert.alert(
        "Pet is Safe",
        `${pet.pet_name} has been marked as safe.`,
        [
          {
            text: "OK",
            onPress: () =>
              router.back(),
          },
        ]
      );
    } catch (error) {
      console.error(
        "RECOVER PET ERROR:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Unable to connect to the TIMAN server."
      );
    } finally {
      setRecovering(false);
    }
  };

  // CONFIRM RECOVERY

  const confirmRecovery = () => {
    if (!pet) {
      return;
    }

    Alert.alert(
      "I Saw the Pet",
      `Are you sure ${pet.pet_name} is already back with you?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text:
            "Yes, Pet is Safe",
          onPress: recoverPet,
        },
      ]
    );
  };

  // LOADING

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            style={
              styles.headerButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="chevron-back"
              size={27}
              color="#173D2A"
            />
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Missing Pet Details
          </Text>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color="#176B3A"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading missing pet
            details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  // PET NOT FOUND


  if (!petId || !pet) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            style={
              styles.headerButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="chevron-back"
              size={27}
              color="#173D2A"
            />
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Missing Pet Details
          </Text>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        <View
          style={
            styles.emptyPetContainer
          }
        >
          <Ionicons
            name="paw-outline"
            size={50}
            color="#9BA69F"
          />

          <Text
            style={
              styles.emptyPetTitle
            }
          >
            Pet Not Found
          </Text>

          <Text
            style={
              styles.emptyPetText
            }
          >
            Unable to load the
            selected pet.
          </Text>

          <Pressable
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const petLabel =
    pet.breed?.trim() ||
    pet.species ||
    "Pet";


  // SCREEN


  return (
    <SafeAreaView
      style={styles.container}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="chevron-back"
            size={27}
            color="#173D2A"
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          Missing Pet Details
        </Text>

        <View
          style={styles.headerButton}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* PET CARD */}

        <View style={styles.petCard}>
          <View
            style={styles.petIcon}
          >
            <Ionicons
              name="paw"
              size={38}
              color="#176B3A"
            />
          </View>

          <View
            style={styles.petInfo}
          >
            <Text
              style={styles.petName}
            >
              {pet.pet_name}
            </Text>

            <Text
              style={styles.petBreed}
            >
              {petLabel} • {pet.sex}
            </Text>

            <Text
              style={styles.petId}
            >
              PET-
              {String(
                pet.pet_id
              ).padStart(4, "0")}
            </Text>
          </View>

          <StatusBadge
            status={pet.pet_status}
          />
        </View>

        {/* PET STATUS */}

        {pet.pet_status ===
        "Missing" ? (
          <View
            style={
              styles.missingCard
            }
          >
            <View
              style={
                styles.missingIcon
              }
            >
              <Ionicons
                name="alert-circle"
                size={30}
                color="#A14343"
              />
            </View>

            <View
              style={
                styles.statusContent
              }
            >
              <Text
                style={
                  styles.missingTitle
                }
              >
                {pet.pet_name} is
                Missing
              </Text>

              <Text
                style={
                  styles.statusText
                }
              >
                QR scan activity and
                the latest shared
                location can be viewed
                below.
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={styles.safeCard}
          >
            <View
              style={styles.safeIcon}
            >
              <Ionicons
                name="shield-checkmark"
                size={30}
                color="#267542"
              />
            </View>

            <View
              style={
                styles.statusContent
              }
            >
              <Text
                style={
                  styles.safeTitle
                }
              >
                {pet.pet_name} is Safe
              </Text>

              <Text
                style={
                  styles.statusText
                }
              >
                This pet is no longer
                marked as missing.
              </Text>
            </View>
          </View>
        )}

        {/* MISSING REPORT */}

        {lostReport && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Missing Report
            </Text>

            <View
              style={styles.qrCard}
            >
              <View
                style={styles.qrIcon}
              >
                <Ionicons
                  name="document-text-outline"
                  size={27}
                  color="#176B3A"
                />
              </View>

              <View
                style={
                  styles.qrContent
                }
              >
                <Text
                  style={
                    styles.qrTitle
                  }
                >
                  Condition:{" "}
                  {
                    lostReport.current_condition
                  }
                </Text>

                <Text
                  style={
                    styles.qrText
                  }
                >
                  {lostReport.owner_message ||
                    "No message provided."}
                </Text>

                <Text
                  style={[
                    styles.qrText,
                    {
                      marginTop: 6,
                    },
                  ]}
                >
                  Missing since:{" "}
                  {formatDateTime(
                    lostReport.missing_since
                  )}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* LATEST QR SCAN */}

        <Text
          style={styles.sectionTitle}
        >
          Latest QR Scan
        </Text>

        {latestScan ? (
          <View
            style={
              styles.processCard
            }
          >
            {/* LATEST SCAN EVENT */}

            <View
              style={
                styles.processItem
              }
            >
              <View
                style={
                  styles.processIcon
                }
              >
                <Ionicons
                  name="qr-code-outline"
                  size={24}
                  color="#176B3A"
                />
              </View>

              <View
                style={
                  styles.processContent
                }
              >
                <Text
                  style={
                    styles.processTitle
                  }
                >
                  Latest Scan
                </Text>

                <Text
                  style={
                    styles.processDescription
                  }
                >
                  {formatDateTime(
                    latestScan.scannedAt
                  )}
                </Text>

                <Text
                  style={
                    styles.processDescription
                  }
                >
                  {latestScan.locationShared
                    ? "Location was shared."
                    : "Location was not shared."}
                </Text>
              </View>
            </View>

            {/* DIVIDER */}

            <View
              style={{
                height: 1,
                backgroundColor:
                  "#E5EAE7",
                marginVertical: 14,
              }}
            />

            {/* LATEST AVAILABLE LOCATION */}

            <View
              style={
                styles.processItem
              }
            >
              <View
                style={
                  styles.processIcon
                }
              >
                <Ionicons
                  name="location-outline"
                  size={24}
                  color="#176B3A"
                />
              </View>

              <View
                style={
                  styles.processContent
                }
              >
                <Text
                  style={
                    styles.processTitle
                  }
                >
                  Latest Available
                  Location
                </Text>

                {hasLatestAvailableLocation &&
                latestLocationScan ? (
                  <>
                    <Text
                      style={
                        styles.processDescription
                      }
                    >
                      Latitude:{" "}
                      {
                        latestLocationLatitude
                      }
                    </Text>

                    <Text
                      style={
                        styles.processDescription
                      }
                    >
                      Longitude:{" "}
                      {
                        latestLocationLongitude
                      }
                    </Text>

                    <Text
                      style={
                        styles.processDescription
                      }
                    >
                      Shared:{" "}
                      {formatDateTime(
                        latestLocationScan.scannedAt
                      )}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={
                      styles.processDescription
                    }
                  >
                    No scan location has
                    been shared yet.
                  </Text>
                )}
              </View>
            </View>

            {hasLatestAvailableLocation && (
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.previewButton,
                  {
                    marginTop: 16,
                  },
                  pressed &&
                    styles.pressed,
                ]}
                onPress={
                  openLastScanLocation
                }
              >
                <Ionicons
                  name="map-outline"
                  size={20}
                  color="#176B3A"
                />

                <Text
                  style={
                    styles.previewText
                  }
                >
                  Open Location in Maps
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View
            style={
              styles.emptyReport
            }
          >
            <Ionicons
              name="location-outline"
              size={31}
              color="#9BA69F"
            />

            <Text
              style={
                styles.emptyTitle
              }
            >
              No QR Scans Yet
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              QR scan activity and
              shared locations will
              appear here when someone
              scans {pet.pet_name}'s QR
              code.
            </Text>
          </View>
        )}

        {/* RECENT QR SCANS */}

        {scanHistory.length >
          0 && (
          <>
            <View
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Recent QR Scans
              </Text>

              <View
                style={
                  styles.reportCount
                }
              >
                <Text
                  style={
                    styles.reportCountText
                  }
                >
                  {scanHistory.length}
                </Text>
              </View>
            </View>

            {scanHistory.map(
              (scan, index) => {
                const latitude =
                  scan.latitude !=
                  null
                    ? Number(
                        scan.latitude
                      )
                    : null;

                const longitude =
                  scan.longitude !=
                  null
                    ? Number(
                        scan.longitude
                      )
                    : null;

                const hasLocation =
                  latitude !== null &&
                  longitude !== null &&
                  Number.isFinite(
                    latitude
                  ) &&
                  Number.isFinite(
                    longitude
                  );

                return (
                  <View
                    key={
                      scan.scanId ??
                      `scan-${index}`
                    }
                    style={[
                      styles.qrCard,
                      {
                        marginBottom: 10,
                      },
                    ]}
                  >
                    <View
                      style={
                        styles.qrIcon
                      }
                    >
                      <Ionicons
                        name={
                          index === 0
                            ? "location"
                            : "location-outline"
                        }
                        size={24}
                        color="#176B3A"
                      />
                    </View>

                    <View
                      style={
                        styles.qrContent
                      }
                    >
                      <Text
                        style={
                          styles.qrTitle
                        }
                      >
                        {index === 0
                          ? "Latest Scan"
                          : `Scan ${index + 1}`}
                      </Text>

                      <Text
                        style={
                          styles.qrText
                        }
                      >
                        {formatDateTime(
                          scan.scannedAt
                        )}
                      </Text>

                      <Text
                        style={[
                          styles.qrText,
                          {
                            marginTop: 3,
                          },
                        ]}
                      >
                        {hasLocation
                          ? `${latitude}, ${longitude}`
                          : "Location not shared"}
                      </Text>

                      {hasLocation &&
                        latitude !==
                          null &&
                        longitude !==
                          null && (
                          <Pressable
                            style={({
                              pressed,
                            }) => [
                              styles.scanMapButton,
                              pressed &&
                                styles.pressed,
                            ]}
                            onPress={() =>
                              openScanLocation(
                                latitude,
                                longitude
                              )
                            }
                          >
                            <Ionicons
                              name="map-outline"
                              size={17}
                              color="#176B3A"
                            />

                            <Text
                              style={
                                styles.scanMapButtonText
                              }
                            >
                              View Location
                            </Text>
                          </Pressable>
                        )}
                    </View>
                  </View>
                );
              }
            )}
          </>
        )}
        {/* I SAW THE PET */}

        {pet.pet_status ===
          "Missing" && (
          <Pressable
            disabled={recovering}
            style={({ pressed }) => [
              styles.safeButton,
              (pressed ||
                recovering) &&
                styles.pressed,
            ]}
            onPress={
              confirmRecovery
            }
          >
            {recovering ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.safeButtonText
                  }
                >
                  I Saw the Pet
                </Text>
              </>
            )}
          </Pressable>
        )}

        {/* INFO */}

        <View
          style={styles.infoCard}
        >
          <Ionicons
            name="information-circle-outline"
            size={21}
            color="#176B3A"
          />

          <Text
            style={styles.infoText}
          >
            Scan locations are only
            available when the person
            scanning the QR allows
            location access.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ========================================
// STATUS BADGE
// ========================================

function StatusBadge({
  status,
}: {
  status: PetStatus;
}) {
  const isSafe =
    status === "Safe";

  const isFound =
    status === "Found";

  return (
    <View
      style={[
        styles.statusBadge,
        isSafe
          ? styles.statusBadgeSafe
          : isFound
            ? styles.statusBadgeFound
            : styles.statusBadgeMissing,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor:
              isSafe
                ? "#2E9C52"
                : isFound
                  ? "#D99B35"
                  : "#B84A4A",
          },
        ]}
      />

      <Text
        style={[
          styles.statusBadgeText,
          {
            color: isSafe
              ? "#267542"
              : isFound
                ? "#99691E"
                : "#A14343",
          },
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

function ProcessLine() {
  return <View style={styles.processLine} />;
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
    paddingHorizontal: 22,
    paddingBottom: 50,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    fontSize: 14,
    color: "#77857C",
    marginTop: 12,
  },

  emptyPetContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },

  emptyPetTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#293A30",
    marginTop: 12,
  },

  emptyPetText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: "#77857C",
    marginTop: 6,
  },

  backButton: {
    backgroundColor: "#176B3A",
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 13,
    marginTop: 18,
  },

  backButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  petCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 18,
    padding: 15,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  petIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  petInfo: {
    flex: 1,
    marginLeft: 12,
  },

  petName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#293A30",
  },

  petBreed: {
    fontSize: 13,
    color: "#77857C",
    marginTop: 3,
  },

  petId: {
    fontSize: 11,
    color: "#9AA39D",
    marginTop: 4,
  },

  statusBadge: {
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  statusBadgeSafe: {
    backgroundColor: "#E7F4E9",
  },

  statusBadgeMissing: {
    backgroundColor: "#FFF0F0",
  },

  statusBadgeFound: {
    backgroundColor: "#FFF3DF",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  safeCard: {
    backgroundColor: "#E7F4E9",
    borderRadius: 17,
    padding: 15,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  safeIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  missingCard: {
    backgroundColor: "#FFF0F0",
    borderRadius: 17,
    padding: 15,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  missingIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  foundStatusCard: {
    backgroundColor: "#FFF3DF",
    borderRadius: 17,
    padding: 15,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  foundStatusIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  statusContent: {
    flex: 1,
    marginLeft: 11,
  },

  safeTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#267542",
  },

  missingTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#A14343",
  },

  foundStatusTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#98691E",
  },

  statusText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#68766E",
    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1E2D24",
    marginTop: 25,
    marginBottom: 11,
  },

  processCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 18,
    padding: 15,
  },

  processItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  processNumber: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#176B3A",
    alignItems: "center",
    justifyContent: "center",
  },

  processNumberText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  processIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 9,
  },

  processContent: {
    flex: 1,
    marginLeft: 10,
  },

  processTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3A4A40",
  },

  processDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7A877F",
    marginTop: 2,
  },

  processLine: {
    width: 1,
    height: 14,
    backgroundColor: "#D4DED7",
    marginLeft: 11,
  },

  qrCard: {
    backgroundColor: "#EAF4EB",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  qrIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  qrContent: {
    flex: 1,
    marginLeft: 11,
  },

  qrTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#294C34",
  },

  qrText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#66766B",
    marginTop: 3,
  },

  previewButton: {
    height: 48,
    borderWidth: 1,
    borderColor: "#176B3A",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 10,
  },

  previewText: {
    color: "#176B3A",
    fontSize: 13,
    fontWeight: "800",
  },

  scanMapButton: {
    marginTop: 9,
    minHeight: 36,
    borderWidth: 1,
    borderColor: "#176B3A",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  scanMapButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#176B3A",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  reportCount: {
    marginTop: 14,
    marginLeft: 7,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#A14343",
    alignItems: "center",
    justifyContent: "center",
  },

  reportCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  emptyReport: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 16,
    alignItems: "center",
    padding: 23,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#59675E",
    marginTop: 7,
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#919B95",
    textAlign: "center",
    marginTop: 4,
  },

  missingButton: {
    minHeight: 56,
    backgroundColor: "#A14343",
    borderRadius: 14,
    marginTop: 27,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  missingButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  safeButton: {
    minHeight: 56,
    backgroundColor: "#176B3A",
    borderRadius: 14,
    marginTop: 27,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  safeButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  infoCard: {
    backgroundColor: "#EAF4EB",
    borderRadius: 14,
    padding: 13,
    marginTop: 20,
    flexDirection: "row",
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#66766B",
    marginLeft: 8,
  },

  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
