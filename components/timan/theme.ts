export const timanColors = {
  primary: "#2E7D6B",
  secondary: "#56B091",
  lightMint: "#CFE8DD",
  cream: "#FFF5E9",
  white: "#FFFFFF",
  dark: "#2E3A34",
  muted: "#6B7C73",
  warning: "#F5A623",
  danger: "#E57373",
  success: "#81C784",
  info: "#64B5F6",
  softAccent: "#FAD7A0",
} as const;

export const timanRadii = {
  small: 10,
  control: 14,
  card: 18,
  large: 24,
  pill: 999,
} as const;

export const timanSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const timanShadow = {
  shadowColor: timanColors.dark,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
} as const;
