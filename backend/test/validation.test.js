const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isValidGmailAddress,
  isValidPhilippineMobileNumber,
  normalizeEmail,
} = require("../utils/validation");

test("Gmail validation accepts and normalizes valid Gmail addresses", () => {
  assert.equal(isValidGmailAddress("owner@gmail.com"), true);
  assert.equal(isValidGmailAddress("test.user@gmail.com"), true);
  assert.equal(isValidGmailAddress("sample123@gmail.com"), true);
  assert.equal(isValidGmailAddress("OWNER@GMAIL.COM"), true);
  assert.equal(
    normalizeEmail("  OWNER@GMAIL.COM  "),
    "owner@gmail.com"
  );
});

test("Gmail validation rejects non-Gmail and blank addresses", () => {
  assert.equal(isValidGmailAddress("owner@yahoo.com"), false);
  assert.equal(isValidGmailAddress("owner@outlook.com"), false);
  assert.equal(isValidGmailAddress("owner@gmail.co"), false);
  assert.equal(isValidGmailAddress("owner@gmail"), false);
  assert.equal(isValidGmailAddress("@gmail.com"), false);
  assert.equal(isValidGmailAddress(""), false);
});

test("Philippine mobile validation accepts exactly 09 plus nine digits", () => {
  assert.equal(isValidPhilippineMobileNumber("09123456789"), true);
  assert.equal(isValidPhilippineMobileNumber("09987654321"), true);
});

test("Philippine mobile validation rejects invalid formats", () => {
  assert.equal(isValidPhilippineMobileNumber("091234567890"), false);
  assert.equal(isValidPhilippineMobileNumber("9123456789"), false);
  assert.equal(isValidPhilippineMobileNumber("+639123456789"), false);
  assert.equal(isValidPhilippineMobileNumber("09123abc789"), false);
  assert.equal(isValidPhilippineMobileNumber("09123 456789"), false);
  assert.equal(isValidPhilippineMobileNumber(""), false);
});
