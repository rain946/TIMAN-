import { Stack } from "expo-router";

export default function ClinicLayout() {
  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="access-requests" />
      <Stack.Screen name="authorized-pets" />
      <Stack.Screen name="clinic-pet" />
      <Stack.Screen name="clinic-schedules" />
      <Stack.Screen name="clinic-reports" />
    </Stack>
  );
}
