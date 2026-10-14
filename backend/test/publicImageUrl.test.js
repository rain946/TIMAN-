const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

test("public location modal guards timeouts, skips, and late callbacks", () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, "../routes/publicRoutes.js"),
    "utf8"
  );

  assert.match(routeSource, /let locationRequestFinished = true;/);
  assert.match(routeSource, /let locationFallbackTimer = null;/);
  assert.match(
    routeSource,
    /cancelLocationRequest\(\);\s+overlay\.remove\(\);\s+continueWithoutLocation\(\);/
  );
  assert.match(
    routeSource,
    /if \(locationRequestFinished\) \{\s+return;\s+\}/
  );
  assert.match(routeSource, /new AbortController\(\)/);
  assert.match(routeSource, /enableHighAccuracy: true/);
  assert.match(routeSource, /maximumAge: 0/);
  assert.match(
    routeSource,
    /Location request timed out\. You can try again or continue without location\./
  );
});
