const GMAIL_ADDRESS_PATTERN = /^[^\s@]+@gmail\.com$/i;
const PHILIPPINE_MOBILE_PATTERN = /^09\d{9}$/;

export const GMAIL_VALIDATION_MESSAGE =
  "Please use a valid Gmail address.";

export const CONTACT_NUMBER_VALIDATION_MESSAGE =
  "Contact number must be an 11-digit Philippine mobile number starting with 09.";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidGmailAddress(value: string) {
  return GMAIL_ADDRESS_PATTERN.test(normalizeEmail(value));
}

export function sanitizePhilippineMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function isValidPhilippineMobileNumber(value: string) {
  return PHILIPPINE_MOBILE_PATTERN.test(value);
}
