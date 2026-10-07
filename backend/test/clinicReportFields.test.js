const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "routes", "clinicReportRoutes.js"),
  "utf8",
);

test("clinic report returns CSV follow-up fields and owner display name", () => {
  assert.match(source, /owner_user\.full_name AS owner_name/);
  assert.match(source, /vr\.next_service_type/);
  assert.match(source, /vr\.follow_up_plan/);
  assert.doesNotMatch(source, /owner_user\.(email|contact_number|password)/);
});

test("clinic report keeps veterinary dates as YYYY-MM-DD", () => {
  assert.match(
    source,
    /DATE_FORMAT\(vr\.visit_date, '%Y-%m-%d'\) AS visit_date/,
  );
  assert.match(
    source,
    /DATE_FORMAT\(vr\.next_due_date, '%Y-%m-%d'\) AS next_due_date/,
  );
});
