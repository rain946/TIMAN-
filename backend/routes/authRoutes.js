const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../config/db");

const router = express.Router();

// ========================================
// REGISTER
// POST /api/auth/register
// ========================================

router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      contactNumber,
      address,
      role,
      clinicName,
    } = req.body;

    // Required fields
    if (
      !fullName ||
      !email ||
      !password ||
      !contactNumber ||
      !address ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields.",
      });
    }

    // Valid role
    if (!["owner", "clinic"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account role.",
      });
    }

    // Clinic name required
    if (role === "clinic" && !clinicName) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is required.",
      });
    }

    // Password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters.",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    // Check existing email
    const [existingUsers] = await db.query(
      "SELECT user_id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This email address is already registered.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // Save user
    const [result] = await db.query(
      `INSERT INTO users
      (
        full_name,
        email,
        password,
        contact_number,
        address,
        role,
        clinic_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName.trim(),
        normalizedEmail,
        hashedPassword,
        contactNumber.trim(),
        address.trim(),
        role,
        role === "clinic"
          ? clinicName.trim()
          : null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        userId: result.insertId,
        fullName: fullName.trim(),
        email: normalizedEmail,
        role,
        clinicName:
          role === "clinic"
            ? clinicName.trim()
            : null,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating account.",
    });
  }
});

// ========================================
// LOGIN
// POST /api/auth/login
// ========================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    // Find account
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    const user = users[0];

    // Compare password
    const passwordCorrect =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    // JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      message: "Login successful.",
      token,

      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        contactNumber: user.contact_number,
        address: user.address,
        role: user.role,
        clinicName: user.clinic_name,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while logging in.",
    });
  }
});

module.exports = router;
