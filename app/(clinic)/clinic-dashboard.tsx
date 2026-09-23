import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ClinicDashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.clinicName}>
              Happy Paws Clinic
            </Text>
          </View>

          <Pressable style={styles.notificationButton}>
            <Ionicons
              name="notifications-outline"
              size={23}
              color="#173D2A"
            />

            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        {}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeTitle}>
              Veterinary Dashboard
            </Text>

            <Text style={styles.welcomeDescription}>
              Scan a pet QR code to identify the pet and
              manage authorized veterinary records.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.scanButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push("/qr-scanner")}
            >
              <Ionicons
                name="qr-code-outline"
                size={20}
                color="#176B3A"
              />

              <Text style={styles.scanButtonText}>
                Scan Pet QR
              </Text>
            </Pressable>
          </View>

          <View style={styles.bigIcon}>
            <Ionicons
              name="medkit"
              size={45}
              color="#FFFFFF"
            />
          </View>
        </View>

        {}
        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons
                name="paw-outline"
                size={21}
                color="#176B3A"
              />
            </View>

            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>
              Authorized Pets
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons
                name="document-text-outline"
                size={21}
                color="#176B3A"
              />
            </View>

            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>
              Records Today
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons
                name="time-outline"
                size={21}
                color="#A66A15"
              />
            </View>

            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>
              Pending Access
            </Text>
          </View>
        </View>

        {}
        <Text style={styles.sectionTitle}>
          Quick Actions
        </Text>

        <View style={styles.actionGrid}>
          <ActionButton
            icon="qr-code-outline"
            title="Scan QR"
            description="Identify pet"
            onPress={() => router.push("/qr-scanner")}
          />

          <ActionButton
            icon="paw-outline"
            title="Authorized Pets"
            description="View pets"
            onPress={() => {}}
          />

          <ActionButton
            icon="shield-checkmark-outline"
            title="Access Requests"
            description="Check status"
            onPress={() => {}}
          />

          <ActionButton
            icon="document-text-outline"
            title="Records"
            description="Visit history"
            onPress={() => {}}
          />
        </View>

        {}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleNoMargin}>
            Access Requests
          </Text>

          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        <View style={styles.requestCard}>
          <View style={styles.petAvatar}>
            <Ionicons
              name="paw"
              size={25}
              color="#176B3A"
            />
          </View>

          <View style={styles.requestInfo}>
            <Text style={styles.petName}>Max</Text>

            <Text style={styles.petDetails}>
              Labrador Retriever
            </Text>

            <Text style={styles.requestStatus}>
              Waiting for owner approval
            </Text>
          </View>

          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>
              Pending
            </Text>
          </View>
        </View>

        {}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleNoMargin}>
            Recent Activity
          </Text>

          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        <ActivityCard
          icon="medical-outline"
          title="Anti-Rabies Vaccination"
          pet="Buddy"
          time="Today, 10:30 AM"
        />

        <ActivityCard
          icon="fitness-outline"
          title="Deworming"
          pet="Coco"
          time="Today, 9:15 AM"
        />

        <ActivityCard
          icon="medkit-outline"
          title="General Checkup"
          pet="Milo"
          time="Yesterday, 3:40 PM"
        />

        {}
        <View style={styles.tipCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={24}
            color="#176B3A"
          />

          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>
              Owner-Controlled Access
            </Text>

            <Text style={styles.tipDescription}>
              A pet owner must authorize your clinic before
              you can add or update the pet&apos;s veterinary
              records.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons
          name={icon}
          size={25}
          color="#176B3A"
        />
      </View>

      <Text style={styles.actionTitle}>{title}</Text>

      <Text style={styles.actionDescription}>
        {description}
      </Text>
    </Pressable>
  );
}

function ActivityCard({
  icon,
  title,
  pet,
  time,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  pet: string;
  time: string;
}) {
  return (
    <View style={styles.activityCard}>
      <View style={styles.activityIcon}>
        <Ionicons
          name={icon}
          size={21}
          color="#176B3A"
        />
      </View>

      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle}>
          {title}
        </Text>

        <Text style={styles.activityPet}>
          {pet}
        </Text>

        <Text style={styles.activityTime}>
          {time}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color="#A0AAA4"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },

  content: {
    paddingHorizontal: 22,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 20,
  },

  welcomeText: {
    fontSize: 12,
    color: "#7B887F",
  },

  clinicName: {
    fontSize: 21,
    fontWeight: "900",
    color: "#1E2D24",
    marginTop: 2,
  },

  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3E9E5",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E99B3A",
    top: 9,
    right: 10,
  },

  welcomeCard: {
    backgroundColor: "#176B3A",
    borderRadius: 23,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  welcomeContent: {
    flex: 1,
  },

  welcomeTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  welcomeDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: "#DCEBDF",
    marginTop: 7,
    paddingRight: 8,
  },

  scanButton: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 15,
  },

  scanButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#176B3A",
  },

  bigIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E2D24",
    marginTop: 27,
    marginBottom: 13,
  },

  statsRow: {
    flexDirection: "row",
    gap: 9,
  },

  statCard: {
    flex: 1,
    minHeight: 120,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 17,
    padding: 12,
  },

  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#26372C",
    marginTop: 10,
  },

  statLabel: {
    fontSize: 9,
    lineHeight: 13,
    color: "#78857D",
    marginTop: 2,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 11,
  },

  actionCard: {
    width: "48.5%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 17,
    padding: 15,
  },

  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  actionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#26372C",
  },

  actionDescription: {
    fontSize: 10,
    color: "#8A958E",
    marginTop: 3,
  },

  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 27,
    marginBottom: 12,
  },

  sectionTitleNoMargin: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E2D24",
  },

  seeAll: {
    fontSize: 11,
    fontWeight: "700",
    color: "#176B3A",
  },

  requestCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 17,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  petAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  requestInfo: {
    flex: 1,
    marginLeft: 12,
  },

  petName: {
    fontSize: 14,
    fontWeight: "900",
    color: "#27372D",
  },

  petDetails: {
    fontSize: 10,
    color: "#808C84",
    marginTop: 2,
  },

  requestStatus: {
    fontSize: 9,
    color: "#A66A15",
    marginTop: 5,
  },

  pendingBadge: {
    backgroundColor: "#FFF1DA",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
  },

  pendingText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#A66A15",
  },

  activityCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  activityIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#EAF4EB",
    alignItems: "center",
    justifyContent: "center",
  },

  activityInfo: {
    flex: 1,
    marginLeft: 11,
  },

  activityTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#29382F",
  },

  activityPet: {
    fontSize: 10,
    fontWeight: "700",
    color: "#176B3A",
    marginTop: 3,
  },

  activityTime: {
    fontSize: 9,
    color: "#909A94",
    marginTop: 3,
  },

  tipCard: {
    backgroundColor: "#EAF4EB",
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    marginTop: 20,
  },

  tipContent: {
    flex: 1,
    marginLeft: 11,
  },

  tipTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#294C34",
  },

  tipDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: "#66766B",
    marginTop: 4,
  },
});
