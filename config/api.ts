import Constants from "expo-constants";
import { Platform } from "react-native";

const hostUri =
  Constants.expoConfig?.hostUri ??
  Constants.expoGoConfig?.debuggerHost;

const developmentHost = hostUri
  ?.replace(/^https?:\/\//, "")
  .split("/")[0]
  .split(":")[0];

const platformFallbackHost =
  Platform.OS === "android" ? "10.0.2.2" : "localhost";

const configuredApiUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");

const defaultServerUrl =
  `http://${developmentHost || platformFallbackHost}:3000`;

export const API_URL = configuredApiUrl
  ? configuredApiUrl.endsWith("/api")
    ? configuredApiUrl
    : `${configuredApiUrl}/api`
  : `${defaultServerUrl}/api`;

export const SERVER_URL = API_URL.replace(/\/api\/?$/, "");

if (!developmentHost && !configuredApiUrl) {
  console.warn(
    `TIMAN: Unable to detect the Metro host. Falling back to ${platformFallbackHost}. Set EXPO_PUBLIC_API_URL for a physical device or standalone build.`
  );
}

export const getImageUrl = (
  photoUrl?: string | null
) => {
  if (!photoUrl) {
    return null;
  }

  if (
    photoUrl.startsWith("http://") ||
    photoUrl.startsWith("https://")
  ) {
    return photoUrl;
  }

  const cleanPath = photoUrl.startsWith("/")
    ? photoUrl
    : `/${photoUrl}`;

  return `${SERVER_URL}${cleanPath}`;
};

console.log(
  "TIMAN SERVER URL:",
  SERVER_URL
);

console.log(
  "TIMAN API URL:",
  API_URL
);
