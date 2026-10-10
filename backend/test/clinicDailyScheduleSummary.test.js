const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "services", "reminderScheduler.js"),
  "utf8",
);

test("clinic daily summary counts only today's pending clinic schedules", () => {
  assert.match(source, /u\.role = 'clinic'/);
  assert.match(source, /vr\.schedule_status = 'Pending'/);
  assert.match(
    source,
    /vr\.next_due_date = DATE\([\s\S]*CONVERT_TZ\(UTC_TIMESTAMP\(\), '\+00:00', '\+08:00'\)/,
  );
  assert.match(source, /COUNT\(vr\.record_id\) AS schedule_count/);
});

test("clinic daily summary is stored once per clinic per Manila calendar day", () => {
  assert.match(source, /type = 'clinic_daily_schedule_summary'/);
  assert.match(source, /DATE\(created_at\) = DATE\([\s\S]*CONVERT_TZ/);
  assert.match(source, /type: "clinic_daily_schedule_summary"/);
  assert.match(source, /"0 8 \* \* \*"/);
});
