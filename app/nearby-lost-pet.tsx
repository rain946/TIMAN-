import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL, getImageUrl } from "../config/api";

type SafePet = {
  petId: number;
  petName: string;
  species: string;
  breed: string | null;
  color: string | null;
  identifyingMarks: string | null;
  photoUrl: string | null;
  petStatus: string;
  missingSince: string;
};

export default function NearbyLostPetScreen() {
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const [pet, setPet] = useState<SafePet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) throw new Error("Please log in again.");
        const response = await fetch(`${API_URL}/nearby-alerts/pets/${petId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Unable to load this pet.");
        if (active) setPet(data.pet);
      } catch (error) {
        if (active) {
          Alert.alert("Missing Pet", error instanceof Error ? error.message : "Unable to load this pet.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [petId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Missing Pet Nearby</Text>
        <View style={styles.headerButton} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E7D6B" />
          <Text style={styles.loadingText}>Loading missing-pet details...</Text>
        </View>
      ) : pet ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.alertCard}>
            <Ionicons name="alert-circle" size={30} color="#E57373" />
            <View style={styles.alertText}>
              <Text style={styles.alertTitle}>{pet.petName} is missing</Text>
              <Text style={styles.alertDescription}>
                This pet was reported missing near a location you explicitly shared with TIMAN.
              </Text>
            </View>
          </View>

          <View style={styles.petCard}>
            {pet.photoUrl ? (
              <Image source={{ uri: getImageUrl(pet.photoUrl) || undefined }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="paw" size={44} color="#2E7D6B" />
              </View>
            )}
            <Text style={styles.petName}>{pet.petName}</Text>
            <Text style={styles.petMeta}>
              {[pet.species, pet.breed].filter(Boolean).join(" • ")}
            </Text>

            <View style={styles.details}>
              <Detail label="Color" value={pet.color} />
              <Detail label="Identifying marks" value={pet.identifyingMarks} />
              <Detail label="Missing since" value={new Date(pet.missingSince).toLocaleString("en-PH")} />
            </View>
          </View>

          <View style={styles.privacyCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#2E7D6B" />
            <Text style={styles.privacyText}>
              For privacy, exact finder and owner coordinates are not shown. If you see this pet, scan its TIMAN QR tag to contact the owner.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={46} color="#2E7D6B" />
          <Text style={styles.emptyTitle}>Pet details unavailable</Text>
          <Text style={styles.emptyText}>The pet may already have been marked safe.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "Not provided"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5E9" },
  header: { height: 64, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#2E7D6B", borderBottomWidth: 1, borderBottomColor: "#2E7D6B" },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  loadingText: { color: "#6B7C73", marginTop: 10 },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", padding: 22, paddingBottom: 50 },
  alertCard: { backgroundColor: "rgba(229, 115, 115, 0.14)", borderRadius: 17, padding: 15, flexDirection: "row", alignItems: "center" },
  alertText: { flex: 1, marginLeft: 11 },
  alertTitle: { fontSize: 16, fontWeight: "900", color: "#E57373" },
  alertDescription: { fontSize: 12, lineHeight: 18, color: "#6B7C73", marginTop: 3 },
  petCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CFE8DD", borderRadius: 20, padding: 18, marginTop: 16, alignItems: "center", shadowColor: "#2E7D6B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  photo: { width: 130, height: 130, borderRadius: 20 },
  photoPlaceholder: { width: 130, height: 130, borderRadius: 20, backgroundColor: "#CFE8DD", alignItems: "center", justifyContent: "center" },
  petName: { fontSize: 24, fontWeight: "900", color: "#2E3A34", marginTop: 14 },
  petMeta: { fontSize: 13, color: "#6B7C73", marginTop: 4 },
  details: { width: "100%", marginTop: 18, borderTopWidth: 1, borderTopColor: "#CFE8DD" },
  detailRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#CFE8DD" },
  detailLabel: { fontSize: 11, color: "#6B7C73" },
  detailValue: { fontSize: 14, fontWeight: "700", color: "#56B091", marginTop: 3 },
  privacyCard: { backgroundColor: "#CFE8DD", borderRadius: 15, padding: 14, marginTop: 16, flexDirection: "row" },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, color: "#6B7C73", marginLeft: 9 },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#2E3A34", marginTop: 10 },
  emptyText: { fontSize: 13, color: "#6B7C73", textAlign: "center", marginTop: 5 },
});
