import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL, getImageUrl } from "../../../config/api";

type ClinicVetRecord = {
  record_id: number;
  pet_id: number;
  visit_date: string;
  service_type: string;
  diagnosis: string | null;
  created_at: string;
  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  owner_name: string;
  can_open: boolean;
};

export default function VetRecordsScreen() {
  const [records, setRecords] = useState<ClinicVetRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadRecords = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(false);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/vet-records/clinic`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      let data: any = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText };
      }

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load veterinary records.");
      }

      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (loadError) {
      console.log("CLINIC-WIDE VET RECORDS ERROR:", loadError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords]),
  );

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            record.pet_name,
            record.owner_name,
            record.breed,
            record.species,
            record.service_type,
            record.diagnosis,
          ].some((value) =>
            String(value || "")
              .toLocaleLowerCase()
              .includes(normalizedSearch),
          );

        return matchesSearch;
      }),
    [normalizedSearch, records],
  );

  const hasActiveFilters = normalizedSearch.length > 0;

  const resetFilters = () => {
    setSearch("");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
        </Pressable>
        <Text style={styles.headerTitle}>Vet Records</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={["#2E7D6B"]}
            tintColor="#2E7D6B"
            onRefresh={() => {
              setRefreshing(true);
              loadRecords(false);
            }}
          />
        }
      >
        <Text style={styles.subtitle}>
          Veterinary services recorded by your clinic
        </Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#6B7C73" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search records..."
            placeholderTextColor="#6B7C73"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => setSearch("")}
            >
              <Ionicons name="close-circle" size={20} color="#6B7C73" />
            </Pressable>
          )}
        </View>

        {!loading && !error && records.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTitle}>Veterinary Records</Text>
            <Text style={styles.summaryCount}>
              {filteredRecords.length}{" "}
              {filteredRecords.length === 1 ? "record" : "records"}
            </Text>
          </View>
        )}

        {loading ? (
          <StateCard>
            <ActivityIndicator color="#2E7D6B" />
            <Text style={styles.loadingText}>
              Loading veterinary records...
            </Text>
          </StateCard>
        ) : error ? (
          <StateCard>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#E57373" />
            </View>
            <Text style={styles.stateTitle}>
              Unable to load veterinary records.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
              onPress={() => loadRecords()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </StateCard>
        ) : records.length === 0 ? (
          <StateCard>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="document-text-outline"
                size={29}
                color="#2E7D6B"
              />
            </View>
            <Text style={styles.stateTitle}>No veterinary records yet</Text>
            <Text style={styles.stateDescription}>
              Records created for authorized pets will appear here.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.authorizedPetsButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/authorized-pets")}
            >
              <Ionicons name="paw-outline" size={18} color="#FFFFFF" />
              <Text style={styles.authorizedPetsButtonText}>
                View Authorized Pets
              </Text>
            </Pressable>
          </StateCard>
        ) : filteredRecords.length === 0 ? (
          <StateCard>
            <View style={styles.emptyIconMuted}>
              <Ionicons name="search-outline" size={29} color="#6B7C73" />
            </View>
            <Text style={styles.stateTitle}>No matching records</Text>
            <Text style={styles.stateDescription}>
              Try another pet name or service.
            </Text>
            {hasActiveFilters && (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.resetButton,
                  pressed && styles.pressed,
                ]}
                onPress={resetFilters}
              >
                <Text style={styles.resetText}>Reset Filters</Text>
              </Pressable>
            )}
          </StateCard>
        ) : (
          <View style={styles.recordList}>
            {filteredRecords.map((record) => (
              <RecordCard key={record.record_id} record={record} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecordCard({ record }: { record: ClinicVetRecord }) {
  const imageUrl = getImageUrl(record.photo_url);

  const openRecordContext = () => {
    if (record.can_open) {
      router.push({
        pathname: "/clinic-vet-records",
        params: {
          petId: String(record.pet_id),
          recordId: String(record.record_id),
        },
      });
      return;
    }

    router.push({
      pathname: "/clinic-pet",
      params: { petId: String(record.pet_id) },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.recordCard,
        pressed && styles.cardPressed,
      ]}
      onPress={openRecordContext}
    >
      <View style={styles.photoContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.petPhoto} />
        ) : (
          <Ionicons name="paw" size={25} color="#2E7D6B" />
        )}
      </View>

      <View style={styles.recordContent}>
        <View style={styles.recordTopRow}>
          <Text style={styles.petName} numberOfLines={1}>
            {record.pet_name}
          </Text>
          <View style={styles.serviceBadge}>
            <Text style={styles.serviceBadgeText}>{record.service_type}</Text>
          </View>
        </View>
        <Text style={styles.petContext} numberOfLines={1}>
          Owner: {record.owner_name || "—"}
        </Text>
        {record.diagnosis && (
          <Text style={styles.diagnosis} numberOfLines={1}>
            {record.diagnosis}
          </Text>
        )}
        <View style={styles.recordBottomRow}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color="#6B7C73" />
            <Text style={styles.visitDate}>
              {formatDate(record.visit_date)}
            </Text>
          </View>
          {!record.can_open && (
            <Text style={styles.accessChanged}>Access changed</Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={19} color="#6B7C73" />
    </Pressable>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.stateCard}>{children}</View>;
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").slice(0, 10));
  if (!match) return "Date unavailable";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  header: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#CFE8DD",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#2E3A34" },
  headerSpacer: { width: 44, height: 44 },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 45 },
  subtitle: { fontSize: 14, color: "#6B7C73" },
  searchContainer: {
    minHeight: 50,
    marginTop: 17,
    borderRadius: 15,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    marginHorizontal: 10,
    paddingVertical: 0,
    fontSize: 15,
    color: "#2E3A34",
  },
  summaryRow: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTitle: { fontSize: 19, fontWeight: "900", color: "#2E3A34" },
  summaryCount: { fontSize: 12, fontWeight: "700", color: "#6B7C73" },
  recordList: { gap: 10 },
  recordCard: {
    minHeight: 132,
    borderRadius: 19,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  photoContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  petPhoto: { width: "100%", height: "100%" },
  recordContent: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 6 },
  recordTopRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  petName: { flex: 1, fontSize: 17, fontWeight: "900", color: "#2E3A34" },
  serviceBadge: {
    maxWidth: "48%",
    minHeight: 24,
    borderRadius: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CFE8DD",
  },
  serviceBadgeText: { fontSize: 11, fontWeight: "900", color: "#2E7D6B" },
  petContext: { marginTop: 4, fontSize: 12, color: "#6B7C73" },
  diagnosis: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: "700",
    color: "#56B091",
  },
  recordBottomRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  visitDate: { fontSize: 11, color: "#6B7C73" },
  accessChanged: { fontSize: 11, fontWeight: "800", color: "#F5A623" },
  stateCard: {
    minHeight: 245,
    marginTop: 24,
    borderRadius: 19,
    padding: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, fontSize: 13, color: "#6B7C73" },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFF5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconMuted: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(229, 115, 115, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    marginTop: 13,
    fontSize: 16,
    fontWeight: "900",
    color: "#2E3A34",
    textAlign: "center",
  },
  stateDescription: {
    maxWidth: 270,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: "#6B7C73",
    textAlign: "center",
  },
  retryButton: {
    minWidth: 102,
    minHeight: 44,
    marginTop: 17,
    borderRadius: 12,
    paddingHorizontal: 18,
    backgroundColor: "#2E7D6B",
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  authorizedPetsButton: {
    minHeight: 46,
    marginTop: 18,
    borderRadius: 13,
    paddingHorizontal: 18,
    backgroundColor: "#2E7D6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  authorizedPetsButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  resetButton: {
    minHeight: 43,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    paddingHorizontal: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { fontSize: 12, fontWeight: "800", color: "#2E7D6B" },
  pressed: { opacity: 0.7 },
});
