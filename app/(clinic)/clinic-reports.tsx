import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory } from "expo-file-system";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL } from "../../config/api";

type ReportPeriodKey = "thisMonth" | "lastMonth";

type ClinicReportRecord = {
  record_id: number;
  pet_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  service_type: string;
  visit_date: string;
  next_due_date: string | null;
  schedule_status: "Pending" | "Completed" | "Cancelled";
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

type ClinicReport = {
  clinic: {
    user_id: number;
    full_name: string;
    clinic_name: string | null;
  };
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    booked: number;
    completed: number;
    cancelled: number;
  };
  records: ClinicReportRecord[];
};

const PERIOD_OPTIONS: { key: ReportPeriodKey; label: string }[] = [
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
];

export default function ClinicReportsScreen() {
  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>("thisMonth");
  const [report, setReport] = useState<ClinicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPeriod = useMemo(() => getReportPeriod(periodKey), [periodKey]);

  const loadReport = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        setError(null);

        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }

        const query = new URLSearchParams({
          startDate: selectedPeriod.startDate,
          endDate: selectedPeriod.endDate,
        });
        const response = await fetch(`${API_URL}/clinic-reports?${query}`, {
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
          throw new Error(data.message || "Unable to load the clinic report.");
        }

        setReport({
          clinic: data.clinic,
          period: data.period,
          summary: data.summary,
          records: Array.isArray(data.records) ? data.records : [],
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the clinic report.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedPeriod.endDate, selectedPeriod.startDate],
  );

  useFocusEffect(
    useCallback(() => {
      void loadReport();
    }, [loadReport]),
  );

  const exportReport = async () => {
    if (!report || exporting) return;

    try {
      setExporting(true);
      const directory = await Directory.pickDirectoryAsync();
      const filename = buildFilename(
        report.period.start_date,
        report.period.end_date,
      );
      const file = directory.createFile(filename, "text/csv");
      file.write(`\uFEFF${buildCsv(report)}`);

      Alert.alert(
        "Report Saved",
        `${filename} was saved in the folder you selected.`,
      );
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : String(exportError);
      if (/cancel/i.test(message)) return;

      Alert.alert(
        "Export Failed",
        "The report could not be saved. Please choose another folder and try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={23} color="#1E2D24" />
        </Pressable>
        <Text style={styles.headerTitle}>Clinic Reports</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={["#176B3A"]}
            tintColor="#176B3A"
            onRefresh={() => {
              setRefreshing(true);
              void loadReport(false);
            }}
          />
        }
      >
        <Text style={styles.introTitle}>Reporting Period</Text>
        <Text style={styles.introText}>
          Review scheduled, completed, and cancelled treatments for your clinic.
        </Text>

        <View style={styles.periodOptions}>
          {PERIOD_OPTIONS.map((option) => {
            const selected = option.key === periodKey;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.periodButton,
                  selected && styles.periodButtonSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => setPeriodKey(option.key)}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selected && styles.periodButtonTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.periodCard}>
          <Ionicons name="calendar-outline" size={20} color="#176B3A" />
          <View style={styles.periodText}>
            <Text style={styles.periodLabel}>{selectedPeriod.label}</Text>
            <Text style={styles.periodDates}>
              {formatDate(selectedPeriod.startDate)} –{" "}
              {formatDate(selectedPeriod.endDate)}
            </Text>
          </View>
        </View>

        {loading && !report ? (
          <StateCard>
            <ActivityIndicator color="#176B3A" />
            <Text style={styles.stateText}>Generating report...</Text>
          </StateCard>
        ) : error ? (
          <StateCard>
            <Ionicons name="alert-circle-outline" size={29} color="#A7483E" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
              onPress={() => void loadReport()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </StateCard>
        ) : report ? (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <SummaryCard
                icon="calendar-outline"
                label="Booked"
                value={report.summary.booked}
                color="#176B3A"
                background="#EAF4EB"
              />
              <SummaryCard
                icon="checkmark-circle-outline"
                label="Completed"
                value={report.summary.completed}
                color="#247348"
                background="#E4F3E8"
              />
              <SummaryCard
                icon="close-circle-outline"
                label="Cancelled"
                value={report.summary.cancelled}
                color="#A7483E"
                background="#FBE9E6"
              />
            </View>

            <View style={styles.metricNote}>
              <Ionicons
                name="information-circle-outline"
                size={19}
                color="#176B3A"
              />
              <Text style={styles.metricNoteText}>
                Booked uses the date the clinic created the schedule. Completed
                and Cancelled use the actual action date.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: exporting }}
              disabled={exporting}
              style={({ pressed }) => [
                styles.exportButton,
                exporting && styles.exportButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={() => void exportReport()}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.exportButtonText}>
                {exporting ? "Saving Report..." : "Download Report"}
              </Text>
            </Pressable>

            <View style={styles.detailsHeader}>
              <Text style={styles.sectionTitleNoMargin}>Details</Text>
              <Text style={styles.recordCount}>
                {report.records.length}{" "}
                {report.records.length === 1 ? "record" : "records"}
              </Text>
            </View>

            {report.records.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="document-text-outline"
                  size={31}
                  color="#718078"
                />
                <Text style={styles.emptyTitle}>No report activity</Text>
                <Text style={styles.emptyText}>
                  No scheduled, completed, or cancelled treatments were found
                  for this period.
                </Text>
              </View>
            ) : (
              report.records.map((record) => (
                <ReportRecordCard key={record.record_id} record={record} />
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  background,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  background: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ReportRecordCard({ record }: { record: ClinicReportRecord }) {
  const petDetails = [record.species, record.breed].filter(Boolean).join(" • ");

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordTopRow}>
        <View style={styles.recordIcon}>
          <Ionicons name="paw-outline" size={21} color="#176B3A" />
        </View>
        <View style={styles.recordTitleContent}>
          <Text style={styles.petName} numberOfLines={1}>
            {record.pet_name}
          </Text>
          <Text style={styles.petDetails} numberOfLines={1}>
            {petDetails}
          </Text>
        </View>
        <View
          style={[styles.statusBadge, getStatusStyle(record.schedule_status)]}
        >
          <Text
            style={[
              styles.statusText,
              getStatusTextStyle(record.schedule_status),
            ]}
          >
            {record.schedule_status}
          </Text>
        </View>
      </View>

      <Text style={styles.serviceType}>{record.service_type}</Text>
      <DetailRow label="Booked Date" value={formatDateTime(record.created_at)} />
      <DetailRow label="Visit Date" value={formatDate(record.visit_date)} />
      <DetailRow
        label="Scheduled Date"
        value={
          record.next_due_date
            ? formatDate(record.next_due_date)
            : "Not scheduled"
        }
      />
      {record.completed_at ? (
        <DetailRow
          label="Completed Date"
          value={formatDateTime(record.completed_at)}
        />
      ) : null}
      {record.cancelled_at ? (
        <DetailRow
          label="Cancelled Date"
          value={formatDateTime(record.cancelled_at)}
        />
      ) : null}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.stateCard}>{children}</View>;
}

function getReportPeriod(key: ReportPeriodKey) {
  const manilaParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const manilaYear = Number(
    manilaParts.find((part) => part.type === "year")?.value,
  );
  const manilaMonth = Number(
    manilaParts.find((part) => part.type === "month")?.value,
  );
  const offset = key === "lastMonth" ? -1 : 0;
  const start = new Date(manilaYear, manilaMonth - 1 + offset, 1);
  const end = new Date(manilaYear, manilaMonth + offset, 0);

  return {
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
    label: start.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    }),
  };
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.substring(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(report: ClinicReport) {
  const clinicName =
    report.clinic.clinic_name || report.clinic.full_name || "Clinic";
  const lines = [
    ["TIMAN"],
    ["Clinic Report"],
    ["Clinic Name", clinicName],
    [
      "Report Period",
      `${report.period.start_date} to ${report.period.end_date}`,
    ],
    ["Generated Date", formatCsvDateTime(new Date())],
    [],
    ["SUMMARY"],
    ["Booked", report.summary.booked],
    ["Completed", report.summary.completed],
    ["Cancelled", report.summary.cancelled],
    [],
    ["DETAILS"],
    [
      "Pet",
      "Species/Breed",
      "Service",
      "Booked Date",
      "Visit Date",
      "Scheduled Date",
      "Status",
      "Completed Date",
      "Cancelled Date",
    ],
    ...report.records.map((record) => [
      record.pet_name,
      [record.species, record.breed].filter(Boolean).join(" / "),
      record.service_type,
      formatCsvDateTime(new Date(record.created_at)),
      record.visit_date?.substring(0, 10) || "",
      record.next_due_date?.substring(0, 10) || "",
      record.schedule_status,
      record.completed_at
        ? formatCsvDateTime(new Date(record.completed_at))
        : "",
      record.cancelled_at
        ? formatCsvDateTime(new Date(record.cancelled_at))
        : "",
    ]),
  ];

  return lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function formatCsvDateTime(date: Date) {
  return date.toLocaleString(undefined, { timeZone: "Asia/Manila" });
}

function buildFilename(startDate: string, endDate: string) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `TIMAN_Clinic_Report_${startDate}_to_${endDate}_${stamp}.csv`;
}

function getStatusStyle(status: ClinicReportRecord["schedule_status"]) {
  if (status === "Completed") return styles.completedBadge;
  if (status === "Cancelled") return styles.cancelledBadge;
  return styles.pendingBadge;
}

function getStatusTextStyle(status: ClinicReportRecord["schedule_status"]) {
  if (status === "Completed") return styles.completedText;
  if (status === "Cancelled") return styles.cancelledText;
  return styles.pendingText;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E7ECE8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#1E2D24",
  },
  content: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#203027",
  },
  introText: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: "#77847C",
  },
  periodOptions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 18,
  },
  periodButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D7E1DA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  periodButtonSelected: {
    backgroundColor: "#176B3A",
    borderColor: "#176B3A",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#647269",
  },
  periodButtonTextSelected: { color: "#FFFFFF" },
  periodCard: {
    marginTop: 12,
    minHeight: 67,
    paddingHorizontal: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DDE6DF",
    backgroundColor: "#F2F8F3",
    flexDirection: "row",
    alignItems: "center",
  },
  periodText: {
    flex: 1,
    marginLeft: 11,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: "#294333",
  },
  periodDates: {
    marginTop: 3,
    fontSize: 13,
    color: "#6C7A71",
  },
  stateCard: {
    minHeight: 190,
    marginTop: 22,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E1E8E3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    marginTop: 11,
    fontSize: 14,
    color: "#77847C",
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "#843C34",
    textAlign: "center",
  },
  retryButton: {
    minWidth: 110,
    minHeight: 43,
    marginTop: 15,
    borderRadius: 12,
    backgroundColor: "#176B3A",
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sectionTitle: {
    marginTop: 25,
    marginBottom: 12,
    fontSize: 21,
    fontWeight: "900",
    color: "#1E2D24",
  },
  sectionTitleNoMargin: {
    fontSize: 21,
    fontWeight: "900",
    color: "#1E2D24",
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: {
    flex: 1,
    minHeight: 125,
    paddingHorizontal: 8,
    paddingVertical: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E1E8E3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 25,
    fontWeight: "900",
    color: "#27372D",
  },
  summaryLabel: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#718078",
    textAlign: "center",
  },
  metricNote: {
    marginTop: 13,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#EEF6EF",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  metricNoteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#5F7065",
  },
  exportButton: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#176B3A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exportButtonDisabled: { opacity: 0.62 },
  exportButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  detailsHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recordCount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#718078",
  },
  emptyCard: {
    minHeight: 150,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E1E8E3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "900",
    color: "#34453B",
  },
  emptyText: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: "#77847C",
    textAlign: "center",
  },
  recordCard: {
    marginBottom: 11,
    padding: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E1E8E3",
    backgroundColor: "#FFFFFF",
  },
  recordTopRow: { flexDirection: "row", alignItems: "center" },
  recordIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },
  recordTitleContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
    marginRight: 8,
  },
  petName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#27372D",
  },
  petDetails: {
    marginTop: 2,
    fontSize: 13,
    color: "#77847C",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
  },
  statusText: { fontSize: 10, fontWeight: "900" },
  pendingBadge: { backgroundColor: "#FFF1DA" },
  completedBadge: { backgroundColor: "#E5F3E8" },
  cancelledBadge: { backgroundColor: "#FBE9E6" },
  pendingText: { color: "#A66A15" },
  completedText: { color: "#176B3A" },
  cancelledText: { color: "#A7483E" },
  serviceType: {
    marginTop: 13,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "900",
    color: "#395044",
  },
  detailRow: {
    minHeight: 27,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: "#7A877F" },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#3D4E44",
    textAlign: "right",
  },
  pressed: { opacity: 0.72 },
});
