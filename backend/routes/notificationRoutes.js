const express = require("express");
const db = require("../config/db");
const authMiddleware = require(
  "../middleware/authMiddleware"
);

const {
  sendExpoPushNotification,
} = require("../services/pushService");

const router = express.Router();






router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const [rows] = await db.query(
        `
        SELECT
          n.notification_id,
          n.user_id,
          n.type,
          n.title,
          n.message,
          n.pet_id,
          n.authorization_id,
          n.is_read,
          n.created_at,

          p.pet_name

        FROM notifications n

        LEFT JOIN pets p
          ON n.pet_id = p.pet_id

        WHERE n.user_id = ?

        ORDER BY
          n.created_at DESC,
          n.notification_id DESC
        `,
        [userId]
      );

      return res.json({
        success: true,

        notifications: rows.map(
          (notification) => ({
            ...notification,

            is_read: Boolean(
              notification.is_read
            ),
          })
        ),
      });
    } catch (error) {
      console.error(
        "GET NOTIFICATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load notifications.",
      });
    }
  }
);






router.get(
  "/unread-count",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const [rows] = await db.query(
        `
        SELECT
          COUNT(*) AS unread_count
        FROM notifications
        WHERE user_id = ?
          AND is_read = FALSE
        `,
        [userId]
      );

      return res.json({
        success: true,

        unreadCount: Number(
          rows[0]?.unread_count || 0
        ),
      });
    } catch (error) {
      console.error(
        "GET UNREAD COUNT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load unread notification count.",
      });
    }
  }
);






router.patch(
  "/read-all",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const [result] = await db.query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = ?
          AND is_read = FALSE
        `,
        [userId]
      );

      return res.json({
        success: true,

        message:
          "All notifications marked as read.",

        updated:
          result.affectedRows,
      });
    } catch (error) {
      console.error(
        "MARK ALL NOTIFICATIONS READ ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update notifications.",
      });
    }
  }
);






router.patch(
  "/:notificationId/read",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const notificationId = Number(
        req.params.notificationId
      );

      if (
        !Number.isInteger(notificationId) ||
        notificationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid notification ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          notification_id,
          is_read
        FROM notifications
        WHERE notification_id = ?
          AND user_id = ?
        LIMIT 1
        `,
        [
          notificationId,
          userId,
        ]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Notification not found.",
        });
      }

      await db.query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE notification_id = ?
          AND user_id = ?
        `,
        [
          notificationId,
          userId,
        ]
      );

      return res.json({
        success: true,
        message:
          "Notification marked as read.",
      });
    } catch (error) {
      console.error(
        "MARK NOTIFICATION READ ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update notification.",
      });
    }
  }
);











router.delete(
  "/read",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        req.user.userId;

      const [result] =
        await db.query(
          `
          DELETE FROM notifications
          WHERE user_id = ?
            AND is_read = TRUE
          `,
          [userId]
        );

      return res.json({
        success: true,

        message:
          result.affectedRows > 0
            ? `${result.affectedRows} read notification(s) deleted.`
            : "There are no read notifications to delete.",

        deleted:
          result.affectedRows,
      });
    } catch (error) {
      console.error(
        "DELETE READ NOTIFICATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to delete read notifications.",
      });
    }
  }
);


router.delete(
  "/:notificationId",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        req.user.userId;

      const notificationId =
        Number(
          req.params.notificationId
        );


      if (
        !Number.isInteger(
          notificationId
        ) ||
        notificationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid notification ID.",
        });
      }


      const [rows] =
        await db.query(
          `
          SELECT
            notification_id,
            is_read
          FROM notifications
          WHERE notification_id = ?
            AND user_id = ?
          LIMIT 1
          `,
          [
            notificationId,
            userId,
          ]
        );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Notification not found.",
        });
      }


      if (!Boolean(rows[0].is_read)) {
        return res.status(400).json({
          success: false,
          message:
            "Unread notifications cannot be deleted. Read the notification first.",
        });
      }


      const [result] =
        await db.query(
          `
          DELETE FROM notifications
          WHERE notification_id = ?
            AND user_id = ?
            AND is_read = TRUE
          `,
          [
            notificationId,
            userId,
          ]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "The notification could not be deleted.",
        });
      }

      return res.json({
        success: true,

        message:
          "Notification deleted successfully.",

        notification_id:
          notificationId,
      });
    } catch (error) {
      console.error(
        "DELETE NOTIFICATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to delete notification.",
      });
    }
  }
);


router.post(
  "/test-push",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        req.user.userId;

      const [tokens] =
        await db.query(
          `
          SELECT
            push_token_id,
            expo_push_token
          FROM push_tokens
          WHERE user_id = ?
            AND is_active = TRUE
          `,
          [userId]
        );

      if (tokens.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No active push token found for this user.",
        });
      }

      const results = [];

      for (
        const tokenRow of tokens
      ) {
        const result =
          await sendExpoPushNotification(
            {
              to:
                tokenRow.expo_push_token,

              title:
                "TIMAN Server Test",

              body:
                "Success! This notification was sent from the TIMAN server.",

              data: {
                type:
                  "server-test",

                source:
                  "timan-backend",
              },
            }
          );

        results.push({
          push_token_id:
            tokenRow.push_token_id,

          success:
            result.success,

          error:
            result.error || null,

          message:
            result.message || null,

          ticket:
            result.ticket || null,
        });
      }

      const successful =
        results.filter(
          (item) =>
            item.success
        ).length;

      return res.json({
        success:
          successful > 0,

        message:
          `${successful} of ${results.length} push notification(s) accepted by Expo.`,

        results,
      });
    } catch (error) {
      console.error(
        "TEST PUSH ROUTE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to send test push notification.",

        error:
          error.message,
      });
    }
  }
);

module.exports = router;
