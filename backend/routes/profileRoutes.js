const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const uploadsRoot = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const folder = req.user.role === "clinic" ? "clinics" : "owners";
    const uploadDirectory = path.join(uploadsRoot, folder);
    fs.mkdirSync(uploadDirectory, { recursive: true });
    callback(null, uploadDirectory);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    callback(
      allowedTypes.includes(file.mimetype)
        ? null
        : new Error("Only JPG, PNG, and WEBP images are allowed."),
      allowedTypes.includes(file.mimetype)
    );
  },
});

const deleteUploadedPhoto = (photoUrl) => {
  if (!photoUrl || !photoUrl.startsWith("/uploads/")) return;

  const relativePath = photoUrl.replace(/^\/uploads\//, "");
  const resolvedPath = path.resolve(uploadsRoot, relativePath);
  const resolvedRoot = path.resolve(uploadsRoot);

  if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) return;

  fs.unlink(resolvedPath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("DELETE PROFILE PHOTO ERROR:", error);
    }
  });
};






router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [rows] = await db.query(
      `
        SELECT
          user_id,
          full_name,
          email,
          contact_number,
          address,
          role,
          clinic_name,
          profile_photo_url,
          created_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.json({
      success: true,
      user: rows[0],
    });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load profile.",
    });
  }
});






router.put("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      full_name,
      contact_number,
      address,
      clinic_name,
    } = req.body;

    const cleanFullName = String(
      full_name || ""
    ).trim();

    const cleanContactNumber = String(
      contact_number || ""
    ).trim();

    const cleanAddress = String(
      address || ""
    ).trim();

    const cleanClinicName = String(
      clinic_name || ""
    ).trim();

    
    
    

    if (
      !cleanFullName ||
      !cleanContactNumber ||
      !cleanAddress
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, contact number, and address are required.",
      });
    }

    if (cleanFullName.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Full name is too long.",
      });
    }

    if (cleanContactNumber.length > 20) {
      return res.status(400).json({
        success: false,
        message:
          "Contact number is too long.",
      });
    }

    if (cleanAddress.length > 255) {
      return res.status(400).json({
        success: false,
        message:
          "Address is too long.",
      });
    }

    
    
    

    const [existingUsers] = await db.query(
      `
        SELECT
          user_id,
          role,
          clinic_name
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    const existingUser = existingUsers[0];
    const isClinic = existingUser.role === "clinic";

    if (isClinic && !cleanClinicName) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is required.",
      });
    }

    if (isClinic && cleanClinicName.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is too long.",
      });
    }

    
    
    

    await db.query(
      `
        UPDATE users
        SET
          full_name = ?,
          contact_number = ?,
          address = ?,
          clinic_name = ?
        WHERE user_id = ?
      `,
      [
        cleanFullName,
        cleanContactNumber,
        cleanAddress,
        isClinic
          ? cleanClinicName
          : existingUser.clinic_name,
        userId,
      ]
    );

    
    
    

    const [updatedRows] = await db.query(
      `
        SELECT
          user_id,
          full_name,
          email,
          contact_number,
          address,
          role,
          clinic_name,
          profile_photo_url,
          created_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId]
    );

    return res.json({
      success: true,
      message:
        "Profile updated successfully.",
      user: updatedRows[0],
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile.",
    });
  }
});

router.put(
  "/photo",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a profile photo.",
        });
      }

      const userId = req.user.userId;
      const folder = req.user.role === "clinic" ? "clinics" : "owners";
      const photoUrl = `/uploads/${folder}/${req.file.filename}`;

      const [users] = await db.query(
        "SELECT profile_photo_url FROM users WHERE user_id = ? LIMIT 1",
        [userId]
      );

      if (users.length === 0) {
        deleteUploadedPhoto(photoUrl);
        return res.status(404).json({
          success: false,
          message: "User profile not found.",
        });
      }

      await db.query(
        "UPDATE users SET profile_photo_url = ? WHERE user_id = ?",
        [photoUrl, userId]
      );

      deleteUploadedPhoto(users[0].profile_photo_url);

      return res.json({
        success: true,
        message: "Profile photo updated successfully.",
        profile_photo_url: photoUrl,
      });
    } catch (error) {
      if (req.file) deleteUploadedPhoto(`/uploads/${req.user.role === "clinic" ? "clinics" : "owners"}/${req.file.filename}`);
      console.error("UPDATE PROFILE PHOTO ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update profile photo.",
      });
    }
  }
);






router.put(
  "/change-password",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const {
        current_password,
        new_password,
        confirm_password,
      } = req.body;

      
      
      

      if (
        !current_password ||
        !new_password ||
        !confirm_password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All password fields are required.",
        });
      }

      
      
      

      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be at least 6 characters.",
        });
      }

      if (new_password !== confirm_password) {
        return res.status(400).json({
          success: false,
          message:
            "New password and confirmation do not match.",
        });
      }

      if (current_password === new_password) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be different from your current password.",
        });
      }

      
      
      

      const [rows] = await db.query(
        `
          SELECT
            user_id,
            password
          FROM users
          WHERE user_id = ?
          LIMIT 1
        `,
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      const user = rows[0];

      
      
      

      const passwordMatches =
        await bcrypt.compare(
          current_password,
          user.password
        );

      if (!passwordMatches) {
        return res.status(400).json({
          success: false,
          message:
            "Current password is incorrect.",
        });
      }

      
      
      

      const hashedPassword =
        await bcrypt.hash(new_password, 10);

      
      
      

      await db.query(
        `
          UPDATE users
          SET password = ?
          WHERE user_id = ?
        `,
        [hashedPassword, userId]
      );

      return res.json({
        success: true,
        message:
          "Password changed successfully.",
      });
    } catch (error) {
      console.error(
        "CHANGE PASSWORD ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to change password.",
      });
    }
  }
);

module.exports = router;
