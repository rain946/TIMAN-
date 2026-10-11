const assert = require("node:assert/strict");
const test = require("node:test");

const {
  detectImageMimeType,
  getValidatedImageExtension,
} = require("../middleware/imageUpload");

test("image upload metadata requires matching MIME type and extension", () => {
  assert.equal(
    getValidatedImageExtension({
      originalname: "pet.JPG",
      mimetype: "image/jpeg",
    }),
    ".jpg"
  );
  assert.equal(
    getValidatedImageExtension({
      originalname: "pet.jpg",
      mimetype: "image/png",
    }),
    null
  );
  assert.equal(
    getValidatedImageExtension({
      originalname: "pet.exe",
      mimetype: "image/jpeg",
    }),
    null
  );
});

test("image upload signature detection accepts supported magic bytes", () => {
  assert.equal(
    detectImageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
    "image/jpeg"
  );
  assert.equal(
    detectImageMimeType(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
    "image/png"
  );
  assert.equal(
    detectImageMimeType(Buffer.from("RIFF1234WEBP", "ascii")),
    "image/webp"
  );
  assert.equal(detectImageMimeType(Buffer.from("not-an-image")), null);
});
