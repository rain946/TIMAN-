import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, getImageUrl } from "../../config/api";

type ArchivedPet = {
  pet_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  archive_reason: string;
  archived_at: string;
};

export default function ArchivedPetsScreen() {
  const [pets, setPets] = useState<ArchivedPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const loadPets = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return router.replace("/login");
      const response = await fetch(`${API_URL}/pets/archived/list`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setPets(Array.isArray(data.pets) ? data.pets : []);
    } catch (error) {
      Alert.alert("Unable to Load", error instanceof Error ? error.message : "Unable to load archived pets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadPets(); }, [loadPets]));

  const restorePet = async (pet: ArchivedPet) => {
    try {
      setRestoringId(pet.pet_id);
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${API_URL}/pets/${pet.pet_id}/restore`, {
        method: "PATCH",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setPets((current) => current.filter((item) => item.pet_id !== pet.pet_id));
      Alert.alert("Pet Restored", `${pet.pet_name} is visible in My Pets again.`);
    } catch (error) {
      Alert.alert("Restore Failed", error instanceof Error ? error.message : "Unable to restore this pet.");
    } finally {
      setRestoringId(null);
    }
  };

  const confirmRestore = (pet: ArchivedPet) => Alert.alert(
    "Restore Pet?",
    `${pet.pet_name} will appear in My Pets again.`,
    [{ text: "Cancel", style: "cancel" }, { text: "Restore", onPress: () => void restorePet(pet) }],
  );

  return <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Pressable style={styles.headerButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={27} color="#2E7D6B" /></Pressable>
      <Text style={styles.headerTitle}>Archived Pets</Text><View style={styles.headerButton} />
    </View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#2E7D6B" /><Text style={styles.loadingText}>Loading archived pets...</Text></View> :
      <ScrollView contentContainerStyle={styles.content}>
        {pets.length === 0 ? <View style={styles.center}><Ionicons name="archive-outline" size={52} color="#6B7C73" /><Text style={styles.emptyTitle}>No Archived Pets</Text><Text style={styles.emptyText}>Pets you archive will appear here.</Text></View> : pets.map((pet) => {
          const photoUrl = getImageUrl(pet.photo_url);
          return <View key={pet.pet_id} style={styles.card}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} /> : <View style={styles.photo}><Ionicons name="paw" size={27} color="#2E7D6B" /></View>}
            <View style={styles.info}><Text style={styles.name}>{pet.pet_name}</Text><Text style={styles.details}>{pet.breed || pet.species}</Text><Text style={styles.reason}>{pet.archive_reason}</Text><Text style={styles.date}>Archived {new Date(pet.archived_at).toLocaleDateString()}</Text></View>
            {pet.archive_reason === "Missing / Not Found" ? (
              <Pressable disabled={restoringId !== null} style={styles.restoreButton} onPress={() => confirmRestore(pet)}>{restoringId === pet.pet_id ? <ActivityIndicator color="#2E7D6B" /> : <Ionicons name="refresh" size={21} color="#2E7D6B" />}</Pressable>
            ) : (
              <View style={styles.permanentBadge}>
                <Ionicons name="lock-closed" size={17} color="#E57373" />
                <Text style={styles.permanentText}>Permanent</Text>
              </View>
            )}
          </View>;
        })}
      </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  header: { height: 60, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#CFE8DD" },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#2E3A34" },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", padding: 20, gap: 12, flexGrow: 1 },
  center: { flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7C73" },
  emptyTitle: { marginTop: 14, fontSize: 19, fontWeight: "900", color: "#2E3A34" },
  emptyText: { marginTop: 6, fontSize: 14, color: "#6B7C73" },
  card: { minHeight: 108, padding: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CFE8DD", borderRadius: 18, flexDirection: "row", alignItems: "center" },
  photo: { width: 72, height: 72, borderRadius: 18, backgroundColor: "#CFE8DD", alignItems: "center", justifyContent: "center" },
  info: { flex: 1, marginLeft: 13 },
  name: { fontSize: 18, fontWeight: "900", color: "#2E3A34" },
  details: { marginTop: 2, fontSize: 13, color: "#6B7C73" },
  reason: { marginTop: 7, fontSize: 13, fontWeight: "800", color: "#F5A623" },
  date: { marginTop: 2, fontSize: 11, color: "#6B7C73" },
  restoreButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#CFE8DD", alignItems: "center", justifyContent: "center" },
  permanentBadge: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: 11, backgroundColor: "#FFF5E9", alignItems: "center", gap: 3 },
  permanentText: { fontSize: 10, fontWeight: "800", color: "#E57373" },
});
