const express = require("express");

const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const requireClinic = (req, res, next) => {
  if (req.user.role !== "clinic") {
    return res.status(403).json({
      success: false,
      message: "Clinic access is required.",
    });
  }

  next();
};

const isValidDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

router.get("/", authMiddleware, requireClinic, async (req, res) => {
  try {
    const clinicUserId = req.user.userId;
    const startDate = String(req.query.startDate || "").trim();
    const endDate = String(req.query.endDate || "").trim();

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required.",
      });
    }

    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
      return res.status(400).json({
        success: false,
        message: "Report dates must use a valid YYYY-MM-DD format.",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date.",
      });
    }

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

    const [summaryRows] = await db.query(
      `
      SELECT
        SUM(next_due_date IS NOT NULL AND DATE(created_at) BETWEEN ? AND ?) AS booked,
        SUM(DATE(completed_at) BETWEEN ? AND ?) AS completed,
        SUM(DATE(cancelled_at) BETWEEN ? AND ?) AS cancelled
      FROM vet_records
      WHERE clinic_user_id = ?
      `,
      [
        startDate,
        endDate,
        startDate,
        endDate,
        startDate,
        endDate,
        clinicUserId,
      ]
    );

    const [records] = await db.query(
      `
      SELECT
        vr.record_id,
        vr.pet_id,
        p.pet_name,
        p.species,
        p.breed,
        vr.service_type,
        vr.visit_date,
        vr.next_due_date,
        vr.schedule_status,
        vr.completed_at,
        vr.cancelled_at,
        vr.created_at
      FROM vet_records vr
      INNER JOIN pets p ON p.pet_id = vr.pet_id
      WHERE vr.clinic_user_id = ?
        AND (
          (vr.next_due_date IS NOT NULL AND DATE(vr.created_at) BETWEEN ? AND ?)
          OR DATE(vr.completed_at) BETWEEN ? AND ?
          OR DATE(vr.cancelled_at) BETWEEN ? AND ?
        )
      ORDER BY
        COALESCE(vr.cancelled_at, vr.completed_at, vr.next_due_date) DESC,
        vr.record_id DESC
      `,
      [
        clinicUserId,
        startDate,
        endDate,
        startDate,
        endDate,
        startDate,
        endDate,
      ]
    );

    const summary = summaryRows[0] || {};
    const clinic = clinicRows[0];

    return res.json({
      success: true,
      clinic: {
        user_id: clinic.user_id,
        full_name: clinic.full_name,
        clinic_name: clinic.clinic_name,
      },
      period: {
        start_date: startDate,
        end_date: endDate,
      },
      summary: {
        booked: Number(summary.booked || 0),
        completed: Number(summary.completed || 0),
        cancelled: Number(summary.cancelled || 0),
      },
      records,
    });
  } catch (error) {
    console.error("CLINIC REPORT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to generate the clinic report.",
    });
  }
});

module.exports = router;
