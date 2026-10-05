const SUPPORTED_UNITS = new Set(["day", "week", "month", "year"]);

function normalizeSpecies(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["dog", "dogs", "canine"].includes(normalized)) return "dog";
  if (["cat", "cats", "feline"].includes(normalized)) return "cat";

  return normalized;
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseDatabaseDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
    );
  }

  return parseDateOnly(String(value || "").substring(0, 10));
}

function formatDateOnly(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function daysInUtcMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addCalendarInterval(date, value, unit) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0 || !SUPPORTED_UNITS.has(unit)) {
    return null;
  }

  const result = new Date(date.getTime());

  if (unit === "day" || unit === "week") {
    result.setUTCDate(result.getUTCDate() + amount * (unit === "week" ? 7 : 1));
    return result;
  }

  const originalDay = result.getUTCDate();
  result.setUTCDate(1);

  if (unit === "month") {
    result.setUTCMonth(result.getUTCMonth() + amount);
  } else {
    result.setUTCFullYear(result.getUTCFullYear() + amount);
  }

  result.setUTCDate(
    Math.min(originalDay, daysInUtcMonth(result.getUTCFullYear(), result.getUTCMonth()))
  );

  return result;
}

function describeRule(protocol, usedRecurringRule) {
  const doseLabel = usedRecurringRule
    ? "Recurring dose rule"
    : `Dose ${protocol.dose_sequence}`;

  return `${doseLabel}: ${protocol.interval_value} ${protocol.interval_unit}${
    Number(protocol.interval_value) === 1 ? "" : "s"
  } after this visit`;
}

function resultWithoutSuggestion(status, serviceType, explanation, extras = {}) {
  return {
    status,
    suggestion_available: false,
    suggested_next_due_date: null,
    service_type: serviceType,
    dose_sequence: extras.dose_sequence ?? null,
    rule: null,
    explanation,
    age_verification_possible: extras.age_verification_possible ?? false,
    age_verified: extras.age_verified ?? false,
  };
}

