const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildPublicImageUrl,
} = require("../routes/publicRoutes");

const request = {
  protocol: "https",
  get(name) {
    assert.equal(name, "host");
    return "timan-production.up.railway.app";
  },
};

test("public image URL converts relative upload paths to the current host", () => {
  assert.equal(
    buildPublicImageUrl(request, "/uploads/pets/test.jpg"),
    "https://timan-production.up.railway.app/uploads/pets/test.jpg"
  );
  assert.equal(
    buildPublicImageUrl(request, "uploads/pets/test.jpg"),
    "https://timan-production.up.railway.app/uploads/pets/test.jpg"
  );
});

test("public image URL preserves absolute URLs and handles missing values", () => {
  assert.equal(
    buildPublicImageUrl(request, "https://example.com/test.jpg"),
    "https://example.com/test.jpg"
  );
  assert.equal(buildPublicImageUrl(request, null), null);
});
