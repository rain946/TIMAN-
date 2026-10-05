const test = require("node:test");
const assert = require("node:assert/strict");

const {
  addCalendarInterval,
  calculateSuggestionFromRules,
  formatDateOnly,
} = require("../services/vaccinationScheduleService");

function protocol(overrides = {}) {
  return {
    protocol_id: 1,
    species: "Dog",
    service_type: "Vaccination - Rabies",
    dose_sequence: 1,
    minimum_age_value: null,
    recommended_age_value: null,
    age_unit: null,
    interval_value: 1,
    interval_unit: "year",
    ...overrides,
  };
}

function calculate(overrides = {}) {
  return calculateSuggestionFromRules({
    pet: {
      pet_id: 1,
      species: "Dog",
      birth_date: "2025-01-01",
    },
    serviceType: "Vaccination - Rabies",
    visitDate: "2026-01-15",
    protocols: [protocol()],
    previousRecords: [],
    ...overrides,
  });
}

test("Dog with a matching vaccine protocol receives a suggestion", () => {
  const result = calculate();
  assert.equal(result.status, "available");
  assert.equal(result.suggested_next_due_date, "2027-01-15");
});

test("Cat with a matching vaccine protocol receives a suggestion", () => {
  const result = calculate({
    pet: { pet_id: 2, species: "Cat", birth_date: "2025-02-01" },
    serviceType: "Vaccination - FVRCP",
    protocols: [
      protocol({
        species: "Cat",
        service_type: "Vaccination - FVRCP",
        interval_value: 3,
        interval_unit: "week",
      }),
    ],
  });

  assert.equal(result.status, "available");
  assert.equal(result.suggested_next_due_date, "2026-02-05");
});

test("day intervals use exact calendar days", () => {
  const date = addCalendarInterval(new Date(Date.UTC(2026, 0, 30)), 5, "day");
  assert.equal(formatDateOnly(date), "2026-02-04");
});

test("week intervals use seven calendar days", () => {
  const date = addCalendarInterval(new Date(Date.UTC(2026, 0, 30)), 3, "week");
  assert.equal(formatDateOnly(date), "2026-02-20");
});

test("month intervals clamp to the last day of the calendar month", () => {
  const date = addCalendarInterval(new Date(Date.UTC(2026, 0, 31)), 1, "month");
  assert.equal(formatDateOnly(date), "2026-02-28");
});

test("year intervals clamp leap day to the last valid calendar day", () => {
  const date = addCalendarInterval(new Date(Date.UTC(2024, 1, 29)), 1, "year");
  assert.equal(formatDateOnly(date), "2025-02-28");
});

test("missing birth_date does not block a safe interval suggestion", () => {
  const result = calculate({
    pet: { pet_id: 1, species: "Dog", birth_date: null },
    protocols: [
      protocol({
        minimum_age_value: 12,
        recommended_age_value: 12,
        age_unit: "week",
      }),
    ],
  });

  assert.equal(result.suggestion_available, true);
  assert.equal(result.age_verification_possible, false);
  assert.match(result.explanation, /could not be verified/i);
});

test("MySQL Date birth_date values are used for age verification", () => {
  const result = calculate({
    pet: {
      pet_id: 1,
      species: "Dog",
      birth_date: new Date(2025, 5, 9),
    },
    protocols: [
      protocol({
        minimum_age_value: 12,
        recommended_age_value: 12,
        age_unit: "week",
      }),
    ],
  });

  assert.equal(result.age_verification_possible, true);
  assert.equal(result.age_verified, true);
});

test("no matching protocol returns a normal no-suggestion result", () => {
  const result = calculate({ protocols: [] });
  assert.equal(result.status, "no_matching_protocol");
  assert.equal(result.suggested_next_due_date, null);
});

test("ambiguous applicable protocols return no automatic suggestion", () => {
  const result = calculate({
    protocols: [protocol({ protocol_id: 1 }), protocol({ protocol_id: 2 })],
  });

  assert.equal(result.status, "ambiguous_protocol");
  assert.equal(result.suggestion_available, false);
});

test("generic historical Vaccination does not count as a specific vaccine", () => {
  const result = calculate({
    previousRecords: [{ record_id: 1, service_type: "Vaccination" }],
  });

  assert.equal(result.dose_sequence, 1);
});

test("specific prior vaccine records advance the applicable dose sequence", () => {
  const result = calculate({
    protocols: [
      protocol({ dose_sequence: 1 }),
      protocol({
        protocol_id: 2,
        dose_sequence: 2,
        interval_value: 3,
        interval_unit: "week",
      }),
    ],
    previousRecords: [
      { record_id: 1, service_type: "Vaccination - Rabies" },
    ],
  });

  assert.equal(result.dose_sequence, 2);
  assert.equal(result.rule.protocol_id, 2);
  assert.equal(result.suggested_next_due_date, "2026-02-05");
});

test("a recurring fallback rule applies after configured sequence doses", () => {
  const result = calculate({
    protocols: [
      protocol({ dose_sequence: 1 }),
      protocol({
        protocol_id: 2,
        dose_sequence: null,
        interval_value: 1,
        interval_unit: "year",
      }),
    ],
    previousRecords: [
      { record_id: 1, service_type: "Vaccination - Rabies" },
    ],
  });

  assert.equal(result.suggestion_available, true);
  assert.match(result.rule.label, /Recurring dose rule/);
});

test("manual next_due_date remains independent when no suggestion exists", () => {
  const manuallyEnteredDate = "2026-07-20";
  const result = calculate({ protocols: [] });

  assert.equal(result.suggested_next_due_date, null);
  assert.equal(manuallyEnteredDate, "2026-07-20");
});
