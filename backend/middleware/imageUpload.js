const fs = require("fs");
const path = require("path");

const ALLOWED_IMAGE_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const normalizeMimeType = (mimeType) =>
  mimeType === "image/jpg" ? "image/jpeg" : mimeType;

const getValidatedImageExtension = (file) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = normalizeMimeType(file.mimetype);

  return ALLOWED_IMAGE_TYPES.get(extension) === mimeType
    ? extension
    : null;
};

const imageFileFilter = (req, file, callback) => {
  if (!getValidatedImageExtension(file)) {
    return callback(
      new Error("Only valid JPG, PNG, and WEBP images are allowed.")
    );
  }

  return callback(null, true);
};

const detectImageMimeType = (bytes) => {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

const removeUploadedFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("INVALID UPLOAD CLEANUP ERROR:", error);
    }
  }
};

const validateUploadedImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  let fileHandle;

  try {
    fileHandle = await fs.promises.open(req.file.path, "r");
    const signature = Buffer.alloc(12);
    const { bytesRead } = await fileHandle.read(signature, 0, 12, 0);
    const detectedMimeType = detectImageMimeType(
      signature.subarray(0, bytesRead)
    );
    const submittedMimeType = normalizeMimeType(req.file.mimetype);

    if (!detectedMimeType || detectedMimeType !== submittedMimeType) {
      await fileHandle.close();
      fileHandle = null;
      await removeUploadedFile(req.file.path);

      return res.status(400).json({
        success: false,
        message: "The uploaded file is not a valid JPG, PNG, or WEBP image.",
      });
    }

    await fileHandle.close();
    fileHandle = null;
    return next();
  } catch (error) {
    if (fileHandle) {
      await fileHandle.close();
      fileHandle = null;
    }
    await removeUploadedFile(req.file.path);
    return next(error);
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
};

module.exports = {
  detectImageMimeType,
  getValidatedImageExtension,
  imageFileFilter,
  validateUploadedImage,
};
