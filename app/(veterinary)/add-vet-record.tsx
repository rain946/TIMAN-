import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";

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
import { timanShadow } from "../../components/timan/theme";

import { API_URL } from "../../config/api";
import { useKeyboardAwareScroll } from "../../hooks/useKeyboardAwareScroll";

const SERVICE_TYPES = [
  "Checkup",
  "Vaccination",
  "Deworming",
  "Treatment",
  "Surgery",
  "Other",
] as const;

type ServiceType = (typeof SERVICE_TYPES)[number];

export default function AddVetRecordScreen() {
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle,
  } = useKeyboardAwareScroll(45);
  const params = useLocalSearchParams<{
    petId?: string;
    scanAccessToken?: string;
  }>();

  const petId = params.petId;

  const [visitDate, setVisitDate] = useState(getToday());

  const [serviceType, setServiceType] = useState<ServiceType | null>(null);

  const [otherServiceType, setOtherServiceType] = useState("");

  const [diagnosis, setDiagnosis] = useState("");

  const [treatment, setTreatment] = useState("");

  const [medication, setMedication] = useState("");

  const [notes, setNotes] = useState("");

  const [nextDueDate, setNextDueDate] = useState("");

  const [nextServiceType, setNextServiceType] = useState<ServiceType | null>(null);

  const [otherNextServiceType, setOtherNextServiceType] = useState("");

  const [followUpPlan, setFollowUpPlan] = useState("");

  const [saving, setSaving] = useState(false);

  const selectServiceType = (service: ServiceType) => {
    setServiceType(service);
  };

  const selectVisitDate = (value: string) => {
    setVisitDate(value);
  };

  const openDatePicker = (value: string, onSelect: (value: string) => void) => {
    if (Platform.OS !== "android") {
      return;
    }

    DateTimePickerAndroid.open({
      value: parseDateValue(value) || new Date(),
      mode: "date",
      onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (event.type === "set" && selectedDate) {
          onSelect(formatDateValue(selectedDate));
        }
      },
    });
  };

  const saveRecord = async () => {
    if (saving) {
      return;
    }

    if (!petId) {
      Alert.alert("Pet Error", "No pet was selected.");

      return;
    }

    if (!visitDate.trim()) {
      Alert.alert("Visit Date Required", "Please enter the visit date.");

      return;
    }

    if (!isValidDate(visitDate.trim())) {
      Alert.alert(
        "Invalid Visit Date",
        "Use YYYY-MM-DD format. Example: 2026-09-19.",
      );

      return;
    }

    if (!serviceType) {
      Alert.alert("Service Required", "Please select the veterinary service.");

      return;
    }

    if (serviceType === "Other" && !otherServiceType.trim()) {
      Alert.alert(
        "Other Service Required",
        "Please enter the veterinary service provided.",
      );

      return;
    }

    if (nextDueDate.trim() && !isValidDate(nextDueDate.trim())) {
      Alert.alert(
        "Invalid Next Due Date",
        "Use YYYY-MM-DD format. Example: 2026-10-19.",
      );

      return;
    }

    if (nextDueDate.trim() && nextDueDate.trim() <= getToday()) {
      Alert.alert(
        "Future Date Required",
        "Please select a future date for the next follow-up.",
      );
      return;
    }

    if (nextDueDate.trim() && !nextServiceType) {
      Alert.alert(
        "Next Service Required",
        "Please select the service planned for the next visit.",
      );
      return;
    }

    if (
      nextDueDate.trim() &&
      nextServiceType === "Other" &&
      !otherNextServiceType.trim()
    ) {
      Alert.alert(
        "Other Next Service Required",
        "Please enter the service planned for the next visit.",
      );
      return;
    }

    try {
      setSaving(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");

        router.replace("/login");

        return;
      }

      const body = {
        visit_date: visitDate.trim(),

        service_type:
          serviceType === "Other"
            ? otherServiceType.trim()
            : serviceType,

        diagnosis: diagnosis.trim(),

        treatment: treatment.trim(),

        medication: medication.trim(),

        notes: notes.trim(),

        next_due_date: nextDueDate.trim() || null,

        next_service_type: nextDueDate.trim()
          ? nextServiceType === "Other"
            ? otherNextServiceType.trim()
            : nextServiceType
          : null,

        follow_up_plan: nextDueDate.trim() ? followUpPlan.trim() || null : null,
      };

      console.log("SAVE VET RECORD:", body);

      const response = await fetch(`${API_URL}/vet-records/${petId}`, {
        method: "POST",

        headers: {
          Accept: "application/json",

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

          "X-TIMAN-Scan-Token": params.scanAccessToken || "",
        },

        body: JSON.stringify(body),
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

      console.log("SAVE VET RECORD STATUS:", response.status);

      console.log("SAVE VET RECORD RESPONSE:", data);

      if (!response.ok) {
        Alert.alert(
          "Unable to Save",
          data.message || "Unable to save veterinary record.",
        );

        return;
      }

      Alert.alert(
        "Record Saved",
        "The veterinary record has been saved successfully.",
        [
          {
            text: "OK",

            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.log("SAVE VET RECORD ERROR:", error);

      Alert.alert("Connection Error", "Unable to connect to the TIMAN server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.content,
            keyboardContentContainerStyle,
          ]}
        >
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <Ionicons name="medical" size={27} color="#2E7D6B" />
            </View>

            <View style={styles.introContent}>
              <Text style={styles.introTitle}>New Veterinary Record</Text>

              <Text style={styles.introText}>
                Record the pet&apos;s veterinary visit, service, treatment, and
                next schedule.
              </Text>
            </View>
          </View>

          <SectionTitle title="Visit Details" />

          <View style={styles.formCard}>
            <FieldLabel title="Visit Date" required />

            <Pressable
              style={({ pressed }) => [
                styles.inputContainer,
                pressed && styles.pressed,
              ]}
              onPress={() => openDatePicker(visitDate, selectVisitDate)}
            >
              <Ionicons name="calendar-outline" size={19} color="#6B7C73" />

              <TextInput
                value={visitDate}
                onChangeText={selectVisitDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6B7C73"
                style={styles.input}
                autoCapitalize="none"
                maxLength={10}
                editable={Platform.OS !== "android"}
                pointerEvents={Platform.OS === "android" ? "none" : "auto"}
              />
            </Pressable>

            <Text style={styles.helperText}>Example: 2026-09-19</Text>

            <FieldLabel title="Service Type" required top />

            <View style={styles.serviceContainer}>
              {SERVICE_TYPES.map((service) => {
                const selected = serviceType === service;

                return (
                  <Pressable
                    key={service}
                    style={({ pressed }) => [
                      styles.serviceButton,

                      selected && styles.serviceButtonSelected,

                      pressed && styles.pressed,
                    ]}
                    onPress={() => selectServiceType(service)}
                  >
                    <Ionicons
                      name={getServiceIcon(service)}
                      size={17}
                      color={selected ? "#FFFFFF" : "#2E7D6B"}
                    />

                    <Text
                      style={[
                        styles.serviceText,

                        selected && styles.serviceTextSelected,
                      ]}
                    >
                      {service}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {serviceType === "Other" && (
              <View style={styles.otherServiceContainer}>
                <Ionicons name="create-outline" size={19} color="#6B7C73" />
                <TextInput
                  ref={(input) => {
                    inputRefs.current.otherServiceType = input;
                  }}
                  onFocus={() =>
                    handleInputFocus(inputRefs.current.otherServiceType)
                  }
                  value={otherServiceType}
                  onChangeText={setOtherServiceType}
                  placeholder="Enter other service type"
                  placeholderTextColor="#6B7C73"
                  style={styles.input}
                  autoCapitalize="words"
                  maxLength={100}
                  returnKeyType="done"
                />
              </View>
            )}

          </View>

          <SectionTitle title="Medical Details" />

          <View style={styles.formCard}>
            <FieldLabel title="Diagnosis" />

            <TextInput
              ref={(input) => {
                inputRefs.current.diagnosis = input;
              }}
              onFocus={() => handleInputFocus(inputRefs.current.diagnosis)}
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder="Enter diagnosis, if applicable"
              placeholderTextColor="#6B7C73"
              style={styles.textArea}
              multiline
              textAlignVertical="top"
            />

            <FieldLabel title="Treatment / Procedure" top />

            <TextInput
              ref={(input) => {
                inputRefs.current.treatment = input;
              }}
              onFocus={() => handleInputFocus(inputRefs.current.treatment)}
              value={treatment}
              onChangeText={setTreatment}
              placeholder="Treatment or procedure performed"
              placeholderTextColor="#6B7C73"
              style={styles.textArea}
              multiline
              textAlignVertical="top"
            />

            <FieldLabel title="Medication" top />

            <TextInput
              ref={(input) => {
                inputRefs.current.medication = input;
              }}
              onFocus={() => handleInputFocus(inputRefs.current.medication)}
              value={medication}
              onChangeText={setMedication}
              placeholder="Medication given or prescribed"
              placeholderTextColor="#6B7C73"
              style={styles.textArea}
              multiline
              textAlignVertical="top"
            />

            <FieldLabel title="Notes" top />

            <TextInput
              ref={(input) => {
                inputRefs.current.notes = input;
              }}
              onFocus={() => handleInputFocus(inputRefs.current.notes)}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes about this visit..."
              placeholderTextColor="#6B7C73"
              style={[styles.textArea, styles.notesInput]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <SectionTitle title="Next Follow-up" />

          <View style={[styles.formCard, styles.followUpCard]}>
            <FieldLabel title="Next Due Date" />

            <Pressable
              style={({ pressed }) => [
                styles.inputContainer,
                pressed && styles.pressed,
              ]}
              onPress={() => openDatePicker(nextDueDate, setNextDueDate)}
            >
              <Ionicons
                name="notifications-outline"
                size={19}
                color="#6B7C73"
              />

              <TextInput
                value={nextDueDate}
                onChangeText={setNextDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6B7C73"
                style={styles.input}
                autoCapitalize="none"
                maxLength={10}
                editable={Platform.OS !== "android"}
                pointerEvents={Platform.OS === "android" ? "none" : "auto"}
              />

              {nextDueDate !== "" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear next due date"
                  hitSlop={8}
                  onPress={() => setNextDueDate("")}
                >
                  <Ionicons name="close-circle" size={20} color="#6B7C73" />
                </Pressable>
              )}
            </Pressable>

            <Text style={styles.helperText}>
              Optional. Use this for the next vaccination, deworming, follow-up,
              or other scheduled visit.
            </Text>

            {nextDueDate.trim() !== "" && (
              <>
                <FieldLabel title="Next Service Type" required top />

                <View style={styles.serviceContainer}>
                  {SERVICE_TYPES.map((service) => {
                    const selected = nextServiceType === service;
                    return (
                      <Pressable
                        key={`next-${service}`}
                        style={({ pressed }) => [
                          styles.serviceButton,
                          selected && styles.serviceButtonSelected,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => setNextServiceType(service)}
                      >
                        <Ionicons
                          name={getServiceIcon(service)}
                          size={17}
                          color={selected ? "#FFFFFF" : "#2E7D6B"}
                        />
                        <Text
                          style={[
                            styles.serviceText,
                            selected && styles.serviceTextSelected,
                          ]}
                        >
                          {service}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {nextServiceType === "Other" && (
                  <View style={styles.otherServiceContainer}>
                    <Ionicons name="create-outline" size={19} color="#6B7C73" />
                    <TextInput
                      ref={(input) => {
                        inputRefs.current.otherNextServiceType = input;
                      }}
                      onFocus={() =>
                        handleInputFocus(inputRefs.current.otherNextServiceType)
                      }
                      value={otherNextServiceType}
                      onChangeText={setOtherNextServiceType}
                      placeholder="Other next service type"
                      placeholderTextColor="#6B7C73"
                      style={styles.input}
                      maxLength={100}
                    />
                  </View>
                )}

                <FieldLabel title="Follow-up Plan / Instructions" top />

                <TextInput
                  ref={(input) => {
                    inputRefs.current.followUpPlan = input;
                  }}
                  onFocus={() => handleInputFocus(inputRefs.current.followUpPlan)}
                  value={followUpPlan}
                  onChangeText={setFollowUpPlan}
                  placeholder="Describe the plan for the next visit..."
                  placeholderTextColor="#6B7C73"
                  style={[styles.textArea, styles.notesInput]}
                  multiline
                  textAlignVertical="top"
                />
              </>
            )}
          </View>

          {nextDueDate.trim() !== "" && (
            <View style={styles.reminderCard}>
              <View style={styles.reminderIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color="#E57373"
                />
              </View>

              <View style={styles.reminderContent}>
                <Text style={styles.reminderTitle}>Schedule Created</Text>

                <Text style={styles.reminderText}>
                  Saving a next due date allows TIMAN to use this record for the
                  pet&apos;s upcoming health schedule.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.securityCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#2E7D6B"
            />

            <Text style={styles.securityText}>
              Only a clinic approved by the pet owner can save veterinary
              records for this pet.
            </Text>
          </View>

          <Pressable
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,

              pressed && !saving && styles.pressed,

              saving && styles.disabled,
            ]}
            onPress={saveRecord}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />

                <Text style={styles.saveText}>Save Veterinary Record</Text>
              </>
            )}
          </Pressable>

          <Pressable
            disabled={saving}
            style={({ pressed }) => [
              styles.cancelButton,

              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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

      <Text style={styles.headerTitle}>Add Vet Record</Text>

      <View style={styles.headerButton} />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function FieldLabel({
  title,
  required = false,
  top = false,
}: {
  title: string;
  required?: boolean;
  top?: boolean;
}) {
  return (
    <View style={[styles.labelRow, top && styles.labelTop]}>
      <Text style={styles.label}>{title}</Text>

      {required && <Text style={styles.required}>*</Text>}
    </View>
  );
}

function getToday() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  if (!isValidDate(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);

  const month = Number(match[2]);

  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function getServiceIcon(service: ServiceType): keyof typeof Ionicons.glyphMap {
  switch (service) {
    case "Checkup":
      return "medical-outline";

    case "Vaccination":
      return "shield-checkmark-outline";

    case "Deworming":
      return "fitness-outline";

    case "Treatment":
      return "bandage-outline";

    case "Surgery":
      return "pulse-outline";

    default:
      return "ellipsis-horizontal";
  }
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

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
    fontSize: 20,
    fontWeight: "800",

    color: "#2E3A34",
  },

  content: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 45,
  },

  introCard: {
    padding: 17,

    borderRadius: 19,

    backgroundColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "center",
  },

  introIcon: {
    width: 52,
    height: 52,

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
    fontSize: 18,
    fontWeight: "900",

    color: "#2E3A34",
  },

  introText: {
    marginTop: 4,

    fontSize: 12,
    lineHeight: 15,

    color: "#6B7C73",
  },

  sectionTitle: {
    marginTop: 25,
    marginBottom: 10,

    fontSize: 18,
    fontWeight: "900",

    color: "#2E3A34",
  },

  formCard: {
    ...timanShadow,
    padding: 16,

    borderRadius: 18,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#CFE8DD",
  },
  followUpCard: {
    backgroundColor: "#CFE8DD",
    borderColor: "#56B091",
    borderLeftWidth: 6,
    paddingLeft: 18,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  labelTop: {
    marginTop: 18,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",

    color: "#2E3A34",
  },

  required: {
    marginLeft: 3,

    fontSize: 14,
    fontWeight: "900",

    color: "#E57373",
  },

  inputContainer: {
    marginTop: 8,

    minHeight: 49,

    paddingHorizontal: 13,

    borderRadius: 13,

    borderWidth: 1,
    borderColor: "#CFE8DD",

    backgroundColor: "#FFF5E9",

    flexDirection: "row",
    alignItems: "center",

    gap: 9,
  },

  input: {
    flex: 1,

    paddingVertical: 11,

    fontSize: 14,

    color: "#2E3A34",
  },

  helperText: {
    marginTop: 6,

    fontSize: 11,
    lineHeight: 13,

    color: "#6B7C73",
  },

  textArea: {
    marginTop: 8,

    minHeight: 80,

    paddingHorizontal: 13,
    paddingVertical: 12,

    borderRadius: 13,

    borderWidth: 1,
    borderColor: "#CFE8DD",

    backgroundColor: "#FFF5E9",

    fontSize: 13,
    lineHeight: 17,

    color: "#2E3A34",
  },

  notesInput: {
    minHeight: 105,
  },

  serviceContainer: {
    marginTop: 9,

    flexDirection: "row",
    flexWrap: "wrap",

    gap: 8,
  },

  serviceButton: {
    minHeight: 41,

    paddingHorizontal: 12,

    borderRadius: 12,

    borderWidth: 1,
    borderColor: "#CFE8DD",

    backgroundColor: "#FFF5E9",

    flexDirection: "row",
    alignItems: "center",

    gap: 6,
  },

  serviceButtonSelected: {
    backgroundColor: "#2E7D6B",

    borderColor: "#2E7D6B",
  },

  serviceText: {
    fontSize: 12,
    fontWeight: "700",

    color: "#2E7D6B",
  },

  serviceTextSelected: {
    color: "#FFFFFF",
  },

  otherServiceContainer: {
    marginTop: 10,
    minHeight: 49,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFF5E9",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  reminderCard: {
    marginTop: 14,

    padding: 14,

    borderRadius: 15,

    backgroundColor: "#FAD7A0",

    borderWidth: 1,
    borderColor: "#FAD7A0",

    flexDirection: "row",
    alignItems: "flex-start",
  },

  reminderIcon: {
    width: 39,
    height: 39,

    borderRadius: 12,

    backgroundColor: "#FAD7A0",

    alignItems: "center",
    justifyContent: "center",
  },

  reminderContent: {
    flex: 1,

    marginLeft: 10,
  },

  reminderTitle: {
    fontSize: 13,
    fontWeight: "800",

    color: "#E57373",
  },

  reminderText: {
    marginTop: 3,

    fontSize: 11,
    lineHeight: 14,

    color: "#E57373",
  },

  securityCard: {
    marginTop: 20,

    padding: 14,

    borderRadius: 15,

    backgroundColor: "#CFE8DD",

    flexDirection: "row",
    alignItems: "flex-start",

    gap: 9,
  },

  securityText: {
    flex: 1,

    fontSize: 11,
    lineHeight: 15,

    color: "#6B7C73",
  },

  saveButton: {
    marginTop: 21,

    height: 52,

    borderRadius: 14,

    backgroundColor: "#2E7D6B",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,
  },

  saveText: {
    fontSize: 14,
    fontWeight: "900",

    color: "#FFFFFF",
  },

  cancelButton: {
    marginTop: 10,

    height: 48,

    borderRadius: 14,

    borderWidth: 1,
    borderColor: "#CFE8DD",
    backgroundColor: "#FFFFFF",

    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    fontSize: 13,
    fontWeight: "700",

    color: "#2E7D6B",
  },

  pressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.55,
  },
});
