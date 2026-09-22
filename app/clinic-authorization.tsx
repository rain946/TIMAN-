import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useState,
} from "react";

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

import {
  API_URL,
  getImageUrl,
} from "../config/api";

// =====================================================
// TYPES
// =====================================================

type AuthorizationStatus =
  | "Pending"
  | "Approved"
  | "Declined"
  | "Revoked";

type Authorization = {
  authorization_id: number;

  pet_id: number;
  clinic_user_id: number;

  status: AuthorizationStatus;

  requested_at: string;
  responded_at: string | null;

  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;

  clinic_contact_name: string;
  clinic_name: string | null;
};

// =====================================================
// SCREEN
// =====================================================

export default function ClinicAuthorizationScreen() {
  const [
    authorizations,
    setAuthorizations,
  ] = useState<Authorization[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    processingId,
    setProcessingId,
  ] = useState<number | null>(null);

  // ===================================================
  // LOAD REQUESTS
  // ===================================================

  const loadAuthorizations =
    useCallback(
      async (
        showLoading = true
      ) => {
        try {
          if (showLoading) {
            setLoading(true);
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

            router.replace(
              "/login"
            );

            return;
          }

          const response =
            await fetch(
              `${API_URL}/authorizations/owner`,
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

          const text =
            await response.text();

          let data: any = {};

          try {
            data = text
              ? JSON.parse(text)
              : {};
          } catch {
            data = {
              message: text,
            };
          }

          console.log(
            "OWNER AUTHORIZATION STATUS:",
            response.status
          );

          console.log(
            "OWNER AUTHORIZATION RESPONSE:",
            data
          );

          if (!response.ok) {
            Alert.alert(
              "Unable to Load",
              data.message ||
                "Unable to load clinic requests."
            );

            return;
          }

          setAuthorizations(
            Array.isArray(
              data.authorizations
            )
              ? data.authorizations
              : []
          );
        } catch (error) {
          console.log(
            "LOAD AUTHORIZATION ERROR:",
            error
          );

          Alert.alert(
            "Connection Error",
            "Unable to connect to the TIMAN server."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  // ===================================================
  // REFRESH WHEN SCREEN OPENS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      loadAuthorizations();

      return () => {};
    }, [loadAuthorizations])
  );

  // ===================================================
  // PULL TO REFRESH
  // ===================================================

  const onRefresh = () => {
    setRefreshing(true);

    loadAuthorizations(false);
  };

  // ===================================================
  // UPDATE AUTHORIZATION
  // ===================================================

  const updateAuthorization =
    async (
      authorizationId: number,
      action:
        | "approve"
        | "decline"
        | "revoke"
    ) => {
      if (processingId !== null) {
        return;
      }

      try {
        setProcessingId(
          authorizationId
        );

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        if (!token) {
          Alert.alert(
            "Session Expired",
            "Please log in again."
          );

          router.replace(
            "/login"
          );

          return;
        }

        const response =
          await fetch(
            `${API_URL}/authorizations/${authorizationId}/${action}`,
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

        const text =
          await response.text();

        let data: any = {};

        try {
          data = text
            ? JSON.parse(text)
            : {};
        } catch {
          data = {
            message: text,
          };
        }

        console.log(
          "AUTHORIZATION ACTION:",
          action
        );

        console.log(
          "AUTHORIZATION ACTION STATUS:",
          response.status
        );

        console.log(
          "AUTHORIZATION ACTION RESPONSE:",
          data
        );

        if (!response.ok) {
          Alert.alert(
            "Action Failed",
            data.message ||
              "Unable to update clinic access."
          );

          return;
        }

        let title =
          "Access Updated";

        if (
          action === "approve"
        ) {
          title =
            "Clinic Approved";
        }

        if (
          action === "decline"
        ) {
          title =
            "Request Declined";
        }

        if (
          action === "revoke"
        ) {
          title =
            "Access Revoked";
        }

        Alert.alert(
          title,
          data.message ||
            "Clinic authorization updated."
        );

        await loadAuthorizations(
          false
        );
      } catch (error) {
        console.log(
          "UPDATE AUTHORIZATION ERROR:",
          error
        );

        Alert.alert(
          "Connection Error",
          "Unable to update clinic access."
        );
      } finally {
        setProcessingId(null);
      }
    };

  // ===================================================
  // APPROVE CONFIRMATION
  // ===================================================

  const confirmApprove = (
    item: Authorization
  ) => {
    Alert.alert(
      "Approve Clinic Access",
      `Allow ${
        item.clinic_name ||
        item.clinic_contact_name
      } to access and manage ${item.pet_name}'s veterinary records?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Approve",

          onPress: () =>
            updateAuthorization(
              item.authorization_id,
              "approve"
            ),
        },
      ]
    );
  };

  // ===================================================
  // DECLINE CONFIRMATION
  // ===================================================

  const confirmDecline = (
    item: Authorization
  ) => {
    Alert.alert(
      "Decline Request",
      `Decline the clinic access request for ${item.pet_name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Decline",
          style: "destructive",

          onPress: () =>
            updateAuthorization(
              item.authorization_id,
              "decline"
            ),
        },
      ]
    );
  };

  // ===================================================
  // REVOKE CONFIRMATION
  // ===================================================

  const confirmRevoke = (
    item: Authorization
  ) => {
    Alert.alert(
      "Revoke Clinic Access",
      `Remove ${
        item.clinic_name ||
        item.clinic_contact_name
      }'s access to ${item.pet_name}'s veterinary records?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Revoke",
          style: "destructive",

          onPress: () =>
            updateAuthorization(
              item.authorization_id,
              "revoke"
            ),
        },
      ]
    );
  };

  // ===================================================
  // COUNTS
  // ===================================================

  const pendingCount =
    authorizations.filter(
      (item) =>
        item.status ===
        "Pending"
    ).length;

  const approvedCount =
    authorizations.filter(
      (item) =>
        item.status ===
        "Approved"
    ).length;

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <Header />

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
            Loading clinic
            requests...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <SafeAreaView
      style={styles.container}
    >
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              onRefresh
            }
          />
        }
      >
        {/* INTRO */}

        <View
          style={styles.introCard}
        >
          <View
            style={
              styles.introIcon
            }
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={30}
              color="#176B3A"
            />
          </View>

          <View
            style={
              styles.introContent
            }
          >
            <Text
              style={
                styles.introTitle
              }
            >
              Clinic Access
            </Text>

            <Text
              style={
                styles.introText
              }
            >
              You control which
              veterinary clinics can
              access and update your
              pet's veterinary
              records.
            </Text>
          </View>
        </View>

        {/* SUMMARY */}

        <View
          style={
            styles.summaryRow
          }
        >
          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={[
                styles.summaryIcon,
                styles.pendingSummaryIcon,
              ]}
            >
              <Ionicons
                name="time-outline"
                size={21}
                color="#98701C"
              />
            </View>

            <Text
              style={
                styles.summaryNumber
              }
            >
              {pendingCount}
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Pending
            </Text>
          </View>

          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={[
                styles.summaryIcon,
                styles.approvedSummaryIcon,
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={21}
                color="#176B3A"
              />
            </View>

            <Text
              style={
                styles.summaryNumber
              }
            >
              {approvedCount}
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Approved
            </Text>
          </View>
        </View>

        {/* EMPTY */}

        {authorizations.length ===
        0 ? (
          <View
            style={styles.emptyCard}
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name="business-outline"
                size={35}
                color="#789180"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No Clinic Requests
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Clinic access requests
              will appear here after
              a veterinary clinic
              scans your pet's TIMAN
              QR and requests access.
            </Text>
          </View>
        ) : (
          <>
            {/* PENDING */}

            {pendingCount > 0 && (
              <>
                <SectionHeader
                  title="Pending Requests"
                  count={
                    pendingCount
                  }
                />

                {authorizations
                  .filter(
                    (item) =>
                      item.status ===
                      "Pending"
                  )
                  .map((item) => (
                    <AuthorizationCard
                      key={
                        item.authorization_id
                      }
                      item={item}
                      processing={
                        processingId ===
                        item.authorization_id
                      }
                      onApprove={() =>
                        confirmApprove(
                          item
                        )
                      }
                      onDecline={() =>
                        confirmDecline(
                          item
                        )
                      }
                      onRevoke={() => {}}
                    />
                  ))}
              </>
            )}

            {/* APPROVED */}

            {approvedCount > 0 && (
              <>
                <SectionHeader
                  title="Authorized Clinics"
                  count={
                    approvedCount
                  }
                />

                {authorizations
                  .filter(
                    (item) =>
                      item.status ===
                      "Approved"
                  )
                  .map((item) => (
                    <AuthorizationCard
                      key={
                        item.authorization_id
                      }
                      item={item}
                      processing={
                        processingId ===
                        item.authorization_id
                      }
                      onApprove={() => {}}
                      onDecline={() => {}}
                      onRevoke={() =>
                        confirmRevoke(
                          item
                        )
                      }
                    />
                  ))}
              </>
            )}

            {/* PREVIOUS */}

            {authorizations.some(
              (item) =>
                item.status ===
                  "Declined" ||
                item.status ===
                  "Revoked"
            ) && (
              <>
                <SectionHeader
                  title="Previous Access"
                />

                {authorizations
                  .filter(
                    (item) =>
                      item.status ===
                        "Declined" ||
                      item.status ===
                        "Revoked"
                  )
                  .map((item) => (
                    <AuthorizationCard
                      key={
                        item.authorization_id
                      }
                      item={item}
                      processing={
                        false
                      }
                      onApprove={() => {}}
                      onDecline={() => {}}
                      onRevoke={() => {}}
                    />
                  ))}
              </>
            )}
          </>
        )}

        <View
          style={
            styles.securityCard
          }
        >
          <Ionicons
            name="lock-closed-outline"
            size={19}
            color="#176B3A"
          />

          <Text
            style={
              styles.securityText
            }
          >
            Clinics cannot access
            protected veterinary
            records until you approve
            their request. You may
            revoke approved access
            later.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// HEADER
// =====================================================

function Header() {
  return (
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
        Clinic Authorization
      </Text>

      <View
        style={
          styles.headerButton
        }
      />
    </View>
  );
}

// =====================================================
// SECTION HEADER
// =====================================================

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
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
        {title}
      </Text>

      {count !== undefined && (
        <View
          style={
            styles.countBadge
          }
        >
          <Text
            style={
              styles.countText
            }
          >
            {count}
          </Text>
        </View>
      )}
    </View>
  );
}

// =====================================================
// AUTHORIZATION CARD
// =====================================================

function AuthorizationCard({
  item,
  processing,
  onApprove,
  onDecline,
  onRevoke,
}: {
  item: Authorization;
  processing: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onRevoke: () => void;
}) {
  const photoUrl =
    getImageUrl(
      item.photo_url
    );

  const clinicDisplay =
    item.clinic_name ||
    item.clinic_contact_name ||
    "Veterinary Clinic";

  return (
    <View
      style={styles.requestCard}
    >
      {/* PET */}

      <View
        style={
          styles.petSection
        }
      >
        {photoUrl ? (
          <Image
            source={{
              uri: photoUrl,
            }}
            style={
              styles.petPhoto
            }
          />
        ) : (
          <View
            style={
              styles.petPlaceholder
            }
          >
            <Ionicons
              name="paw"
              size={25}
              color="#75947E"
            />
          </View>
        )}

        <View
          style={
            styles.petInfo
          }
        >
          <Text
            style={
              styles.petName
            }
          >
            {item.pet_name}
          </Text>

          <Text
            style={
              styles.petBreed
            }
          >
            {item.breed ||
              item.species}
          </Text>
        </View>

        <StatusBadge
          status={item.status}
        />
      </View>

      <View
        style={styles.divider}
      />

      {/* CLINIC */}

      <View
        style={
          styles.clinicSection
        }
      >
        <View
          style={
            styles.clinicIcon
          }
        >
          <Ionicons
            name="medical-outline"
            size={23}
            color="#176B3A"
          />
        </View>

        <View
          style={
            styles.clinicInfo
          }
        >
          <Text
            style={
              styles.clinicLabel
            }
          >
            Veterinary Clinic
          </Text>

          <Text
            style={
              styles.clinicName
            }
          >
            {clinicDisplay}
          </Text>

          {item.clinic_name &&
            item.clinic_contact_name && (
              <Text
                style={
                  styles.contactName
                }
              >
                Requested by{" "}
                {
                  item.clinic_contact_name
                }
              </Text>
            )}
        </View>
      </View>

      {/* DATE */}

      <View
        style={
          styles.dateRow
        }
      >
        <Ionicons
          name="calendar-outline"
          size={15}
          color="#849088"
        />

        <Text
          style={styles.dateText}
        >
          Requested{" "}
          {formatDate(
            item.requested_at
          )}
        </Text>
      </View>

      {/* PENDING ACTIONS */}

      {item.status ===
        "Pending" && (
        <View
          style={
            styles.actionRow
          }
        >
          <Pressable
            disabled={processing}
            style={({
              pressed,
            }) => [
              styles.declineButton,

              pressed &&
                !processing &&
                styles.pressed,

              processing &&
                styles.disabled,
            ]}
            onPress={onDecline}
          >
            <Ionicons
              name="close"
              size={18}
              color="#A3453C"
            />

            <Text
              style={
                styles.declineText
              }
            >
              Decline
            </Text>
          </Pressable>

          <Pressable
            disabled={processing}
            style={({
              pressed,
            }) => [
              styles.approveButton,

              pressed &&
                !processing &&
                styles.pressed,

              processing &&
                styles.disabled,
            ]}
            onPress={onApprove}
          >
            {processing ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="checkmark"
                  size={18}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.approveText
                  }
                >
                  Approve
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* APPROVED ACTION */}

      {item.status ===
        "Approved" && (
        <Pressable
          disabled={processing}
          style={({
            pressed,
          }) => [
            styles.revokeButton,

            pressed &&
              !processing &&
              styles.pressed,

            processing &&
              styles.disabled,
          ]}
          onPress={onRevoke}
        >
          {processing ? (
            <ActivityIndicator
              size="small"
              color="#A3453C"
            />
          ) : (
            <>
              <Ionicons
                name="shield-outline"
                size={17}
                color="#A3453C"
              />

              <Text
                style={
                  styles.revokeText
                }
              >
                Revoke Access
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({
  status,
}: {
  status: AuthorizationStatus;
}) {
  let icon:
    keyof typeof Ionicons.glyphMap =
    "time";

  let badgeStyle =
    styles.pendingBadge;

  let textStyle =
    styles.pendingBadgeText;

  if (status === "Approved") {
    icon =
      "checkmark-circle";

    badgeStyle =
      styles.approvedBadge;

    textStyle =
      styles.approvedBadgeText;
  }

  if (status === "Declined") {
    icon =
      "close-circle";

    badgeStyle =
      styles.declinedBadge;

    textStyle =
      styles.declinedBadgeText;
  }

  if (status === "Revoked") {
    icon =
      "remove-circle";

    badgeStyle =
      styles.revokedBadge;

    textStyle =
      styles.revokedBadgeText;
  }

  return (
    <View
      style={[
        styles.statusBadge,
        badgeStyle,
      ]}
    >
      <Ionicons
        name={icon}
        size={13}
        color={
          status === "Approved"
            ? "#176B3A"
            : status === "Pending"
            ? "#8B691C"
            : "#A3453C"
        }
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

// =====================================================
// DATE
// =====================================================

function formatDate(
  value: string
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

// =====================================================
// STYLES
// =====================================================

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#FFFDF7",
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
      fontSize: 18,
      fontWeight: "800",
      color: "#1E2D24",
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 45,
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
      color: "#76837B",
    },

    // INTRO

    introCard: {
      padding: 17,

      borderRadius: 18,

      backgroundColor:
        "#EAF4EB",

      flexDirection: "row",
      alignItems: "center",
    },

    introIcon: {
      width: 53,
      height: 53,

      borderRadius: 17,

      backgroundColor:
        "#FFFFFF",

      alignItems: "center",
      justifyContent:
        "center",
    },

    introContent: {
      flex: 1,
      marginLeft: 13,
    },

    introTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: "#23442F",
    },

    introText: {
      marginTop: 4,

      fontSize: 10,
      lineHeight: 15,

      color: "#607266",
    },

    // SUMMARY

    summaryRow: {
      marginTop: 16,

      flexDirection: "row",
      gap: 11,
    },

    summaryCard: {
      flex: 1,

      padding: 14,

      borderRadius: 17,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor:
        "#E2E8E3",

      flexDirection: "row",
      alignItems: "center",
    },

    summaryIcon: {
      width: 39,
      height: 39,

      borderRadius: 12,

      alignItems: "center",
      justifyContent:
        "center",
    },

    pendingSummaryIcon: {
      backgroundColor:
        "#FFF1C9",
    },

    approvedSummaryIcon: {
      backgroundColor:
        "#E5F2E7",
    },

    summaryNumber: {
      marginLeft: 10,

      fontSize: 19,
      fontWeight: "900",

      color: "#26352B",
    },

    summaryLabel: {
      marginLeft: 5,

      fontSize: 9,

      color: "#7B877F",
    },

    // SECTION

    sectionHeader: {
      marginTop: 26,
      marginBottom: 11,

      flexDirection: "row",
      alignItems: "center",
    },

    sectionTitle: {
      fontSize: 16,
      fontWeight: "900",

      color: "#26352B",
    },

    countBadge: {
      marginLeft: 8,

      minWidth: 23,
      height: 23,

      paddingHorizontal: 7,

      borderRadius: 12,

      backgroundColor:
        "#E7F2E8",

      alignItems: "center",
      justifyContent:
        "center",
    },

    countText: {
      fontSize: 10,
      fontWeight: "800",

      color: "#176B3A",
    },

    // REQUEST CARD

    requestCard: {
      marginBottom: 13,

      padding: 16,

      borderRadius: 19,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor:
        "#E1E7E2",
    },

    petSection: {
      flexDirection: "row",
      alignItems: "center",
    },

    petPhoto: {
      width: 53,
      height: 53,

      borderRadius: 17,

      backgroundColor:
        "#EAF2EB",
    },

    petPlaceholder: {
      width: 53,
      height: 53,

      borderRadius: 17,

      backgroundColor:
        "#EAF2EB",

      alignItems: "center",
      justifyContent:
        "center",
    },

    petInfo: {
      flex: 1,

      marginLeft: 11,
      marginRight: 7,
    },

    petName: {
      fontSize: 14,
      fontWeight: "900",

      color: "#26352B",
    },

    petBreed: {
      marginTop: 3,

      fontSize: 9,

      color: "#7D8981",
    },

    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,

      borderRadius: 20,

      flexDirection: "row",
      alignItems: "center",

      gap: 4,
    },

    statusText: {
      fontSize: 8,
      fontWeight: "800",
    },

    pendingBadge: {
      backgroundColor:
        "#FFF2CC",
    },

    pendingBadgeText: {
      color: "#8B691C",
    },

    approvedBadge: {
      backgroundColor:
        "#E5F2E7",
    },

    approvedBadgeText: {
      color: "#176B3A",
    },

    declinedBadge: {
      backgroundColor:
        "#FBE8E5",
    },

    declinedBadgeText: {
      color: "#A3453C",
    },

    revokedBadge: {
      backgroundColor:
        "#F3E8E7",
    },

    revokedBadgeText: {
      color: "#A3453C",
    },

    divider: {
      height: 1,

      marginVertical: 14,

      backgroundColor:
        "#EDF1EE",
    },

    // CLINIC

    clinicSection: {
      flexDirection: "row",
      alignItems: "center",
    },

    clinicIcon: {
      width: 43,
      height: 43,

      borderRadius: 14,

      backgroundColor:
        "#EAF4EB",

      alignItems: "center",
      justifyContent:
        "center",
    },

    clinicInfo: {
      flex: 1,
      marginLeft: 11,
    },

    clinicLabel: {
      fontSize: 8,
      fontWeight: "700",

      color: "#8B958F",
    },

    clinicName: {
      marginTop: 2,

      fontSize: 12,
      fontWeight: "800",

      color: "#31453A",
    },

    contactName: {
      marginTop: 2,

      fontSize: 8,

      color: "#849088",
    },

    dateRow: {
      marginTop: 13,

      flexDirection: "row",
      alignItems: "center",

      gap: 5,
    },

    dateText: {
      fontSize: 8,

      color: "#849088",
    },

    // ACTIONS

    actionRow: {
      marginTop: 15,

      flexDirection: "row",
      gap: 9,
    },

    declineButton: {
      flex: 1,
      height: 45,

      borderRadius: 13,

      borderWidth: 1,
      borderColor:
        "#E5C6C2",

      backgroundColor:
        "#FFF8F7",

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",

      gap: 6,
    },

    declineText: {
      fontSize: 11,
      fontWeight: "800",

      color: "#A3453C",
    },

    approveButton: {
      flex: 1,
      height: 45,

      borderRadius: 13,

      backgroundColor:
        "#176B3A",

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",

      gap: 6,
    },

    approveText: {
      fontSize: 11,
      fontWeight: "800",

      color: "#FFFFFF",
    },

    revokeButton: {
      marginTop: 15,

      height: 43,

      borderRadius: 13,

      borderWidth: 1,
      borderColor:
        "#E3C4C0",

      backgroundColor:
        "#FFF9F8",

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",

      gap: 6,
    },

    revokeText: {
      fontSize: 10,
      fontWeight: "800",

      color: "#A3453C",
    },

    disabled: {
      opacity: 0.55,
    },

    pressed: {
      opacity: 0.75,
    },

    // EMPTY

    emptyCard: {
      marginTop: 30,

      padding: 28,

      borderRadius: 20,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor:
        "#E2E8E3",

      alignItems: "center",
    },

    emptyIcon: {
      width: 70,
      height: 70,

      borderRadius: 23,

      backgroundColor:
        "#EDF4EE",

      alignItems: "center",
      justifyContent:
        "center",
    },

    emptyTitle: {
      marginTop: 13,

      fontSize: 16,
      fontWeight: "900",

      color: "#31453A",
    },

    emptyText: {
      marginTop: 6,

      maxWidth: 280,

      fontSize: 10,
      lineHeight: 16,

      textAlign: "center",

      color: "#7D8981",
    },

    // SECURITY

    securityCard: {
      marginTop: 25,

      padding: 14,

      borderRadius: 15,

      backgroundColor:
        "#EFF6F0",

      flexDirection: "row",
      alignItems: "flex-start",

      gap: 9,
    },

    securityText: {
      flex: 1,

      fontSize: 9,
      lineHeight: 15,

      color: "#617167",
    },
  });