function calculateSuggestionFromRules({
  pet,
  serviceType,
  visitDate,
  protocols,
  previousRecords,
}) {
  const visit = parseDateOnly(visitDate);
  if (!visit) {
    throw new Error("A valid visit date is required for vaccination scheduling.");
  }

  if (!protocols.length) {
    return resultWithoutSuggestion(
      "no_matching_protocol",
      serviceType,
      `No active TIMAN protocol matches ${serviceType} for ${pet.species}.`
    );
  }

  const priorSpecificDoses = previousRecords.filter(
    (record) =>
      String(record.service_type || "").trim().toLowerCase() ===
      serviceType.trim().toLowerCase()
  );
  const doseSequence = priorSpecificDoses.length + 1;
  const exactMatches = protocols.filter(
    (protocol) => Number(protocol.dose_sequence) === doseSequence
  );
  const recurringMatches = protocols.filter(
    (protocol) => protocol.dose_sequence === null
  );

  let matches = exactMatches;
  let usedRecurringRule = false;

  if (matches.length === 0) {
    matches = recurringMatches;
    usedRecurringRule = true;
  }

  if (matches.length > 1) {
    return resultWithoutSuggestion(
      "ambiguous_protocol",
      serviceType,
      "Multiple active protocols match this vaccine and dose. No date was suggested.",
      { dose_sequence: doseSequence }
    );
  }

  if (matches.length === 0) {
    return resultWithoutSuggestion(
      "insufficient_history",
      serviceType,
      `TIMAN found protocols for this vaccine, but no unambiguous rule applies to dose ${doseSequence}.`,
      { dose_sequence: doseSequence }
    );
  }

  const protocol = matches[0];
  const birthDate = pet.birth_date
    ? parseDatabaseDateOnly(pet.birth_date)
    : null;
  const hasAgeRule =
    protocol.minimum_age_value !== null ||
    protocol.recommended_age_value !== null;
  const ageVerificationPossible = Boolean(birthDate);
  let ageVerified = !hasAgeRule;
  const explanationParts = [];

  if (hasAgeRule && !birthDate) {
    explanationParts.push(
      "The pet has no birth date, so the configured age rule could not be verified."
    );
  } else if (hasAgeRule && birthDate) {
    const minimumAgeDate = protocol.minimum_age_value
      ? addCalendarInterval(
          birthDate,
          protocol.minimum_age_value,
          protocol.age_unit
        )
      : null;

    if (minimumAgeDate && visit < minimumAgeDate) {
      return resultWithoutSuggestion(
        "age_requirement_not_met",
        serviceType,
        `The visit date is before the configured minimum age for dose ${doseSequence}. No date was suggested.`,
        {
          dose_sequence: doseSequence,
          age_verification_possible: true,
          age_verified: false,
        }
      );
    }

    ageVerified = true;
    explanationParts.push("The configured age rule was checked using the pet's birth date.");
  }

  const suggestedDate = addCalendarInterval(
    visit,
    protocol.interval_value,
    protocol.interval_unit
  );

  if (!suggestedDate) {
    return resultWithoutSuggestion(
      "insufficient_history",
      serviceType,
      "The applicable protocol has no valid interval, so no automatic date can be calculated.",
      {
        dose_sequence: doseSequence,
        age_verification_possible: ageVerificationPossible,
        age_verified: ageVerified,
      }
    );
  }

  const nextDoseSequence = doseSequence + 1;
  const nextDoseRules = protocols.filter(
    (candidate) => Number(candidate.dose_sequence) === nextDoseSequence
  );

  if (birthDate && nextDoseRules.length === 1) {
    const nextRule = nextDoseRules[0];
    const nextAgeValue =
      nextRule.recommended_age_value ?? nextRule.minimum_age_value;
    const nextAgeDate = nextAgeValue
      ? addCalendarInterval(birthDate, nextAgeValue, nextRule.age_unit)
      : null;

    if (nextAgeDate && nextAgeDate > suggestedDate) {
      suggestedDate.setTime(nextAgeDate.getTime());
      explanationParts.push(
        "The date was moved to the next dose's configured age milestone."
      );
    }
  }

  explanationParts.push(
    "This is a configurable TIMAN scheduling suggestion for clinic review, not a medical guarantee."
  );

  return {
    status: "available",
    suggestion_available: true,
    suggested_next_due_date: formatDateOnly(suggestedDate),
    service_type: serviceType,
    dose_sequence: doseSequence,
    rule: {
      protocol_id: protocol.protocol_id,
      dose_sequence: protocol.dose_sequence,
      interval_value: protocol.interval_value,
      interval_unit: protocol.interval_unit,
      label: describeRule(protocol, usedRecurringRule),
    },
    explanation: explanationParts.join(" "),
    age_verification_possible: ageVerificationPossible,
    age_verified: ageVerified,
  };
}

async function getVaccinationScheduleSuggestion({
  db,
  pet,
  serviceType,
  visitDate,
}) {
  const normalizedSpecies = normalizeSpecies(pet.species);
  const normalizedServiceType = String(serviceType || "").trim();

  const [protocols] = await db.query(
    `
    SELECT
      protocol_id,
      species,
      service_type,
      dose_sequence,
      minimum_age_value,
      recommended_age_value,
      age_unit,
      interval_value,
      interval_unit
    FROM vaccination_protocols
    WHERE LOWER(TRIM(species)) = ?
      AND LOWER(TRIM(service_type)) = LOWER(?)
      AND is_active = TRUE
    ORDER BY dose_sequence IS NULL, dose_sequence, protocol_id
    `,
    [normalizedSpecies, normalizedServiceType]
  );

  const [previousRecords] = await db.query(
    `
    SELECT record_id, service_type, visit_date
    FROM vet_records
    WHERE pet_id = ?
      AND LOWER(TRIM(service_type)) = LOWER(?)
      AND visit_date <= ?
    ORDER BY visit_date, record_id
    `,
    [pet.pet_id, normalizedServiceType, visitDate]
  );

  return calculateSuggestionFromRules({
    pet,
    serviceType: normalizedServiceType,
    visitDate,
    protocols,
    previousRecords,
  });
}

module.exports = {
  addCalendarInterval,
  calculateSuggestionFromRules,
  formatDateOnly,
  getVaccinationScheduleSuggestion,
  normalizeSpecies,
  parseDatabaseDateOnly,
  parseDateOnly,
};
