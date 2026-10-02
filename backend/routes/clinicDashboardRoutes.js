const express = require("express");

const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const philippineMonthStart = `
  DATE_FORMAT(
    CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
    '%Y-%m-01'
  )
`;

const philippineNextMonthStart = `
  DATE_ADD(${philippineMonthStart}, INTERVAL 1 MONTH)
`;

router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "clinic") {
      return res.status(403).json({
        success: false,
        message: "Clinic access is required.",
      });
    }

    const clinicUserId = req.user.userId;

    const [clinicRows] = await db.query(
      `
      SELECT user_id, full_name, clinic_name
      FROM users
      WHERE user_id = ?
        AND role = 'clinic'
      LIMIT 1
      `,
      [clinicUserId]
    );

    if (clinicRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Clinic profile not found.",
      });
    }

    const [[bookedCountRows], [rescheduledCountRows], [cancelledCountRows], [pendingRequests], [recentActivity]] =
      await Promise.all([
        db.query(
          `
          SELECT COUNT(*) AS total
          FROM vet_records vr
          INNER JOIN pets p ON p.pet_id = vr.pet_id
          WHERE vr.clinic_user_id = ?
            AND p.archived_at IS NULL
            AND vr.next_due_date >= ${philippineMonthStart}
            AND vr.next_due_date < ${philippineNextMonthStart}
          `,
          [clinicUserId]
        ),
        db.query(
          `
          SELECT COUNT(*) AS total
          FROM vet_records vr
          INNER JOIN pets p ON p.pet_id = vr.pet_id
          WHERE vr.clinic_user_id = ?
            AND p.archived_at IS NULL
            AND vr.rescheduled_at >= ${philippineMonthStart}
            AND vr.rescheduled_at < ${philippineNextMonthStart}
          `,
          [clinicUserId]
        ),
        db.query(
          `
          SELECT COUNT(*) AS total
          FROM vet_records vr
          INNER JOIN pets p ON p.pet_id = vr.pet_id
          WHERE vr.clinic_user_id = ?
            AND p.archived_at IS NULL
            AND vr.schedule_status = 'Cancelled'
            AND vr.cancelled_at >= ${philippineMonthStart}
            AND vr.cancelled_at < ${philippineNextMonthStart}
          `,
          [clinicUserId]
        ),
        db.query(
          `
          SELECT
            ca.authorization_id,
            ca.pet_id,
            ca.requested_at,
            p.pet_name,
            p.species,
            p.breed,
            p.photo_url
          FROM clinic_authorizations ca
          INNER JOIN pets p ON p.pet_id = ca.pet_id
          WHERE ca.clinic_user_id = ?
            AND ca.status = 'Pending'
            AND p.archived_at IS NULL
          ORDER BY ca.requested_at DESC, ca.authorization_id DESC
          LIMIT 3
          `,
          [clinicUserId]
        ),
        db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,
            vr.service_type,
            vr.visit_date,
            vr.created_at,
            p.pet_name,
            EXISTS (
              SELECT 1
              FROM clinic_authorizations ca
              WHERE ca.pet_id = vr.pet_id
                AND ca.clinic_user_id = ?
                AND ca.status = 'Approved'
            ) AS can_open
          FROM vet_records vr
          INNER JOIN pets p ON p.pet_id = vr.pet_id
          WHERE vr.clinic_user_id = ?
            AND p.archived_at IS NULL
          ORDER BY vr.created_at DESC, vr.record_id DESC
          LIMIT 3
          `,
          [clinicUserId, clinicUserId]
        ),
      ]);

    const clinic = clinicRows[0];

    return res.json({
      success: true,
      clinic: {
        user_id: clinic.user_id,
        full_name: clinic.full_name,
        clinic_name: clinic.clinic_name,
      },
      overview: {
        booked: Number(bookedCountRows[0]?.total || 0),
        cancelled: Number(cancelledCountRows[0]?.total || 0),
        rescheduled: Number(rescheduledCountRows[0]?.total || 0),
      },
      pending_requests: pendingRequests,
      recent_activity: recentActivity.map((item) => ({
        ...item,
        can_open: Boolean(item.can_open),
      })),
    });
  } catch (error) {
    console.error("CLINIC DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load the clinic dashboard.",
    });
  }
});

module.exports = router;
