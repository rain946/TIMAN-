import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL } from "../../config/api";





export default function QRScannerScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const [scanned, setScanned] =
    useState(false);

  const [checking, setChecking] =
    useState(false);





  const extractQrCode = (
    scannedValue: string
  ) => {

    const value = scannedValue
      .trim()
      .replace(/\s+/g, "");



    try {
      const url = new URL(value);

      const parts = url.pathname
        .split("/")
        .filter(Boolean);

      const petIndex =
        parts.indexOf("pet");

      if (
        petIndex !== -1 &&
        parts[petIndex + 1]
      ) {
        return decodeURIComponent(
          parts[petIndex + 1]
        );
      }
    } catch {

    }





    const marker = "/public/pet/";

    const markerIndex =
      value.indexOf(marker);

    if (markerIndex !== -1) {
      const token = value.substring(
        markerIndex + marker.length
      );

      if (token) {
        return decodeURIComponent(
          token.split("?")[0].split("#")[0]
        );
      }
    }


    return value;
  };





  const handleScan = async ({
    data,
  }: {
    data: string;
  }) => {
    if (scanned || checking) {
      return;
    }

    setScanned(true);
    setChecking(true);

    try {
      console.log(
        "SCANNED QR:",
        data
      );

      const qrCode =
        extractQrCode(data);

      console.log(
        "EXTRACTED QR TOKEN:",
        qrCode
      );

      if (!qrCode) {
        throw new Error(
          "Invalid QR code."
        );
      }

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

      const response =
        await fetch(
          `${API_URL}/authorizations/scan/${encodeURIComponent(
            qrCode
          )}`,
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

      const responseText =
        await response.text();

      let result: any = {};

      try {
        result =
          responseText
            ? JSON.parse(
                responseText
              )
            : {};
      } catch {
        result = {
          message:
            responseText,
        };
      }

      console.log(
        "SCAN STATUS:",
        response.status
      );

      console.log(
        "SCAN RESULT:",
        result
      );

      if (!response.ok) {
        Alert.alert(
          "QR Not Recognized",
          result.message ||
            "This QR code is not registered in TIMAN.",
          [
            {
              text:
                "Scan Again",

              onPress: () => {
                setScanned(
                  false
                );
              },
            },
          ]
        );

        return;
      }

      if (!result.pet?.pet_id) {
        Alert.alert(
          "Pet Not Found",
          "Unable to identify this pet.",
          [
            {
              text:
                "Scan Again",

              onPress: () => {
                setScanned(
                  false
                );
              },
            },
          ]
        );

        return;
      }


      router.replace({
        pathname:
          "/clinic-pet",

        params: {
          petId:
            String(
              result.pet.pet_id
            ),

          authorizationStatus:
            result.status ||
            "None",
        },
      });
    } catch (error) {
      console.log(
        "QR SCANNER ERROR:",
        error
      );

      Alert.alert(
        "Scanner Error",
        "Unable to process this QR code.",
        [
          {
            text:
              "Scan Again",

            onPress: () => {
              setScanned(false);
            },
          },
        ]
      );
    } finally {
      setChecking(false);
    }
  };


  if (!permission) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={styles.center}
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
            Checking camera
            permission...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  if (!permission.granted) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <Header />

        <View
          style={
            styles.permissionContainer
          }
        >
          <View
            style={
              styles.permissionIcon
            }
          >
            <Ionicons
              name="camera-outline"
              size={42}
              color="#176B3A"
            />
          </View>

          <Text
            style={
              styles.permissionTitle
            }
          >
            Camera Permission
          </Text>

          <Text
            style={
              styles.permissionText
            }
          >
            TIMAN needs camera
            access so the clinic
            can scan a pet&apos;s
            permanent QR code.
          </Text>

          <Pressable
            style={({
              pressed,
            }) => [
              styles.permissionButton,

              pressed &&
                styles.pressed,
            ]}
            onPress={
              requestPermission
            }
          >
            <Ionicons
              name="camera"
              size={19}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.permissionButtonText
              }
            >
              Allow Camera
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <View
      style={styles.container}
    >
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
          ],
        }}
        onBarcodeScanned={
          scanned
            ? undefined
            : handleScan
        }
      />


      <View
        style={styles.overlay}
      >

        <SafeAreaView
          edges={["top"]}
        >
          <View
            style={
              styles.cameraHeader
            }
          >
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.back()
              }
            >
              <Ionicons
                name="chevron-back"
                size={27}
                color="#FFFFFF"
              />
            </Pressable>

            <Text
              style={
                styles.cameraHeaderTitle
              }
            >
              Scan Pet QR
            </Text>

            <View
              style={
                styles.headerSpace
              }
            />
          </View>
        </SafeAreaView>


        <View
          style={styles.topArea}
        >
          <Text
            style={
              styles.instruction
            }
          >
            Position the pet&apos;s
            TIMAN QR code inside
            the frame
          </Text>
        </View>


        <View
          style={
            styles.scannerRow
          }
        >
          <View
            style={
              styles.sideOverlay
            }
          />

          <View
            style={
              styles.scanFrame
            }
          >
            <View
              style={[
                styles.corner,
                styles.topLeft,
              ]}
            />

            <View
              style={[
                styles.corner,
                styles.topRight,
              ]}
            />

            <View
              style={[
                styles.corner,
                styles.bottomLeft,
              ]}
            />

            <View
              style={[
                styles.corner,
                styles.bottomRight,
              ]}
            />

            <View
              style={
                styles.scanLine
              }
            />
          </View>

          <View
            style={
              styles.sideOverlay
            }
          />
        </View>


        <View
          style={
            styles.bottomArea
          }
        >
          {checking ? (
            <View
              style={
                styles.checkingBox
              }
            >
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.checkingText
                }
              >
                Identifying pet...
              </Text>
            </View>
          ) : (
            <>
              <View
                style={
                  styles.infoIcon
                }
              >
                <Ionicons
                  name="paw"
                  size={24}
                  color="#FFFFFF"
                />
              </View>

              <Text
                style={
                  styles.bottomTitle
                }
              >
                TIMAN Permanent QR
              </Text>

              <Text
                style={
                  styles.bottomText
                }
              >
                Scan the QR attached
                to the pet&apos;s collar
                or displayed by the
                pet owner.
              </Text>
            </>
          )}

          {scanned &&
            !checking && (
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.scanAgainButton,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() =>
                  setScanned(
                    false
                  )
                }
              >
                <Ionicons
                  name="scan"
                  size={18}
                  color="#173D2A"
                />

                <Text
                  style={
                    styles.scanAgainText
                  }
                >
                  Scan Again
                </Text>
              </Pressable>
            )}
        </View>
      </View>
    </View>
  );
}


