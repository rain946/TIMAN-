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
  assert.equal(
    buildPublicImageUrl(request, "http://example.com/test.jpg"),
    "http://example.com/test.jpg"
  );
  assert.equal(buildPublicImageUrl(request, null), null);
  assert.equal(buildPublicImageUrl(request, ""), null);
  assert.equal(buildPublicImageUrl(request, "   "), null);
});

test("public image URL does not duplicate the uploads/pets prefix", () => {
  const result = buildPublicImageUrl(
    request,
    "/uploads/pets/1791685883136-1fe2357e-10ad-448d-bb21-d52c1640c971.jpeg"
  );

  assert.equal(
    result,
    "https://timan-production.up.railway.app/uploads/pets/1791685883136-1fe2357e-10ad-448d-bb21-d52c1640c971.jpeg"
  );
  assert.equal((result.match(/\/uploads\/pets\//g) || []).length, 1);
  assert.equal(result.includes("/uploads/pets//uploads/pets/"), false);
});
