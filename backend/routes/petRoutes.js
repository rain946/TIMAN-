const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// PET UPLOAD DIRECTORY
// ========================================

const uploadDirectory = path.join(
  __dirname,
  "..",
  "uploads",
  "pets"
);

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

// ========================================
// MULTER STORAGE
// ========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension =
      path.extname(file.originalname) || ".jpg";

    const filename =
      `${Date.now()}-${crypto.randomUUID()}${extension}`;

    cb(null, filename);
  },
});

// ========================================
// FILE FILTER
// ========================================

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPG, PNG, and WEBP images are allowed."
      )
    );
  }
};

// ========================================
// MULTER
// ========================================

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter,
});

// ========================================
// ADD PET
// ========================================

router.post(
  "/",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (req.user.role !== "owner") {
        if (req.file) {
          deleteFile(req.file.path);
        }

        return res.status(403).json({
          success: false,
          message:
            "Only pet owners can register pets.",
        });
      }

      const {
        petName,
        species,
        breed,
        sex,
        birthDate,
        color,
        identifyingMarks,
      } = req.body;

      if (!petName || !species || !sex) {
        if (req.file) {
          deleteFile(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message:
            "Pet name, species, and sex are required.",
        });
      }

      if (!["Male", "Female"].includes(sex)) {
        if (req.file) {
          deleteFile(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: "Invalid pet sex.",
        });
      }

      // ========================================
      // PERMANENT QR TOKEN
      // ========================================

      const qrCode = crypto.randomUUID();

      // ========================================
      // PHOTO PATH
      // ========================================

      const photoUrl = req.file
        ? `/uploads/pets/${req.file.filename}`
        : null;

      // ========================================
      // INSERT PET
      // ========================================

      const [result] = await db.query(
        `INSERT INTO pets
        (
          owner_id,
          pet_name,
          species,
          breed,
          sex,
          birth_date,
          color,
          identifying_marks,
          photo_url,
          qr_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.userId,
          petName.trim(),
          species.trim(),
          breed?.trim() || null,
          sex,
          birthDate || null,
          color?.trim() || null,
          identifyingMarks?.trim() || null,
          photoUrl,
          qrCode,
        ]
      );

      res.status(201).json({
        success: true,
        message:
          "Pet registered successfully.",

        pet: {
          petId: result.insertId,
          petName: petName.trim(),
          photoUrl,
          qrCode,
        },
      });
    } catch (error) {
      if (req.file) {
        deleteFile(req.file.path);
      }

      console.error(
        "ADD PET ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to register pet.",
      });
    }
  }
);

// ========================================
// GET MY PETS
// ========================================

router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== "owner") {
        return res.status(403).json({
          success: false,
          message:
            "Only pet owners can view their pets.",
        });
      }

      const [pets] = await db.query(
        `SELECT
          pet_id,
          pet_name,
          species,
          breed,
          sex,
          birth_date,
          color,
          identifying_marks,
          photo_url,
          qr_code,
          pet_status,
          created_at
        FROM pets
        WHERE owner_id = ?
        ORDER BY created_at DESC`,
        [req.user.userId]
      );

      res.json({
        success: true,
        pets,
      });
    } catch (error) {
      console.error(
        "GET PETS ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load pets.",
      });
    }
  }
);

// ========================================
// UPDATE PET PHOTO
// IMPORTANT: MUST BE BEFORE /:id
// ========================================

router.put(
  "/:id/photo",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (req.user.role !== "owner") {
        if (req.file) {
          deleteFile(req.file.path);
        }

        return res.status(403).json({
          success: false,
          message:
            "Only pet owners can update pet photos.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a pet photo.",
        });
      }

      const [pets] = await db.query(
        `SELECT
          pet_id,
          photo_url
        FROM pets
        WHERE pet_id = ?
        AND owner_id = ?`,
        [
          req.params.id,
          req.user.userId,
        ]
      );

      if (pets.length === 0) {
        deleteFile(req.file.path);

        return res.status(404).json({
          success: false,
          message: "Pet not found.",
        });
      }

      const pet = pets[0];

      const newPhotoUrl =
        `/uploads/pets/${req.file.filename}`;

      await db.query(
        `UPDATE pets
         SET photo_url = ?
         WHERE pet_id = ?
         AND owner_id = ?`,
        [
          newPhotoUrl,
          req.params.id,
          req.user.userId,
        ]
      );

      if (pet.photo_url) {
        const oldFilename =
          path.basename(pet.photo_url);

        const oldPhotoPath =
          path.join(
            uploadDirectory,
            oldFilename
          );

        deleteFile(oldPhotoPath);
      }

      res.json({
        success: true,
        message:
          "Pet photo updated successfully.",

        photoUrl: newPhotoUrl,
      });
    } catch (error) {
      if (req.file) {
        deleteFile(req.file.path);
      }

      console.error(
        "UPDATE PET PHOTO ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to update pet photo.",
      });
    }
  }
);

// ========================================
// UPDATE PET STATUS
// OWNER ONLY
// IMPORTANT: MUST BE BEFORE /:id
// ========================================

router.patch(
  "/:id/status",
  authMiddleware,
  async (req, res) => {
    try {
      // ========================================
      // OWNER ROLE CHECK
      // ========================================

      if (req.user.role !== "owner") {
        return res.status(403).json({
          success: false,
          message:
            "Only pet owners can update pet status.",
        });
      }

      const petId = req.params.id;
      const { status } = req.body;

      // ========================================
      // VALIDATE STATUS
      // ========================================

      const allowedStatuses = [
        "Safe",
        "Missing",
        "Found",
      ];

      if (!status) {
        return res.status(400).json({
          success: false,
          message:
            "Pet status is required.",
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pet status. Status must be Safe, Missing, or Found.",
        });
      }

      // ========================================
      // CHECK PET OWNERSHIP
      // ========================================

      const [pets] = await db.query(
        `SELECT
          pet_id,
          pet_name,
          pet_status
        FROM pets
        WHERE pet_id = ?
        AND owner_id = ?
        LIMIT 1`,
        [
          petId,
          req.user.userId,
        ]
      );

      if (pets.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Pet not found or you do not own this pet.",
        });
      }

      const pet = pets[0];

      // ========================================
      // SAME STATUS
      // ========================================

      if (pet.pet_status === status) {
        return res.json({
          success: true,
          message:
            `${pet.pet_name} is already marked as ${status}.`,

          pet: {
            petId: pet.pet_id,
            petName: pet.pet_name,
            petStatus: pet.pet_status,
          },
        });
      }

      // ========================================
      // UPDATE STATUS
      // ========================================

      await db.query(
        `UPDATE pets
         SET pet_status = ?
         WHERE pet_id = ?
         AND owner_id = ?`,
        [
          status,
          petId,
          req.user.userId,
        ]
      );

      // ========================================
      // RESPONSE MESSAGE
      // ========================================

      let message =
        `${pet.pet_name}'s status has been updated to ${status}.`;

      if (status === "Missing") {
        message =
          `${pet.pet_name} has been marked as missing. The permanent QR code remains active for recovery.`;
      }

      if (status === "Found") {
        message =
          `${pet.pet_name} has been marked as found.`;
      }

      if (status === "Safe") {
        message =
          `${pet.pet_name} has been marked as safe.`;
      }

      res.json({
        success: true,
        message,

        pet: {
          petId: Number(petId),
          petName: pet.pet_name,
          petStatus: status,
        },
      });
    } catch (error) {
      console.error(
        "UPDATE PET STATUS ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to update pet status.",
      });
    }
  }
);

// ========================================
// GET ONE PET
// ========================================

router.get(
  "/:id",
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== "owner") {
        return res.status(403).json({
          success: false,
          message:
            "Only pet owners can view their pet profile.",
        });
      }

      const [pets] = await db.query(
        `SELECT *
         FROM pets
         WHERE pet_id = ?
         AND owner_id = ?`,
        [
          req.params.id,
          req.user.userId,
        ]
      );

      if (pets.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Pet not found.",
        });
      }

      res.json({
        success: true,
        pet: pets[0],
      });
    } catch (error) {
      console.error(
        "GET PET ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load pet.",
      });
    }
  }
);

// ========================================
// DELETE FILE HELPER
// ========================================

function deleteFile(filePath) {
  try {
    if (
      filePath &&
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(
      "DELETE FILE ERROR:",
      error
    );
  }
}

module.exports = router;
