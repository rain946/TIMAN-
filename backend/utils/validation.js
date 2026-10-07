const GMAIL_ADDRESS_PATTERN = /^[^\s@]+@gmail\.com$/i;
const PHILIPPINE_MOBILE_PATTERN = /^09\d{9}$/;

const GMAIL_VALIDATION_MESSAGE =
  "Please use a valid Gmail address.";

const CONTACT_NUMBER_VALIDATION_MESSAGE =
  "Contact number must be an 11-digit Philippine mobile number starting with 09.";

function normalizeEmail(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function isValidGmailAddress(value) {
  return GMAIL_ADDRESS_PATTERN.test(normalizeEmail(value));
}

function isValidPhilippineMobileNumber(value) {
  return (
    typeof value === "string" &&
    PHILIPPINE_MOBILE_PATTERN.test(value)
  );
}

module.exports = {
  CONTACT_NUMBER_VALIDATION_MESSAGE,
  GMAIL_VALIDATION_MESSAGE,
  isValidGmailAddress,
  isValidPhilippineMobileNumber,
  normalizeEmail,
};
