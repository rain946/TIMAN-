const express = require("express");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const REPEAT_TYPES = new Set(["None", "Weekly", "Monthly"]);
const STANDARD_CARE_TYPES = new Set(["Grooming", "Bath", "Nail Trimming"]);

const requireOwner = (req, res, next) => {
  if (req.user.role !== "owner") {
    return res
      .status(403)
      .json({
        success: false,
        message: "Only pet owners can manage personal care schedules.",
      });
  }
  next();
};

const parseDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
};

const getPhilippineToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

const getPhilippineNow = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
};

const validateInput = (body) => {
  const petId = Number(body.pet_id);
  const careType = String(body.care_type || "").trim();
  const customCareName = String(body.custom_care_name || "").trim();
  const scheduledDate = String(body.scheduled_date || "").trim();
  const scheduledTime = String(body.scheduled_time || "09:00").trim();
  const repeatType = String(body.repeat_type || "None").trim();
  const notes = String(body.notes || "").trim();
  const finalCareType = careType === "Other" ? customCareName : careType;

  if (!Number.isInteger(petId) || petId <= 0)
    return { error: "Invalid pet ID." };
  if (
    (!STANDARD_CARE_TYPES.has(careType) && careType !== "Other") ||
    !finalCareType ||
    finalCareType.length > 100
  ) {
    return {
      error:
        "Choose a valid care type and keep custom care names within 100 characters.",
    };
  }
  if (!parseDateOnly(scheduledDate))
    return { error: "Scheduled date must be a valid YYYY-MM-DD date." };
  if (scheduledDate < getPhilippineToday())
    return { error: "Scheduled date cannot be in the past." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime))
    return { error: "Scheduled time must be a valid 24-hour HH:MM time." };
  if (`${scheduledDate} ${scheduledTime}:00` <= getPhilippineNow())
    return { error: "Scheduled date and time must be in the future." };
  if (!REPEAT_TYPES.has(repeatType)) return { error: "Invalid repeat type." };
  if (notes.length > 500)
    return { error: "Notes must not exceed 500 characters." };
  return {
    petId,
    careType: finalCareType,
    scheduledDate,
    scheduledTime: `${scheduledTime}:00`,
    repeatType,
    notes: notes || null,
  };
};

const nextOccurrenceDate = (dateValue, repeatType) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (repeatType === "Weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (repeatType === "Monthly") {
    const targetMonthStart = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(
      Date.UTC(
        targetMonthStart.getUTCFullYear(),
        targetMonthStart.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();
    date.setUTCFullYear(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(day, lastDay),
    );
  }
  return date.toISOString().slice(0, 10);
};

router.get("/", authMiddleware, requireOwner, async (req, res) => {
  try {
    const petId = req.query.pet_id ? Number(req.query.pet_id) : null;
    if (petId !== null && (!Number.isInteger(petId) || petId <= 0)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid pet ID." });
    }
    const params = [req.user.userId];
    let petFilter = "";
    if (petId !== null) {
      petFilter = "AND pcs.pet_id = ?";
      params.push(petId);
    }
    const [rows] = await db.query(
      `SELECT pcs.care_schedule_id, pcs.pet_id, pcs.care_type,
              DATE_FORMAT(pcs.scheduled_date, '%Y-%m-%d') AS scheduled_date,
              DATE_FORMAT(pcs.scheduled_time, '%H:%i') AS scheduled_time,
              pcs.repeat_type, pcs.series_id,
              DATE_FORMAT(pcs.recurrence_anchor_date, '%Y-%m-%d') AS recurrence_anchor_date,
              pcs.series_status, pcs.notes, pcs.status, pcs.previous_schedule_id,
              pcs.completed_at, pcs.cancelled_at, pcs.created_at, pcs.updated_at,
              p.pet_name, p.species, p.breed, p.photo_url
       FROM pet_care_schedules pcs
       INNER JOIN pets p ON p.pet_id = pcs.pet_id
       WHERE pcs.owner_id = ? AND p.owner_id = ? ${petFilter}
       ORDER BY CASE pcs.status WHEN 'Pending' THEN 0 ELSE 1 END,
                pcs.scheduled_date ASC, pcs.care_schedule_id DESC`,
      [req.user.userId, ...params],
    );
    return res.json({ success: true, schedules: rows });
  } catch (error) {
    console.error("GET PET CARE SCHEDULES ERROR:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Unable to load personal care schedules.",
      });
  }
});

