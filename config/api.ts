import Constants from "expo-constants";

const hostUri =
  Constants.expoConfig?.hostUri ??
  Constants.expoGoConfig?.debuggerHost;

const host = hostUri?.split(":")[0];

if (!host) {
  console.warn(
    "TIMAN: Unable to detect development server host."
  );
}

export const SERVER_URL =
  `http://${host}:3000`;

export const API_URL =
  `${SERVER_URL}/api`;

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
