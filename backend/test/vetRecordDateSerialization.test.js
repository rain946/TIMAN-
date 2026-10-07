const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routeSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "vetRecordRoutes.js"),
  "utf8",
);

function routeSection(startMarker, endMarker) {
  const start = routeSource.indexOf(startMarker);
  const end = routeSource.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `Missing route marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing route boundary: ${endMarker}`);

  return routeSource.slice(start, end);
}

test("owner health overview serializes veterinary DATE columns as YYYY-MM-DD", () => {
  const section = routeSection(
    '"/owner-health-overview"',
    '"/owner/:petId"',
  );

  assert.match(
    section,
    /DATE_FORMAT\(vr\.visit_date, '%Y-%m-%d'\) AS visit_date/,
  );
  assert.match(
    section,
    /DATE_FORMAT\(vr\.next_due_date, '%Y-%m-%d'\) AS next_due_date/,
  );
  assert.match(section, /DATEDIFF\([\s\S]*vr\.next_due_date/);
});

test("owner pet records serialize veterinary DATE columns as YYYY-MM-DD", () => {
  const section = routeSection('"/owner/:petId"', '"/:recordId/cancel"');

  assert.match(
    section,
    /DATE_FORMAT\(vr\.visit_date, '%Y-%m-%d'\) AS visit_date/,
  );
  assert.match(
    section,
    /DATE_FORMAT\(vr\.next_due_date, '%Y-%m-%d'\) AS next_due_date/,
  );
});

test("clinic veterinary responses use the same DATE-only serialization", () => {
  const clinicHistory = routeSection('"/clinic"', '"/clinic-schedules"');
  const clinicSchedules = routeSection(
    '"/clinic-schedules"',
    '"/clinic/:petId"',
  );
  const clinicPet = routeSection('"/clinic/:petId"', '"/owner-health-overview"');

  assert.match(
    clinicHistory,
    /DATE_FORMAT\(vr\.visit_date, '%Y-%m-%d'\) AS visit_date/,
  );
  assert.match(
    clinicSchedules,
    /DATE_FORMAT\(vr\.visit_date, '%Y-%m-%d'\) AS visit_date/,
  );
  assert.match(
    clinicSchedules,
    /DATE_FORMAT\(vr\.next_due_date, '%Y-%m-%d'\) AS next_due_date/,
  );
  assert.match(
    clinicPet,
    /DATE_FORMAT\(vr\.visit_date, '%Y-%m-%d'\) AS visit_date/,
  );
  assert.match(
    clinicPet,
    /DATE_FORMAT\(vr\.next_due_date, '%Y-%m-%d'\) AS next_due_date/,
  );
});

test("clinic schedules return only the owner's display name", () => {
  const section = routeSection(
    '"/clinic-schedules"',
    '"/clinic/:petId"',
  );

  assert.match(section, /owner_user\.full_name AS owner_name/);
  assert.doesNotMatch(section, /owner_user\.(email|contact_number|phone)/);
});

test("clinic records return only the pet owner's display name", () => {
  const section = routeSection('"/clinic"', '"/clinic-schedules"');

  assert.match(section, /owner_user\.full_name AS owner_name/);
  assert.doesNotMatch(section, /owner_user\.(email|contact_number|phone)/);
});

test("clinic schedules expose the four current-month dashboard filters", () => {
  const section = routeSection(
    '"/clinic-schedules"',
    '"/clinic/:petId"',
  );

  assert.match(section, /END AS is_added_this_month/);
  assert.match(section, /END AS is_completed_this_month/);
  assert.match(section, /END AS is_cancelled_this_month/);
  assert.match(section, /END AS is_rescheduled_this_month/);
});

test("clinic schedules expose date-only fields for calendar filtering", () => {
  const section = routeSection(
    '"/clinic-schedules"',
    '"/clinic/:petId"',
  );

  assert.match(section, /DATE_FORMAT\(vr\.created_at, '%Y-%m-%d'\) AS booked_date/);
  assert.match(section, /DATE_FORMAT\(vr\.completed_at, '%Y-%m-%d'\) AS completed_date/);
  assert.match(section, /DATE_FORMAT\(vr\.cancelled_at, '%Y-%m-%d'\) AS cancelled_date/);
  assert.match(section, /DATE_FORMAT\(vr\.rescheduled_at, '%Y-%m-%d'\) AS rescheduled_date/);
});

test("schedule responses separate next follow-up fields from current visit fields", () => {
  const clinicSchedules = routeSection(
    '"/clinic-schedules"',
    '"/clinic/:petId"',
  );
  const ownerOverview = routeSection(
    '"/owner-health-overview"',
    '"/owner/:petId"',
  );

  for (const section of [clinicSchedules, ownerOverview]) {
    assert.match(
      section,
      /COALESCE\(NULLIF\(vr\.next_service_type, ''\), vr\.service_type\) AS service_type/,
    );
    assert.match(section, /vr\.follow_up_plan/);
  }
});
