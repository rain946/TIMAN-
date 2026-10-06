const test = require("node:test");
const assert = require("node:assert/strict");

const {
  executeNearbyAlertEnrollment,
} = require("../../services/nearbyAlertEnrollmentWorkflow");

function dependencies(overrides = {}) {
  const calls = { permission: 0, position: 0, save: 0 };
  return {
    calls,
    value: {
      requestConsent: async () => true,
      requestForegroundPermission: async () => {
        calls.permission += 1;
        return true;
      },
      getCurrentPosition: async () => {
        calls.position += 1;
        return { latitude: 14.6, longitude: 121 };
      },
      savePreference: async (coordinates) => {
        calls.save += 1;
        calls.coordinates = coordinates;
      },
      ...overrides,
    },
  };
}

test("Not Now makes no permission, position, or server update request", async () => {
  const setup = dependencies({ requestConsent: async () => false });
  const result = await executeNearbyAlertEnrollment(setup.value);
  assert.equal(result.status, "not_now");
  assert.deepEqual(setup.calls, { permission: 0, position: 0, save: 0 });
});

test("permission denial continues without position capture or update", async () => {
  const setup = dependencies({
    requestForegroundPermission: async () => {
      setup.calls.permission += 1;
      return false;
    },
  });
  const result = await executeNearbyAlertEnrollment(setup.value);
  assert.equal(result.status, "permission_denied");
  assert.equal(setup.calls.permission, 1);
  assert.equal(setup.calls.position, 0);
  assert.equal(setup.calls.save, 0);
});

test("permission grant captures one position and saves enabled coordinates once", async () => {
  const setup = dependencies();
  const result = await executeNearbyAlertEnrollment(setup.value);
  assert.equal(result.status, "enrolled");
  assert.equal(setup.calls.permission, 1);
  assert.equal(setup.calls.position, 1);
  assert.equal(setup.calls.save, 1);
  assert.deepEqual(setup.calls.coordinates, { latitude: 14.6, longitude: 121 });
});