router.post("/", authMiddleware, requireOwner, async (req, res) => {
  try {
    const input = validateInput(req.body || {});
    if (input.error)
      return res.status(400).json({ success: false, message: input.error });
    const [pets] = await db.query(
      "SELECT pet_id FROM pets WHERE pet_id = ? AND owner_id = ? AND archived_at IS NULL LIMIT 1",
      [input.petId, req.user.userId],
    );
    if (!pets.length)
      return res
        .status(404)
        .json({
          success: false,
          message: "Pet not found or you do not own this pet.",
        });
    const [result] = await db.query(
      `INSERT INTO pet_care_schedules
       (owner_id, pet_id, care_type, scheduled_date, scheduled_time, repeat_type, series_id, recurrence_anchor_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, UUID(), ?, ?)`,
      [
        req.user.userId,
        input.petId,
        input.careType,
        input.scheduledDate,
        input.scheduledTime,
        input.repeatType,
        input.scheduledDate,
        input.notes,
      ],
    );
    return res
      .status(201)
      .json({
        success: true,
        message: "Personal care schedule saved.",
        care_schedule_id: result.insertId,
      });
  } catch (error) {
    console.error("CREATE PET CARE SCHEDULE ERROR:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Unable to save personal care schedule.",
      });
  }
});

router.patch("/:id", authMiddleware, requireOwner, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const scope = String(req.body.scope || "occurrence");
    const input = validateInput(req.body || {});
    if (!Number.isInteger(id) || id <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Invalid care schedule ID." });
    if (input.error)
      return res.status(400).json({ success: false, message: input.error });
    if (!new Set(["occurrence", "series"]).has(scope))
      return res.status(400).json({ success: false, message: "Invalid recurring schedule scope." });
    const [pets] = await db.query(
      "SELECT pet_id FROM pets WHERE pet_id = ? AND owner_id = ? AND archived_at IS NULL LIMIT 1",
      [input.petId, req.user.userId],
    );
    if (!pets.length)
      return res
        .status(404)
        .json({
          success: false,
          message: "Pet not found or you do not own this pet.",
        });
    const [result] = await db.query(
      `UPDATE pet_care_schedules SET pet_id=?, care_type=?, scheduled_date=?, scheduled_time=?, repeat_type=?, notes=?,
         recurrence_anchor_date=CASE WHEN ?='series' THEN ? ELSE recurrence_anchor_date END
       WHERE care_schedule_id=? AND owner_id=? AND status='Pending'`,
      [
        input.petId,
        input.careType,
        input.scheduledDate,
        input.scheduledTime,
        input.repeatType,
        input.notes,
        scope,
        input.scheduledDate,
        id,
        req.user.userId,
      ],
    );
    if (!result.affectedRows)
      return res
        .status(404)
        .json({
          success: false,
          message: "Pending personal care schedule not found.",
        });
    await db.query(
      "DELETE FROM pet_care_reminder_logs WHERE care_schedule_id = ?",
      [id],
    );
    return res.json({
      success: true,
      message: "Personal care schedule updated.",
    });
  } catch (error) {
    console.error("UPDATE PET CARE SCHEDULE ERROR:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Unable to update personal care schedule.",
      });
  }
});

