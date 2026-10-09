const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const backendRoot = path.join(__dirname, "..");
const routeSource = fs.readFileSync(
  path.join(backendRoot, "routes", "vetRecordRoutes.js"),
  "utf8",
);
const ownerScreenSource = fs.readFileSync(
  path.join(backendRoot, "..", "app", "(veterinary)", "schedules.tsx"),
  "utf8",
);

const routeSection = (start, end) => {
  const startIndex = routeSource.indexOf(start);
  const endIndex = routeSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing route marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing route marker: ${end}`);
  return routeSource.slice(startIndex, endIndex);
};

test("owner cancellation requires a reason and includes it in the clinic notification", () => {
  const section = routeSection('"/:recordId/cancel"', '"/:recordId/reschedule"');

  assert.match(section, /reason\.length < 5 \|\| reason\.length > 500/);
  assert.match(section, /notifyClinicOfOwnerScheduleChange\(\{[\s\S]*reason,/);
  assert.match(
    routeSource,
    /cancelled by the owner\. Reason: \$\{reason\}/,
  );
});

test("overdue medical schedules cannot be rescheduled in API or owner UI", () => {
  const section = routeSection('"/:recordId/reschedule"', '"/:recordId/complete"');

  assert.match(section, /schedule\.next_due_date < getPhilippineToday\(\)/);
  assert.match(section, /DATE\(vr\.next_due_date\) >= \?/);
  assert.match(ownerScreenSource, /item\.daysRemaining < 0/);
  assert.match(
    ownerScreenSource,
    /Overdue schedules can no longer be rescheduled/,
  );
});

