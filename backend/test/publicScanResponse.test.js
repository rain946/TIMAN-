const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../config/db");

test("public QR scan responds after persistence without waiting for push delivery", async (t) => {
  const originalGetConnection = db.getConnection;
  const originalFetch = global.fetch;

  t.after(() => {
    db.getConnection = originalGetConnection;
    global.fetch = originalFetch;
  });

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (sql.includes("FROM pets p")) {
        return [[{
          pet_id: 7,
          pet_name: "Milo",
          owner_id: 11,
          pet_status: "Safe",
          qr_code: "test-qr",
          owner_name: "Owner",
        }]];
      }
      if (sql.includes("FROM lost_pet_reports")) {
        return [[{ lost_report_id: 13 }]];
      }
      if (sql.includes("INSERT INTO qr_scan_history")) {
        return [{ insertId: 17 }];
      }
      if (sql.includes("FROM push_tokens")) {
        return [[{ expo_push_token: "ExponentPushToken[test]" }]];
      }
      if (sql.includes("FROM clinic_authorizations")) {
        return [[]];
      }
      return [{ affectedRows: 1 }];
    },
  };

  db.getConnection = async () => connection;
  let finishPushDelivery;
  global.fetch = () =>
    new Promise((resolve) => {
      finishPushDelivery = resolve;
    });

  const router = require("../routes/publicRoutes");
  const route = router.stack.find(
    (layer) => layer.route?.path === "/api/public/pets/:qrCode/scan"
  );
  const handler = route.route.stack.at(-1).handle;

  let statusCode;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await Promise.race([
    handler(
      {
        params: { qrCode: "test-qr" },
        body: { latitude: 14.5995, longitude: 120.9842 },
      },
      response
    ),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Public scan response waited for push delivery.")),
        250
      )
    ),
  ]);

  assert.equal(statusCode, 201);
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.scan.locationShared, true);
  assert.equal(responseBody.scan.scanId, 17);

  finishPushDelivery({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ data: { status: "ok", id: "test-ticket" } }),
  });
});