router.patch("/:id/cancel", authMiddleware, requireOwner, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id = Number(req.params.id);
    const scope = String(req.body.scope || "");
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT *, DATE_FORMAT(scheduled_date,'%Y-%m-%d') scheduled_value,
              DATE_FORMAT(COALESCE(recurrence_anchor_date, scheduled_date),'%Y-%m-%d') anchor_value
       FROM pet_care_schedules WHERE care_schedule_id=? AND owner_id=? LIMIT 1 FOR UPDATE`,
      [id, req.user.userId],
    );
    const schedule = rows[0];
    if (!schedule || schedule.status !== "Pending") {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Pending personal care schedule not found." });
    }
    if (schedule.repeat_type !== "None" && !new Set(["occurrence", "series"]).has(scope)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Choose whether to cancel this occurrence or the entire series." });
    }
    const [result] = await connection.query(
      `UPDATE pet_care_schedules SET status='Cancelled', cancelled_at=NOW()
       WHERE care_schedule_id=? AND owner_id=? AND status='Pending'`,
      [id, req.user.userId],
    );
    if (!result.affectedRows)
      { await connection.rollback(); return res
        .status(404)
        .json({
          success: false,
          message: "Pending personal care schedule not found.",
        }); }
    if (schedule.repeat_type !== "None" && scope === "occurrence" && schedule.series_status === "Active") {
      const nextDate = nextOccurrenceDate(schedule.anchor_value, schedule.repeat_type);
      await connection.query(
        `INSERT INTO pet_care_schedules
         (owner_id,pet_id,care_type,scheduled_date,scheduled_time,repeat_type,series_id,recurrence_anchor_date,series_status,notes,previous_schedule_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE care_schedule_id=LAST_INSERT_ID(care_schedule_id)`,
        [schedule.owner_id, schedule.pet_id, schedule.care_type, nextDate, schedule.scheduled_time, schedule.repeat_type,
          schedule.series_id, nextDate, "Active", schedule.notes, schedule.care_schedule_id],
      );
    }
    if (scope === "series") {
      await connection.query(
        `UPDATE pet_care_schedules
         SET series_status='Cancelled',
             cancelled_at=CASE WHEN status='Pending' THEN NOW() ELSE cancelled_at END,
             status=CASE WHEN status='Pending' THEN 'Cancelled' ELSE status END
         WHERE series_id=? AND owner_id=?`,
        [schedule.series_id, req.user.userId],
      );
    }
    await connection.commit();
    return res.json({
      success: true,
      message: "Personal care schedule cancelled.",
    });
  } catch (error) {
    await connection.rollback();
    console.error("CANCEL PET CARE SCHEDULE ERROR:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Unable to cancel personal care schedule.",
      });
  } finally { connection.release(); }
});

router.patch(
  "/:id/complete",
  authMiddleware,
  requireOwner,
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT care_schedule_id, owner_id, pet_id, care_type,
              DATE_FORMAT(scheduled_date, '%Y-%m-%d') AS scheduled_date,
              DATE_FORMAT(scheduled_time, '%H:%i') AS scheduled_time,
              repeat_type, series_id, series_status,
              DATE_FORMAT(COALESCE(recurrence_anchor_date, scheduled_date), '%Y-%m-%d') AS anchor_date,
              notes, status
       FROM pet_care_schedules WHERE care_schedule_id=? AND owner_id=? LIMIT 1 FOR UPDATE`,
        [Number(req.params.id), req.user.userId],
      );
      if (!rows.length || rows[0].status !== "Pending") {
        await connection.rollback();
        return res
          .status(409)
          .json({
            success: false,
            message: "This personal care schedule is no longer pending.",
          });
      }
      const schedule = rows[0];
      await connection.query(
        "UPDATE pet_care_schedules SET status='Completed', completed_at=NOW() WHERE care_schedule_id=? AND status='Pending'",
        [schedule.care_schedule_id],
      );
      let nextScheduleId = null;
      if (schedule.repeat_type !== "None" && schedule.series_status === "Active") {
        const nextDate = nextOccurrenceDate(
          schedule.anchor_date,
          schedule.repeat_type,
        );
        const [nextResult] = await connection.query(
          `INSERT INTO pet_care_schedules
         (owner_id, pet_id, care_type, scheduled_date, scheduled_time, repeat_type, series_id, recurrence_anchor_date, series_status, notes, previous_schedule_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
         ON DUPLICATE KEY UPDATE care_schedule_id=LAST_INSERT_ID(care_schedule_id)`,
          [
            schedule.owner_id,
            schedule.pet_id,
            schedule.care_type,
            nextDate,
            schedule.scheduled_time,
            schedule.repeat_type,
            schedule.series_id,
            nextDate,
            schedule.notes,
            schedule.care_schedule_id,
          ],
        );
        nextScheduleId = nextResult.insertId;
      }
      await connection.commit();
      return res.json({
        success: true,
        message: "Personal care marked done.",
        next_schedule_id: nextScheduleId,
      });
    } catch (error) {
      await connection.rollback();
      console.error("COMPLETE PET CARE SCHEDULE ERROR:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Unable to complete personal care schedule.",
        });
    } finally {
      connection.release();
    }
  },
);

module.exports = router;
