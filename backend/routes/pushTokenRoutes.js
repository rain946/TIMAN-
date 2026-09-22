const express = require("express");

const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// =====================================================
// REGISTER PUSH TOKEN
// POST /api/push-tokens/register
// =====================================================

router.post("/register", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      expo_push_token,
      device_platform,
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (
      !expo_push_token ||
      typeof expo_push_token !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Expo push token is required.",
      });
    }

    const token = expo_push_token.trim();

    // Expo tokens normally use one of these formats
    const isValidExpoToken =
      token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken[");

    if (!isValidExpoToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expo push token.",
      });
    }

    const platform =
      device_platform === "ios"
        ? "ios"
        : "android";

    // -------------------------------------------------
    // INSERT OR UPDATE TOKEN
    // -------------------------------------------------

    await db.query(
      `
      INSERT INTO push_tokens (
        user_id,
        expo_push_token,
        device_platform,
        is_active
      )
      VALUES (?, ?, ?, TRUE)

      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        device_platform = VALUES(device_platform),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        userId,
        token,
        platform,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Push token registered successfully.",
    });
  } catch (error) {
    console.error(
      "REGISTER PUSH TOKEN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to register push token.",
      error: error.message,
    });
  }
});

// =====================================================
// GET CURRENT USER PUSH TOKENS
// GET /api/push-tokens/my-tokens
// =====================================================

router.get("/my-tokens", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [rows] = await db.query(
      `
      SELECT
        push_token_id,
        expo_push_token,
        device_platform,
        is_active,
        created_at,
        updated_at
      FROM push_tokens
      WHERE user_id = ?
      ORDER BY updated_at DESC
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      tokens: rows,
    });
  } catch (error) {
    console.error(
      "GET PUSH TOKENS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve push tokens.",
      error: error.message,
    });
  }
});

// =====================================================
// DISABLE PUSH TOKEN
// POST /api/push-tokens/unregister
// =====================================================

router.post("/unregister", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      expo_push_token,
    } = req.body;

    if (
      !expo_push_token ||
      typeof expo_push_token !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Expo push token is required.",
      });
    }

    const [result] = await db.query(
      `
      UPDATE push_tokens
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        user_id = ?
        AND expo_push_token = ?
      `,
      [
        userId,
        expo_push_token.trim(),
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Push token disabled successfully.",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error(
      "UNREGISTER PUSH TOKEN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to unregister push token.",
      error: error.message,
    });
  }
});

module.exports = router;
