import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
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

import { API_URL, getImageUrl } from "../../config/api";

type AuthorizationStatus = "Pending" | "Approved" | "Declined" | "Revoked";

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

export default function ClinicAuthorizationScreen() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadAuthorizations = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");

        return;
      }

      const response = await fetch(`${API_URL}/authorizations/owner`, {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },
      });

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          message: text,
        };
      }

      console.log("OWNER AUTHORIZATION STATUS:", response.status);

      console.log("OWNER AUTHORIZATION RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Load",
          data.message || "Unable to load clinic requests.",
        );

        return;
      }

      setAuthorizations(
        Array.isArray(data.authorizations) ? data.authorizations : [],
      );
    } catch (error) {
      console.log("LOAD AUTHORIZATION ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAuthorizations();

      return () => {};
    }, [loadAuthorizations]),
  );

  const onRefresh = () => {
    setRefreshing(true);

    loadAuthorizations(false);
  };

  const updateAuthorization = async (
    authorizationId: number,
    action: "approve" | "decline" | "revoke",
  ) => {
    if (processingId !== null) {
      return;
    }

    try {
      setProcessingId(authorizationId);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");

        return;
      }

      const response = await fetch(
        `${API_URL}/authorizations/${authorizationId}/${action}`,
        {
          method: "PATCH",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          message: text,
        };
      }

      console.log("AUTHORIZATION ACTION:", action);

      console.log("AUTHORIZATION ACTION STATUS:", response.status);

      console.log("AUTHORIZATION ACTION RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Action Failed",
          data.message || "Unable to update clinic access.",
        );

        return;
      }

      let title = "Access Updated";

      if (action === "approve") {
        title = "Clinic Approved";
      }

      if (action === "decline") {
        title = "Request Declined";
      }

      if (action === "revoke") {
        title = "Access Revoked";
      }

      Alert.alert(title, data.message || "Clinic authorization updated.");

      await loadAuthorizations(false);
    } catch (error) {
      console.log("UPDATE AUTHORIZATION ERROR:", error);

      Alert.alert("Connection Error", "Unable to update clinic access.");
    } finally {
      setProcessingId(null);
    }
  };

  const confirmApprove = (item: Authorization) => {
    Alert.alert(
      "Approve Clinic Access",
      `Allow ${
        item.clinic_name || item.clinic_contact_name
      } to access and manage ${item.pet_name}'s veterinary records?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Approve",

          onPress: () => updateAuthorization(item.authorization_id, "approve"),
        },
      ],
    );
  };

  const confirmDecline = (item: Authorization) => {
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

          onPress: () => updateAuthorization(item.authorization_id, "decline"),
        },
      ],
    );
  };

  const confirmRevoke = (item: Authorization) => {
    Alert.alert(
      "Revoke Clinic Access",
      `Remove ${
        item.clinic_name || item.clinic_contact_name
      }'s access to ${item.pet_name}'s veterinary records?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Revoke",
          style: "destructive",

          onPress: () => updateAuthorization(item.authorization_id, "revoke"),
        },
      ],
    );
  };

  const pendingCount = authorizations.filter(
    (item) => item.status === "Pending",
  ).length;

  const approvedCount = authorizations.filter(
    (item) => item.status === "Approved",
  ).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />

        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E7D6B" />

          <Text style={styles.loadingText}>Loading clinic requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={30}
              color="#2E7D6B"
            />
          </View>

          <View style={styles.introContent}>
            <Text style={styles.introTitle}>Clinic Access</Text>

            <Text style={styles.introText}>
              You control which veterinary clinics can access and update your
              pet&apos;s veterinary records.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, styles.pendingSummaryIcon]}>
              <Ionicons name="time-outline" size={21} color="#E57373" />
            </View>

            <Text style={styles.summaryNumber}>{pendingCount}</Text>

            <Text style={styles.summaryLabel}>Pending</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, styles.approvedSummaryIcon]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={21}
                color="#2E7D6B"
              />
            </View>

            <Text style={styles.summaryNumber}>{approvedCount}</Text>

            <Text style={styles.summaryLabel}>Approved</Text>
          </View>
        </View>

        {authorizations.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="business-outline" size={35} color="#81C784" />
            </View>

            <Text style={styles.emptyTitle}>No Clinic Requests</Text>

            <Text style={styles.emptyText}>
              Clinic access requests will appear here after a veterinary clinic
              scans your pet&apos;s TIMAN QR and requests access.
            </Text>
          </View>
        ) : (
          <>
            {pendingCount > 0 && (
              <>
                <SectionHeader title="Pending Requests" count={pendingCount} />

                {authorizations
                  .filter((item) => item.status === "Pending")
                  .map((item) => (
                    <AuthorizationCard
                      key={item.authorization_id}
                      item={item}
                      processing={processingId === item.authorization_id}
                      onApprove={() => confirmApprove(item)}
                      onDecline={() => confirmDecline(item)}
                      onRevoke={() => {}}
                    />
                  ))}
              </>
            )}

            {approvedCount > 0 && (
              <>
                <SectionHeader
                  title="Authorized Clinics"
                  count={approvedCount}
                />

                {authorizations
                  .filter((item) => item.status === "Approved")
                  .map((item) => (
                    <AuthorizationCard
                      key={item.authorization_id}
                      item={item}
                      processing={processingId === item.authorization_id}
                      onApprove={() => {}}
                      onDecline={() => {}}
                      onRevoke={() => confirmRevoke(item)}
                    />
                  ))}
              </>
            )}

            {authorizations.some(
              (item) => item.status === "Declined" || item.status === "Revoked",
            ) && (
              <>
                <SectionHeader title="Previous Access" />

                {authorizations
                  .filter(
                    (item) =>
                      item.status === "Declined" || item.status === "Revoked",
                  )
                  .map((item) => (
                    <AuthorizationCard
                      key={item.authorization_id}
                      item={item}
                      processing={false}
                      onApprove={() => {}}
                      onDecline={() => {}}
                      onRevoke={() => {}}
                    />
                  ))}
              </>
            )}
          </>
        )}

        <View style={styles.securityCard}>
          <Ionicons name="lock-closed-outline" size={19} color="#2E7D6B" />

          <Text style={styles.securityText}>
            Clinics cannot access protected veterinary records until you approve
            their request. You may revoke approved access later.
          </Text>
        </View>
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
          pressed && styles.pressed,
        ]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
      </Pressable>

      <Text style={styles.headerTitle}>Clinic Authorization</Text>

      <View style={styles.headerButton} />
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {count !== undefined && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

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
  const photoUrl = getImageUrl(item.photo_url);

  const clinicDisplay =
    item.clinic_name || item.clinic_contact_name || "Veterinary Clinic";

  return (
    <View style={styles.requestCard}>
      <View style={styles.petSection}>
        {photoUrl ? (
          <Image
            source={{
              uri: photoUrl,
            }}
            style={styles.petPhoto}
          />
        ) : (
          <View style={styles.petPlaceholder}>
            <Ionicons name="paw" size={25} color="#81C784" />
          </View>
        )}

        <View style={styles.petInfo}>
          <Text style={styles.petName}>{item.pet_name}</Text>

          <Text style={styles.petBreed}>{item.breed || item.species}</Text>
        </View>

        <StatusBadge status={item.status} />
      </View>

      <View style={styles.divider} />

      <View style={styles.clinicSection}>
        <View style={styles.clinicIcon}>
          <Ionicons name="medical-outline" size={23} color="#2E7D6B" />
        </View>

        <View style={styles.clinicInfo}>
          <Text style={styles.clinicLabel}>Veterinary Clinic</Text>

          <Text style={styles.clinicName}>{clinicDisplay}</Text>

          {item.clinic_name && item.clinic_contact_name && (
            <Text style={styles.contactName}>
              Requested by {item.clinic_contact_name}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={15} color="#6B7C73" />

        <Text style={styles.dateText}>
          Requested {formatDate(item.requested_at)}
        </Text>
      </View>

      {item.status === "Pending" && (
        <View style={styles.actionRow}>
          <Pressable
            disabled={processing}
            style={({ pressed }) => [
              styles.declineButton,

              pressed && !processing && styles.pressed,

              processing && styles.disabled,
            ]}
            onPress={onDecline}
          >
            <Ionicons name="close" size={18} color="#E57373" />

            <Text style={styles.declineText}>Decline</Text>
          </Pressable>

          <Pressable
            disabled={processing}
            style={({ pressed }) => [
              styles.approveButton,

              pressed && !processing && styles.pressed,

              processing && styles.disabled,
            ]}
            onPress={onApprove}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />

                <Text style={styles.approveText}>Approve</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {item.status === "Approved" && (
        <Pressable
          disabled={processing}
          style={({ pressed }) => [
            styles.revokeButton,

            pressed && !processing && styles.pressed,

            processing && styles.disabled,
          ]}
          onPress={onRevoke}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#E57373" />
          ) : (
            <>
              <Ionicons name="shield-outline" size={17} color="#E57373" />

              <Text style={styles.revokeText}>Revoke Access</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: AuthorizationStatus }) {
  let icon: keyof typeof Ionicons.glyphMap = "time";

  let badgeStyle = styles.pendingBadge;

  let textStyle = styles.pendingBadgeText;

  if (status === "Approved") {
    icon = "checkmark-circle";

    badgeStyle = styles.approvedBadge;

    textStyle = styles.approvedBadgeText;
  }

  if (status === "Declined") {
    icon = "close-circle";

    badgeStyle = styles.declinedBadge;

    textStyle = styles.declinedBadgeText;
  }

  if (status === "Revoked") {
    icon = "remove-circle";

    badgeStyle = styles.revokedBadge;

    textStyle = styles.revokedBadgeText;
  }

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Ionicons
        name={icon}
        size={13}
        color={
          status === "Approved"
            ? "#2E7D6B"
            : status === "Pending"
              ? "#E57373"
              : "#E57373"
        }
      />

      <Text style={[styles.statusText, textStyle]}>{status}</Text>
    </View>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2E3A34",
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 45,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,

    fontSize: 12,
    color: "#6B7C73",
  },

  introCard: {
    padding: 17,

    borderRadius: 18,

    backgroundColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "center",
  },

  introIcon: {
    width: 53,
    height: 53,

    borderRadius: 17,

    backgroundColor: "#FFFFFF",

    alignItems: "center",
    justifyContent: "center",
  },

  introContent: {
    flex: 1,
    marginLeft: 13,
  },

  introTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E3A34",
  },

  introText: {
    marginTop: 4,

    fontSize: 10,
    lineHeight: 15,

    color: "#6B7C73",
  },

  summaryRow: {
    marginTop: 16,

    flexDirection: "row",
    gap: 11,
  },

  summaryCard: {
    flex: 1,

    padding: 14,

    borderRadius: 17,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "center",
  },

  summaryIcon: {
    width: 39,
    height: 39,

    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",
  },

  pendingSummaryIcon: {
    backgroundColor: "#FAD7A0",
  },

  approvedSummaryIcon: {
    backgroundColor: "#CFE8DD",
  },

  summaryNumber: {
    marginLeft: 10,

    fontSize: 19,
    fontWeight: "900",

    color: "#2E3A34",
  },

  summaryLabel: {
    marginLeft: 5,

    fontSize: 9,

    color: "#6B7C73",
  },

  sectionHeader: {
    marginTop: 26,
    marginBottom: 11,

    flexDirection: "row",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",

    color: "#2E3A34",
  },

  countBadge: {
    marginLeft: 8,

    minWidth: 23,
    height: 23,

    paddingHorizontal: 7,

    borderRadius: 12,

    backgroundColor: "#CFE8DD",

    alignItems: "center",
    justifyContent: "center",
  },

  countText: {
    fontSize: 10,
    fontWeight: "800",

    color: "#2E7D6B",
  },

  requestCard: {
    ...timanShadow,
    marginBottom: 13,

    padding: 16,

    borderRadius: 19,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",
  },

  petSection: {
    flexDirection: "row",
    alignItems: "center",
  },

  petPhoto: {
    width: 53,
    height: 53,

    borderRadius: 17,

    backgroundColor: "#FFF5E9",
  },

  petPlaceholder: {
    width: 53,
    height: 53,

    borderRadius: 17,

    backgroundColor: "#FFF5E9",

    alignItems: "center",
    justifyContent: "center",
  },

  petInfo: {
    flex: 1,

    marginLeft: 11,
    marginRight: 7,
  },

  petName: {
    fontSize: 14,
    fontWeight: "900",

    color: "#2E3A34",
  },

  petBreed: {
    marginTop: 3,

    fontSize: 9,

    color: "#6B7C73",
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
    backgroundColor: "#FAD7A0",
  },

  pendingBadgeText: {
    color: "#F5A623",
  },

  approvedBadge: {
    backgroundColor: "#CFE8DD",
  },

  approvedBadgeText: {
    color: "#81C784",
  },

  declinedBadge: {
    backgroundColor: "rgba(229, 115, 115, 0.14)",
  },

  declinedBadgeText: {
    color: "#E57373",
  },

  revokedBadge: {
    backgroundColor: "#FFF5E9",
  },

  revokedBadgeText: {
    color: "#E57373",
  },

  divider: {
    height: 1,

    marginVertical: 14,

    backgroundColor: "#CFE8DD",
  },

  clinicSection: {
    flexDirection: "row",
    alignItems: "center",
  },

  clinicIcon: {
    width: 43,
    height: 44,

    borderRadius: 14,

    backgroundColor: "#CFE8DD",

    alignItems: "center",
    justifyContent: "center",
  },

  clinicInfo: {
    flex: 1,
    marginLeft: 11,
  },

  clinicLabel: {
    fontSize: 8,
    fontWeight: "700",

    color: "#6B7C73",
  },

  clinicName: {
    marginTop: 2,

    fontSize: 12,
    fontWeight: "800",

    color: "#2E3A34",
  },

  contactName: {
    marginTop: 2,

    fontSize: 8,

    color: "#6B7C73",
  },

  dateRow: {
    marginTop: 13,

    flexDirection: "row",
    alignItems: "center",

    gap: 5,
  },

  dateText: {
    fontSize: 8,

    color: "#6B7C73",
  },

  actionRow: {
    marginTop: 15,

    flexDirection: "row",
    gap: 9,
  },

  declineButton: {
    flex: 1,
    height: 48,

    borderRadius: 13,

    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.14)",

    backgroundColor: "#FFF5E9",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 6,
  },

  declineText: {
    fontSize: 11,
    fontWeight: "800",

    color: "#E57373",
  },

  approveButton: {
    flex: 1,
    height: 48,

    borderRadius: 13,

    backgroundColor: "#2E7D6B",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

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
    borderColor: "rgba(229, 115, 115, 0.14)",

    backgroundColor: "#FFF5E9",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 6,
  },

  revokeText: {
    fontSize: 10,
    fontWeight: "800",

    color: "#E57373",
  },

  disabled: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.75,
  },

  emptyCard: {
    marginTop: 30,

    padding: 28,

    borderRadius: 20,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",

    alignItems: "center",
  },

  emptyIcon: {
    width: 70,
    height: 70,

    borderRadius: 23,

    backgroundColor: "#CFE8DD",

    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 13,

    fontSize: 16,
    fontWeight: "900",

    color: "#2E3A34",
  },

  emptyText: {
    marginTop: 6,

    maxWidth: 280,

    fontSize: 10,
    lineHeight: 16,

    textAlign: "center",

    color: "#6B7C73",
  },

  securityCard: {
    marginTop: 25,

    padding: 14,

    borderRadius: 15,

    backgroundColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "flex-start",

    gap: 9,
  },

  securityText: {
    flex: 1,

    fontSize: 9,
    lineHeight: 15,

    color: "#6B7C73",
  },
});
