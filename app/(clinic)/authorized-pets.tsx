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

import { API_URL, getImageUrl } from "../../config/api";

type AuthorizedPet = {
  authorization_id: number;
  pet_id: number;
  status: "Approved";
  requested_at: string;
  responded_at: string | null;
  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
};

export default function AuthorizedPetsScreen() {
  const [pets, setPets] = useState<AuthorizedPet[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadAuthorizedPets = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(false);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/authorizations/clinic`, {
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
        throw new Error(data.message || "Unable to load authorized pets.");
      }

      const authorizations = Array.isArray(data.authorizations)
        ? data.authorizations
        : [];

      setPets(
        authorizations.filter(
          (item: { status?: string }) => item.status === "Approved"
        )
      );
    } catch (loadError) {
      console.log("AUTHORIZED PETS LOAD ERROR:", loadError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAuthorizedPets();
    }, [loadAuthorizedPets])
  );

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredPets = useMemo(() => {
    if (!normalizedSearch) return pets;

    return pets.filter((pet) =>
      [pet.pet_name, pet.breed, pet.species].some((value) =>
        String(value || "")
          .toLocaleLowerCase()
          .includes(normalizedSearch)
      )
    );
  }, [normalizedSearch, pets]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={27} color="#173D2A" />
        </Pressable>
        <Text style={styles.headerTitle}>Authorized Pets</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={["#176B3A"]}
            tintColor="#176B3A"
            onRefresh={() => {
              setRefreshing(true);
              loadAuthorizedPets(false);
            }}
          />
        }
      >
        <Text style={styles.subtitle}>Pets your clinic can currently manage</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#718078" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search pets..."
            placeholderTextColor="#929D96"
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
              <Ionicons name="close-circle" size={20} color="#89958E" />
            </Pressable>
          )}
        </View>

        {!loading && !error && pets.length > 0 && (
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Authorized Pets</Text>
            <Text style={styles.resultCount}>
              {filteredPets.length} {filteredPets.length === 1 ? "pet" : "pets"}
            </Text>
          </View>
        )}

        {loading ? (
          <StateCard>
            <ActivityIndicator color="#176B3A" />
            <Text style={styles.loadingText}>Loading authorized pets...</Text>
          </StateCard>
        ) : error ? (
          <StateCard>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#A7483E" />
            </View>
            <Text style={styles.stateTitle}>Unable to load authorized pets.</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              onPress={() => loadAuthorizedPets()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </StateCard>
        ) : pets.length === 0 ? (
          <StateCard>
            <View style={styles.emptyIcon}>
              <Ionicons name="shield-checkmark-outline" size={29} color="#176B3A" />
            </View>
            <Text style={styles.stateTitle}>No authorized pets yet</Text>
            <Text style={styles.stateDescription}>
              Scan a pet QR code and request owner access to begin.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
              onPress={() => router.push("/qr-scanner")}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.scanButtonText}>Scan Pet QR</Text>
            </Pressable>
          </StateCard>
        ) : filteredPets.length === 0 ? (
          <StateCard>
            <View style={styles.emptyIconMuted}>
              <Ionicons name="search-outline" size={29} color="#66746B" />
            </View>
            <Text style={styles.stateTitle}>No pets found</Text>
            <Text style={styles.stateDescription}>
              Try another pet name, breed, or species.
            </Text>
          </StateCard>
        ) : (
          <View style={styles.petList}>
            {filteredPets.map((pet) => (
              <PetCard key={pet.authorization_id} pet={pet} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PetCard({ pet }: { pet: AuthorizedPet }) {
  const imageUrl = getImageUrl(pet.photo_url);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.petCard, pressed && styles.cardPressed]}
      onPress={() =>
        router.push({
          pathname: "/clinic-pet",
          params: { petId: String(pet.pet_id) },
        })
      }
    >
      <View style={styles.photoContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.petPhoto} />
        ) : (
          <Ionicons name="paw" size={27} color="#176B3A" />
        )}
      </View>

      <View style={styles.petContent}>
        <Text style={styles.petName} numberOfLines={1}>{pet.pet_name}</Text>
        <Text style={styles.petBreed} numberOfLines={1}>
          {pet.breed || "Breed not specified"}
        </Text>
        <Text style={styles.petSpecies}>{pet.species}</Text>
        <View style={styles.petMetaRow}>
          <View style={styles.authorizedBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#176B3A" />
            <Text style={styles.authorizedText}>AUTHORIZED</Text>
          </View>
          {pet.responded_at && (
            <Text style={styles.authorizedDate} numberOfLines={1}>
              Authorized {formatDate(pet.responded_at)}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#95A099" />
    </Pressable>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.stateCard}>{children}</View>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFDF7" },
  header: { height: 60, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E9EDE9" },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 19, fontWeight: "900", color: "#1E2D24" },
  headerSpacer: { width: 44, height: 44 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 45 },
  subtitle: { fontSize: 12, color: "#77847C" },
  searchContainer: { minHeight: 50, marginTop: 17, borderRadius: 15, paddingHorizontal: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE5DF", flexDirection: "row", alignItems: "center" },
  searchInput: { flex: 1, minHeight: 48, marginHorizontal: 10, paddingVertical: 0, fontSize: 13, color: "#26372C" },
  resultHeader: { marginTop: 24, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultTitle: { fontSize: 17, fontWeight: "900", color: "#1E2D24" },
  resultCount: { fontSize: 10, fontWeight: "700", color: "#718078" },
  petList: { gap: 10 },
  petCard: { minHeight: 128, borderRadius: 19, padding: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E8E3", flexDirection: "row", alignItems: "center" },
  cardPressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  photoContainer: { width: 72, height: 72, borderRadius: 22, overflow: "hidden", backgroundColor: "#EAF4EB", alignItems: "center", justifyContent: "center" },
  petPhoto: { width: "100%", height: "100%" },
  petContent: { flex: 1, minWidth: 0, marginLeft: 13, marginRight: 7 },
  petName: { fontSize: 16, fontWeight: "900", color: "#27372D" },
  petBreed: { marginTop: 3, fontSize: 11, color: "#68766E" },
  petSpecies: { marginTop: 2, fontSize: 9, fontWeight: "700", color: "#8A958E" },
  petMetaRow: { marginTop: 10, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  authorizedBadge: { minHeight: 24, borderRadius: 9, paddingHorizontal: 7, backgroundColor: "#E5F3E8", flexDirection: "row", alignItems: "center", gap: 4 },
  authorizedText: { fontSize: 7, fontWeight: "900", color: "#176B3A", letterSpacing: 0.3 },
  authorizedDate: { maxWidth: 130, fontSize: 8, color: "#929C96" },
  stateCard: { minHeight: 245, marginTop: 24, borderRadius: 19, padding: 25, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E8E3", alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 11, color: "#77847C" },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#E8F4EA", alignItems: "center", justifyContent: "center" },
  emptyIconMuted: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
  errorIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#FDEDEA", alignItems: "center", justifyContent: "center" },
  stateTitle: { marginTop: 13, fontSize: 14, fontWeight: "900", color: "#34453B", textAlign: "center" },
  stateDescription: { maxWidth: 270, marginTop: 6, fontSize: 10, lineHeight: 16, color: "#77847C", textAlign: "center" },
  retryButton: { minWidth: 102, minHeight: 44, marginTop: 17, borderRadius: 12, paddingHorizontal: 18, backgroundColor: "#176B3A", alignItems: "center", justifyContent: "center" },
  retryText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF" },
  scanButton: { minHeight: 46, marginTop: 18, borderRadius: 13, paddingHorizontal: 18, backgroundColor: "#176B3A", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  scanButtonText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF" },
  pressed: { opacity: 0.7 },
});
