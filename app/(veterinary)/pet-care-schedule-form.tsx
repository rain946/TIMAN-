import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/api";

const CARE_TYPES = ["Grooming", "Bath", "Nail Trimming", "Other"] as const;
const REPEATS = [
  { value: "None", label: "One Time" },
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
] as const;

export default function PetCareScheduleForm() {
  const params = useLocalSearchParams<{
    petId?: string;
    petName?: string;
    scheduleId?: string;
  }>();
  const petId = Number(params.petId);
  const scheduleId = params.scheduleId ? Number(params.scheduleId) : null;
  const [careType, setCareType] =
    useState<(typeof CARE_TYPES)[number]>("Grooming");
  const [customCareName, setCustomCareName] = useState("");
  const [scheduledDate, setScheduledDate] = useState(formatDate(new Date()));
  const [repeatType, setRepeatType] = useState("None");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(Boolean(scheduleId));
  const [saving, setSaving] = useState(false);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);

  useEffect(() => {
    if (!scheduleId || !petId) return;
    void (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const response = await fetch(
          `${API_URL}/pet-care-schedules?pet_id=${petId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );
        const data = await response.json();
        const item = data.schedules?.find(
          (value: any) => value.care_schedule_id === scheduleId,
        );
        if (!response.ok || !item || item.status !== "Pending")
          throw new Error("Schedule unavailable.");
        if (CARE_TYPES.slice(0, 3).includes(item.care_type))
          setCareType(item.care_type);
        else {
          setCareType("Other");
          setCustomCareName(item.care_type);
        }
        setScheduledDate(item.scheduled_date);
        setRepeatType(item.repeat_type);
        setNotes(item.notes || "");
      } catch (error) {
        Alert.alert(
          "Unable to Edit",
          error instanceof Error ? error.message : "Please try again.",
        );
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [petId, scheduleId]);

  const openDatePicker = () => {
    const current = parseDate(scheduledDate) || new Date();
    if (Platform.OS === "ios") {
      setShowIosDatePicker(true);
      return;
    }
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      minimumDate: startOfToday(),
      onChange: (event, date) =>
        event.type === "set" && date && setScheduledDate(formatDate(date)),
    });
  };

  const save = async () => {
    if (saving || !petId) return;
    if (careType === "Other" && !customCareName.trim()) {
      Alert.alert(
        "Care Name Required",
        "Enter a short name for the personal care activity.",
      );
      return;
    }
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const response = await fetch(
        scheduleId
          ? `${API_URL}/pet-care-schedules/${scheduleId}`
          : `${API_URL}/pet-care-schedules`,
        {
          method: scheduleId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pet_id: petId,
            care_type: careType,
            custom_care_name: customCareName.trim(),
            scheduled_date: scheduledDate,
            repeat_type: repeatType,
            notes: notes.trim(),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to save schedule.");
      Alert.alert(
        scheduleId ? "Schedule Updated" : "Schedule Saved",
        data.message,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert(
        "Unable to Save",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color="#2E7D6B" />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={27} color="#2E7D6B" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {scheduleId ? "Edit Personal Care" : "Add Personal Care"}
        </Text>
        <View style={styles.headerButton} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.petCard}>
            <Ionicons name="paw" size={22} color="#2E7D6B" />
            <View>
              <Text style={styles.label}>PET</Text>
              <Text style={styles.petName}>
                {params.petName || "Selected Pet"}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Care Type</Text>
          <View style={styles.options}>
            {CARE_TYPES.map((item) => (
              <Pressable
                key={item}
                onPress={() => setCareType(item)}
                style={[
                  styles.option,
                  careType === item && styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    careType === item && styles.optionTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          {careType === "Other" && (
            <TextInput
              value={customCareName}
              onChangeText={setCustomCareName}
              maxLength={100}
              placeholder="Custom care name"
              style={styles.input}
            />
          )}
          <Text style={styles.sectionTitle}>Date</Text>
          <Pressable onPress={openDatePicker} style={styles.inputRow}>
            <Ionicons name="calendar-outline" size={19} color="#2E7D6B" />
            <Text style={styles.inputValue}>{scheduledDate}</Text>
          </Pressable>
          {showIosDatePicker && Platform.OS === "ios" && (
            <View style={styles.iosPickerCard}>
              <DateTimePicker
                value={parseDate(scheduledDate) || new Date()}
                mode="date"
                minimumDate={startOfToday()}
                display="spinner"
                onChange={(_, date) =>
                  date && setScheduledDate(formatDate(date))
                }
              />
              <Pressable
                onPress={() => setShowIosDatePicker(false)}
                style={styles.iosPickerDone}
              >
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.sectionTitle}>Repeat</Text>
          <View style={styles.options}>
            {REPEATS.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setRepeatType(item.value)}
                style={[
                  styles.option,
                  repeatType === item.value && styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    repeatType === item.value && styles.optionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            maxLength={500}
            multiline
            placeholder="Optional care instructions"
            style={[styles.input, styles.notes]}
          />
          <Pressable
            disabled={saving}
            onPress={save}
            style={[styles.saveButton, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.saveText}>Save Schedule</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5E9"
  },
  flex: {
    flex: 1
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  header: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#FFF5E9",
  },
  headerButton: {
    width: 42,
    height: 42,
    justifyContent: "center"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2E3A34"
  },
  content: {
    padding: 20,
    paddingBottom: 50
  },
  petCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 17,
    backgroundColor: "#CFE8DD",
  },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6B7C73"
  },
  petName: {
    marginTop: 2,
    fontSize: 17, fontWeight: "900",
    color: "#2E3A34"
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "900",
    color: "#2E3A34",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  option: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFF",
  },
  optionSelected: {
    backgroundColor: "#2E7D6B",
    borderColor: "#2E7D6B"
  },
  optionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#56B091"
  },
  optionTextSelected: {
    color: "#FFF"
  },
  input: {
    minHeight: 52,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFF",
    color: "#2E3A34",
  },
  inputRow: {
    height: 54,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFF",
  },
  inputValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2E3A34"
  },
  iosPickerCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  iosPickerDone: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#2E7D6B",
  },
  iosPickerDoneText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900"
  },
  notes: {
    minHeight: 110,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  saveButton: {
    height: 56,
    marginTop: 28,
    borderRadius: 15,
    backgroundColor: "#2E7D6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.6
  },
});