function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.pressed,
        ]}
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
        Scan Pet QR
      </Text>

      <View
        style={
          styles.headerButton
        }
      />
    </View>
  );
}


const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#FFFDF7",
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },

    loadingText: {
      marginTop: 12,
      fontSize: 12,
      color: "#718078",
    },


    header: {
      height: 60,
      paddingHorizontal: 20,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",

      borderBottomWidth: 1,
      borderBottomColor:
        "#EDF0EE",
    },

    headerButton: {
      width: 42,
      height: 42,

      alignItems: "center",
      justifyContent:
        "center",
    },

    headerTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: "#1E2D24",
    },


    permissionContainer: {
      flex: 1,

      paddingHorizontal: 30,

      alignItems: "center",
      justifyContent:
        "center",
    },

    permissionIcon: {
      width: 85,
      height: 85,

      borderRadius: 28,

      backgroundColor:
        "#E8F3EA",

      alignItems: "center",
      justifyContent:
        "center",
    },

    permissionTitle: {
      marginTop: 20,

      fontSize: 23,
      fontWeight: "900",

      color: "#26352B",
    },

    permissionText: {
      marginTop: 9,

      maxWidth: 300,

      fontSize: 13,
      lineHeight: 20,

      textAlign: "center",

      color: "#76837B",
    },

    permissionButton: {
      marginTop: 25,

      height: 52,

      paddingHorizontal: 25,

      borderRadius: 15,

      backgroundColor:
        "#176B3A",

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",

      gap: 8,
    },

    permissionButtonText: {
      fontSize: 13,
      fontWeight: "800",

      color: "#FFFFFF",
    },


    overlay: {
      ...StyleSheet.absoluteFillObject,
    },

    cameraHeader: {
      height: 65,

      paddingHorizontal: 18,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",

      backgroundColor:
        "rgba(0,0,0,0.58)",
    },

    backButton: {
      width: 42,
      height: 42,

      borderRadius: 21,

      backgroundColor:
        "rgba(255,255,255,0.13)",

      alignItems: "center",
      justifyContent:
        "center",
    },

    cameraHeaderTitle: {
      fontSize: 18,
      fontWeight: "800",

      color: "#FFFFFF",
    },

    headerSpace: {
      width: 42,
    },

    topArea: {
      flex: 1,

      backgroundColor:
        "rgba(0,0,0,0.58)",

      alignItems: "center",
      justifyContent:
        "flex-end",

      paddingHorizontal: 35,
      paddingBottom: 25,
    },

    instruction: {
      maxWidth: 280,

      fontSize: 13,
      lineHeight: 20,

      fontWeight: "600",

      textAlign: "center",

      color: "#FFFFFF",
    },

    scannerRow: {
      height: 270,

      flexDirection: "row",
    },

    sideOverlay: {
      flex: 1,

      backgroundColor:
        "rgba(0,0,0,0.58)",
    },

    scanFrame: {
      width: 270,
      height: 270,

      position: "relative",
    },

    corner: {
      position: "absolute",

      width: 42,
      height: 42,

      borderColor:
        "#FFFFFF",
    },

    topLeft: {
      top: 0,
      left: 0,

      borderTopWidth: 5,
      borderLeftWidth: 5,

      borderTopLeftRadius: 16,
    },

    topRight: {
      top: 0,
      right: 0,

      borderTopWidth: 5,
      borderRightWidth: 5,

      borderTopRightRadius: 16,
    },

    bottomLeft: {
      bottom: 0,
      left: 0,

      borderBottomWidth: 5,
      borderLeftWidth: 5,

      borderBottomLeftRadius: 16,
    },

    bottomRight: {
      bottom: 0,
      right: 0,

      borderBottomWidth: 5,
      borderRightWidth: 5,

      borderBottomRightRadius: 16,
    },

    scanLine: {
      position: "absolute",

      top: "50%",
      left: 18,
      right: 18,

      height: 2,

      backgroundColor:
        "rgba(255,255,255,0.75)",
    },

    bottomArea: {
      flex: 1,

      backgroundColor:
        "rgba(0,0,0,0.58)",

      paddingHorizontal: 30,

      alignItems: "center",

      paddingTop: 27,
    },

    infoIcon: {
      width: 48,
      height: 48,

      borderRadius: 16,

      backgroundColor:
        "#176B3A",

      alignItems: "center",
      justifyContent:
        "center",
    },

    bottomTitle: {
      marginTop: 10,

      fontSize: 15,
      fontWeight: "800",

      color: "#FFFFFF",
    },

    bottomText: {
      marginTop: 5,

      maxWidth: 300,

      fontSize: 11,
      lineHeight: 17,

      textAlign: "center",

      color:
        "rgba(255,255,255,0.75)",
    },

    checkingBox: {
      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 18,
      paddingVertical: 12,

      borderRadius: 15,

      backgroundColor:
        "rgba(255,255,255,0.15)",

      gap: 9,
    },

    checkingText: {
      fontSize: 12,
      fontWeight: "700",

      color: "#FFFFFF",
    },

    scanAgainButton: {
      marginTop: 18,

      paddingHorizontal: 18,
      paddingVertical: 11,

      borderRadius: 13,

      backgroundColor:
        "#FFFFFF",

      flexDirection: "row",
      alignItems: "center",

      gap: 7,
    },

    scanAgainText: {
      fontSize: 12,
      fontWeight: "800",

      color: "#173D2A",
    },

    pressed: {
      opacity: 0.75,
    },
  });
