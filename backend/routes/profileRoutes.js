const express = require("express");
const bcrypt = require("bcryptjs");

const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();






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
        SELECT user_id
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

    
    
    

    await db.query(
      `
        UPDATE users
        SET
          full_name = ?,
          contact_number = ?,
          address = ?
        WHERE user_id = ?
      `,
      [
        cleanFullName,
        cleanContactNumber,
        cleanAddress,
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
