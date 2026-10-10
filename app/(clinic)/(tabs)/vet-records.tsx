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
import { timanShadow } from "../../../components/timan/theme";

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

type PetRecordFolder = {
  petId: number;
  petName: string;
  ownerName: string;
  species: string;
  breed: string | null;
  photoUrl: string | null;
  records: ClinicVetRecord[];
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function VetRecordsScreen() {
  const [records, setRecords] = useState<ClinicVetRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
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
  const availableLetters = useMemo(
    () => new Set(records.map((record) => getNameInitial(record.pet_name))),
    [records],
  );

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
        const matchesLetter =
          !selectedLetter || getNameInitial(record.pet_name) === selectedLetter;
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

        return matchesLetter && matchesSearch;
      });
  }, [normalizedSearch, records, selectedLetter]);

  const recordFolders = useMemo(() => {
    const folders = new Map<number, PetRecordFolder>();

    filteredRecords.forEach((record) => {
      const current = folders.get(record.pet_id);
      if (current) {
        current.records.push(record);
        return;
      }

      folders.set(record.pet_id, {
        petId: record.pet_id,
        petName: record.pet_name,
        ownerName: record.owner_name,
        species: record.species,
        breed: record.breed,
        photoUrl: record.photo_url,
        records: [record],
      });
    });

    return Array.from(folders.values()).sort((left, right) =>
      left.petName.localeCompare(right.petName),
    );
  }, [filteredRecords]);

  const hasActiveFilters =
    normalizedSearch.length > 0 || selectedLetter !== null;

  const resetFilters = () => {
    setSearch("");
    setSelectedLetter(null);
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
            onChangeText={(value) => {
              setSearch(value);
            }}
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
            <View>
              <Text style={styles.summaryTitle}>Pet Record Folders</Text>
              {selectedLetter ? (
                <Text style={styles.activeLetterText}>
                  Names beginning with {selectedLetter}
                </Text>
              ) : null}
            </View>
            <Text style={styles.summaryCount}>
              {recordFolders.length} {recordFolders.length === 1 ? "pet" : "pets"}
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
        ) : recordFolders.length === 0 ? (
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
          <View style={styles.recordsBrowser}>
            <View style={styles.folderList}>
              {recordFolders.map((folder) => (
                <PetFolder key={folder.petId} folder={folder} />
              ))}
            </View>

            <View style={styles.alphabetRail}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show all pet names"
                onPress={() => {
                  setSelectedLetter(null);
                }}
                style={({ pressed }) => [
                  styles.letterButton,
                  selectedLetter === null && styles.letterButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.letterText,
                    selectedLetter === null && styles.letterTextSelected,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {ALPHABET.map((letter) => {
                const available = availableLetters.has(letter);
                const selected = selectedLetter === letter;
                return (
                  <Pressable
                    key={letter}
                    accessibilityRole="button"
                    accessibilityLabel={`Show pet names beginning with ${letter}`}
                    disabled={!available}
                    onPress={() => {
                      setSelectedLetter(letter);
                    }}
                    style={({ pressed }) => [
                      styles.letterButton,
                      selected && styles.letterButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.letterText,
                        !available && styles.letterTextDisabled,
                        selected && styles.letterTextSelected,
                      ]}
                    >
                      {letter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PetFolder({
  folder,
}: {
  folder: PetRecordFolder;
}) {
  const imageUrl = getImageUrl(folder.photoUrl);
  const canOpen = folder.records.some((record) => record.can_open);

  const openFolder = () => {
    router.push({
      pathname: canOpen ? "/clinic-vet-records" : "/clinic-pet",
      params: { petId: String(folder.petId) },
    });
  };

  return (
    <View style={styles.folderCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${folder.petName}'s veterinary record folder`}
        style={({ pressed }) => [
          styles.folderHeader,
          pressed && styles.cardPressed,
        ]}
        onPress={openFolder}
      >
        <View style={styles.folderIcon}>
          <Ionicons name="folder" size={27} color="#2E7D6B" />
        </View>
        <View style={styles.folderPhotoContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.petPhoto} />
          ) : (
            <Ionicons name="paw" size={22} color="#2E7D6B" />
          )}
        </View>
        <View style={styles.folderContent}>
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.petName}
          </Text>
          <Text style={styles.folderOwner} numberOfLines={1}>
            Owner: {folder.ownerName || "—"}
          </Text>
          <Text style={styles.folderMeta} numberOfLines={1}>
            {[folder.species, folder.breed].filter(Boolean).join(" • ")}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={19}
          color="#6B7C73"
        />
      </Pressable>
    </View>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.stateCard}>{children}</View>;
}

function getNameInitial(value: string) {
  const initial = value.trim().charAt(0).toLocaleUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : "#";
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
  activeLetterText: {
    marginTop: 2,
    fontSize: 11,
    color: "#2E7D6B",
  },
  summaryCount: { fontSize: 12, fontWeight: "700", color: "#6B7C73" },
  recordsBrowser: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  folderList: { flex: 1, minWidth: 0, gap: 10 },
  alphabetRail: {
    width: 32,
    borderRadius: 16,
    paddingVertical: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    alignItems: "center",
  },
  letterButton: {
    width: 28,
    minHeight: 19,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  letterButtonSelected: { backgroundColor: "#2E7D6B" },
  letterText: { fontSize: 9, fontWeight: "800", color: "#2E7D6B" },
  letterTextSelected: { color: "#FFFFFF" },
  letterTextDisabled: { color: "#B8C8C0" },
  folderCard: {
    ...timanShadow,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
    overflow: "hidden",
  },
  folderHeader: {
    minHeight: 104,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  folderIcon: {
    width: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  folderPhotoContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#CFE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  folderContent: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 6 },
  folderName: { fontSize: 17, fontWeight: "900", color: "#2E3A34" },
  folderOwner: { marginTop: 3, fontSize: 11, color: "#6B7C73" },
  folderMeta: { marginTop: 4, fontSize: 11, color: "#56B091" },
  cardPressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  petPhoto: { width: "100%", height: "100%" },
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
