const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const authMiddleware = require(
  "../middleware/authMiddleware"
);
const {
  sendExpoPushNotification,
} = require("../services/pushService");

const router = express.Router();

const hasValidClinicScan = (req, petId) => {
  const scanToken = req.headers["x-timan-scan-token"];

  if (typeof scanToken !== "string" || !scanToken) {
    return false;
  }

  try {
    const payload = jwt.verify(
      scanToken,
      process.env.JWT_SECRET || "timan_development_secret"
    );

    return (
      payload.type === "clinic_pet_scan" &&
      Number(payload.clinicUserId) === Number(req.user.userId) &&
      Number(payload.petId) === Number(petId)
    );
  } catch {
    return false;
  }
};





const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to perform this action.",
      });
    }

    next();
  };
};





const checkClinicAuthorization = async (
  petId,
  clinicUserId
) => {
  const [rows] = await db.query(
    `
    SELECT
      authorization_id,
      status
    FROM clinic_authorizations ca
    INNER JOIN pets p ON p.pet_id = ca.pet_id
    WHERE ca.pet_id = ?
      AND ca.clinic_user_id = ?
      AND p.archived_at IS NULL
    LIMIT 1
    `,
    [petId, clinicUserId]
  );

  if (rows.length === 0) {
    return false;
  }

  return rows[0].status === "Approved";
};

const parseDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const getPhilippineToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const notifyClinicOfOwnerScheduleChange = async ({
  clinicUserId,
  petId,
  petName,
  serviceType,
  action,
  nextDueDate,
}) => {
  const rescheduled = action === "rescheduled";
  const title = rescheduled ? "Treatment Rescheduled" : "Treatment Cancelled";
  const message = rescheduled
    ? `${petName}'s ${serviceType} treatment was rescheduled to ${nextDueDate}.`
    : `${petName}'s ${serviceType} treatment was cancelled by the owner.`;

  try {
    await db.query(
      `
      INSERT INTO notifications (
        user_id, type, title, message, pet_id, authorization_id, is_read
      )
      VALUES (?, ?, ?, ?, ?, NULL, FALSE)
      `,
      [clinicUserId, `schedule_${action}`, title, message, petId]
    );
  } catch (error) {
    console.error("CLINIC SCHEDULE NOTIFICATION ERROR:", error);
  }

  try {
    const [pushTokens] = await db.query(
      `
      SELECT push_token_id, expo_push_token
      FROM push_tokens
      WHERE user_id = ?
        AND is_active = TRUE
      `,
      [clinicUserId]
    );

    await Promise.all(
      pushTokens.map((tokenRow) =>
        sendExpoPushNotification({
          to: tokenRow.expo_push_token,
          title,
          body: message,
          data: {
            type: `schedule_${action}`,
            petId,
            serviceType,
            nextDueDate: nextDueDate || null,
          },
          pushTokenId: tokenRow.push_token_id,
          userId: clinicUserId,
        })
      )
    );
  } catch (error) {
    console.error("CLINIC SCHEDULE PUSH ERROR:", error);
  }
};







router.post(
  "/:petId",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const petId = Number(
        req.params.petId
      );

      const clinicUserId =
        req.user.userId;

      const {
        visit_date,
        service_type,
        diagnosis,
        treatment,
        medication,
        notes,
        next_due_date,
        next_service_type,
        follow_up_plan,
      } = req.body;

      
      
      

      if (
        !Number.isInteger(petId) ||
        petId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }

      
      
      

      if (
        !visit_date ||
        !service_type
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Visit date and service type are required.",
        });
      }

      
      
      

      if (
        typeof service_type !== "string" ||
        !service_type.trim() ||
        service_type.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Service type must contain 1 to 100 characters.",
        });
      }

      if (!hasValidClinicScan(req, petId)) {
        return res.status(403).json({
          success: false,
          message: "Scan the pet's TIMAN QR code before adding a veterinary record.",
        });
      }

      const normalizedServiceType = service_type.trim();
      const normalizedNextDueDate =
        typeof next_due_date === "string" ? next_due_date.trim() : "";
      const normalizedNextServiceType =
        typeof next_service_type === "string" ? next_service_type.trim() : "";
      const normalizedFollowUpPlan =
        typeof follow_up_plan === "string" ? follow_up_plan.trim() : "";

      if (normalizedNextDueDate && !parseDateOnly(normalizedNextDueDate)) {
        return res.status(400).json({
          success: false,
          message: "Next due date must be a valid YYYY-MM-DD date.",
        });
      }

      if (normalizedNextDueDate && normalizedNextDueDate <= getPhilippineToday()) {
        return res.status(400).json({
          success: false,
          message: "Next due date must be in the future.",
        });
      }

      if (
        normalizedNextDueDate &&
        (!normalizedNextServiceType || normalizedNextServiceType.length > 100)
      ) {
        return res.status(400).json({
          success: false,
          message: "Next service type is required and must not exceed 100 characters.",
        });
      }

      
      
      

      const [petRows] =
        await db.query(
          `
          SELECT
            pet_id,
            pet_name,
            owner_id
          FROM pets
          WHERE pet_id = ?
          LIMIT 1
          `,
          [petId]
        );

      if (petRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Pet not found.",
        });
      }

      const pet = petRows[0];

      
      
      

      const authorized =
        await checkClinicAuthorization(
          petId,
          clinicUserId
        );

      if (!authorized) {
        return res.status(403).json({
          success: false,
          message:
            "Owner authorization is required before adding veterinary records.",
        });
      }

      const [clinicRows] =
        await db.query(
          `
          SELECT
            full_name,
            clinic_name
          FROM users
          WHERE user_id = ?
          LIMIT 1
          `,
          [clinicUserId]
        );

      const clinic =
        clinicRows.length > 0
          ? clinicRows[0]
          : null;

      const clinicDisplayName =
        clinic?.clinic_name ||
        clinic?.full_name ||
        "Veterinary clinic";

      
      
      
      
      
      

      const [result] =
        await db.query(
          `
          INSERT INTO vet_records (
            pet_id,
            clinic_user_id,
            visit_date,
            service_type,
            diagnosis,
            treatment,
            medication,
            notes,
            next_due_date,
            next_service_type,
            follow_up_plan
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            petId,
            clinicUserId,
            visit_date,
            normalizedServiceType,
            diagnosis?.trim() || null,
            treatment?.trim() || null,
            medication?.trim() || null,
            notes?.trim() || null,
            normalizedNextDueDate || null,
            normalizedNextDueDate ? normalizedNextServiceType : null,
            normalizedNextDueDate ? normalizedFollowUpPlan || null : null,
          ]
        );

      const recordId =
        result.insertId;

      
      
      

      const notificationType =
        "vet_record_added";

      const notificationTitle =
        "New Veterinary Record";

      let notificationMessage =
        `${pet.pet_name}'s ${normalizedServiceType} record ` +
        `was updated by ${clinicDisplayName}.`;

      if (normalizedNextDueDate) {
        notificationMessage +=
          ` A next health schedule was also set.`;
      }


      try {
        await db.query(
          `
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            pet_id,
            authorization_id,
            is_read
          )
          VALUES (?, ?, ?, ?, ?, NULL, FALSE)
          `,
          [
            pet.owner_id,
            notificationType,
            notificationTitle,
            notificationMessage,
            petId,
          ]
        );

        console.log(
          `TIMAN: Vet record inbox notification saved for owner ${pet.owner_id}.`
        );
      } catch (notificationDbError) {
        console.error(
          "VET RECORD INBOX NOTIFICATION ERROR:",
          notificationDbError
        );
      }


      try {
        const [pushTokens] =
          await db.query(
            `
            SELECT
              expo_push_token
            FROM push_tokens
            WHERE user_id = ?
              AND is_active = TRUE
            `,
            [pet.owner_id]
          );

        console.log(
          `TIMAN: ${pushTokens.length} active push token(s) found for owner ${pet.owner_id}.`
        );


        for (const tokenRow of pushTokens) {
          try {
            const pushResult =
              await sendExpoPushNotification({
                to:
                  tokenRow.expo_push_token,

                title:
                  notificationTitle,

                body:
                  notificationMessage,

                data: {
                  type:
                    notificationType,

                  petId:
                    petId,

                  recordId:
                    recordId,

                  serviceType:
                    normalizedServiceType,

                    nextDueDate: normalizedNextDueDate || null,

                  nextServiceType:
                    normalizedNextDueDate ? normalizedNextServiceType : null,
                },
              });

            if (pushResult.success) {
              console.log(
                `TIMAN: Vet record push accepted for ${pet.pet_name}.`
              );
            } else {
              console.log(
                `TIMAN: Vet record push failed for ${pet.pet_name}:`,
                pushResult.message ||
                  pushResult.error
              );
            }
          } catch (pushError) {
            console.error(
              "VET RECORD PUSH ERROR:",
              pushError
            );
          }
        }
      } catch (pushTokenError) {
        console.error(
          "GET OWNER PUSH TOKEN ERROR:",
          pushTokenError
        );
      }


      return res.status(201).json({
        success: true,
        message:
          "Veterinary record saved successfully.",
        record_id:
          recordId,
      });
    } catch (error) {
      console.error(
        "ADD VET RECORD ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to save veterinary record.",
      });
    }
  }
);

router.get(
  "/clinic",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const clinicUserId = req.user.userId;

      const [records] = await db.query(
        `
        SELECT
          vr.record_id,
          vr.pet_id,
          DATE_FORMAT(vr.visit_date, '%Y-%m-%d') AS visit_date,
          vr.service_type,
          vr.diagnosis,
          vr.created_at,
          p.pet_name,
          p.species,
          p.breed,
          p.photo_url,
          owner_user.full_name AS owner_name,
          EXISTS (
            SELECT 1
            FROM clinic_authorizations ca
            WHERE ca.pet_id = vr.pet_id
              AND ca.clinic_user_id = ?
              AND ca.status = 'Approved'
          ) AS can_open
        FROM vet_records vr
        INNER JOIN pets p
          ON p.pet_id = vr.pet_id
        INNER JOIN users owner_user
          ON owner_user.user_id = p.owner_id
        WHERE vr.clinic_user_id = ?
          AND p.archived_at IS NULL
        ORDER BY
          vr.visit_date DESC,
          vr.created_at DESC,
          vr.record_id DESC
        `,
        [clinicUserId, clinicUserId]
      );

      return res.json({
        success: true,
        records: records.map((record) => ({
          ...record,
          can_open: Boolean(record.can_open),
        })),
      });
    } catch (error) {
      console.error("GET CLINIC VET RECORDS HISTORY ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load veterinary records.",
      });
    }
  }
);

router.get(
  "/clinic-schedules",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const clinicUserId = req.user.userId;

      const [schedules] = await db.query(
        `
        SELECT
          vr.record_id,
          vr.pet_id,
          DATE_FORMAT(vr.visit_date, '%Y-%m-%d') AS visit_date,
          vr.service_type AS record_service_type,
          COALESCE(NULLIF(vr.next_service_type, ''), vr.service_type) AS service_type,
          vr.next_service_type,
          vr.follow_up_plan,
          DATE_FORMAT(vr.next_due_date, '%Y-%m-%d') AS next_due_date,
          vr.schedule_status,
          vr.completed_at,
          vr.created_at,
          DATE_FORMAT(vr.created_at, '%Y-%m-%d') AS booked_date,
          DATE_FORMAT(vr.completed_at, '%Y-%m-%d') AS completed_date,
          DATE_FORMAT(vr.cancelled_at, '%Y-%m-%d') AS cancelled_date,
          DATE_FORMAT(vr.rescheduled_at, '%Y-%m-%d') AS rescheduled_date,
          p.pet_name,
          p.species,
          p.breed,
          p.photo_url,
          owner_user.full_name AS owner_name,
          CASE
            WHEN vr.created_at >= DATE_FORMAT(
              CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
              '%Y-%m-01'
            )
            AND vr.created_at < DATE_ADD(
              DATE_FORMAT(
                CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
                '%Y-%m-01'
              ),
              INTERVAL 1 MONTH
            )
            THEN TRUE ELSE FALSE
          END AS is_added_this_month,
          CASE
            WHEN vr.schedule_status = 'Completed'
            AND vr.completed_at >= DATE_FORMAT(
              CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
              '%Y-%m-01'
            )
            AND vr.completed_at < DATE_ADD(
              DATE_FORMAT(
                CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
                '%Y-%m-01'
              ),
              INTERVAL 1 MONTH
            )
            THEN TRUE ELSE FALSE
          END AS is_completed_this_month,
          CASE
            WHEN vr.schedule_status = 'Cancelled'
            AND vr.cancelled_at >= DATE_FORMAT(
              CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
              '%Y-%m-01'
            )
            AND vr.cancelled_at < DATE_ADD(
              DATE_FORMAT(
                CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
                '%Y-%m-01'
              ),
              INTERVAL 1 MONTH
            )
            THEN TRUE ELSE FALSE
          END AS is_cancelled_this_month,
          CASE
            WHEN vr.rescheduled_at >= DATE_FORMAT(
              CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
              '%Y-%m-01'
            )
            AND vr.rescheduled_at < DATE_ADD(
              DATE_FORMAT(
                CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
                '%Y-%m-01'
              ),
              INTERVAL 1 MONTH
            )
            THEN TRUE ELSE FALSE
          END AS is_rescheduled_this_month,
          EXISTS (
            SELECT 1
            FROM clinic_authorizations ca
            WHERE ca.pet_id = vr.pet_id
              AND ca.clinic_user_id = ?
              AND ca.status = 'Approved'
          ) AS can_open
        FROM vet_records vr
        INNER JOIN pets p
          ON p.pet_id = vr.pet_id
        INNER JOIN users owner_user
          ON owner_user.user_id = p.owner_id
        WHERE vr.clinic_user_id = ?
          AND p.archived_at IS NULL
          AND vr.next_due_date IS NOT NULL
        ORDER BY
          CASE
            WHEN vr.schedule_status = 'Pending' THEN 0
            WHEN vr.schedule_status = 'Completed' THEN 1
            ELSE 2
          END,
          CASE
            WHEN vr.schedule_status = 'Pending' THEN vr.next_due_date
          END ASC,
          CASE
            WHEN vr.schedule_status <> 'Pending'
              THEN COALESCE(vr.completed_at, vr.created_at)
          END DESC,
          vr.record_id DESC
        `,
        [clinicUserId, clinicUserId]
      );

      return res.json({
        success: true,
        schedules: schedules.map((schedule) => ({
          ...schedule,
          can_open: Boolean(schedule.can_open),
          is_added_this_month: Boolean(schedule.is_added_this_month),
          is_completed_this_month: Boolean(schedule.is_completed_this_month),
          is_cancelled_this_month: Boolean(schedule.is_cancelled_this_month),
          is_rescheduled_this_month: Boolean(schedule.is_rescheduled_this_month),
        })),
      });
    } catch (error) {
      console.error("GET CLINIC SCHEDULES ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load schedules.",
      });
    }
  }
);


router.get(
  "/clinic/:petId",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const petId = Number(
        req.params.petId
      );

      const clinicUserId =
        req.user.userId;


      if (
        !Number.isInteger(petId) ||
        petId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }


      const authorized =
        await checkClinicAuthorization(
          petId,
          clinicUserId
        );

      if (!authorized) {
        return res.status(403).json({
          success: false,
          message:
            "Your clinic is not authorized to access this pet's veterinary records.",
        });
      }


      const [petRows] =
        await db.query(
          `
          SELECT
            pet_id,
            pet_name,
            species,
            breed,
            photo_url
          FROM pets
          WHERE pet_id = ?
          LIMIT 1
          `,
          [petId]
        );

      if (petRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Pet not found.",
        });
      }


      const [records] =
        await db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,
            vr.clinic_user_id,
            DATE_FORMAT(vr.visit_date, '%Y-%m-%d') AS visit_date,
            vr.service_type,
            vr.diagnosis,
            vr.treatment,
            vr.medication,
            vr.notes,
            DATE_FORMAT(vr.next_due_date, '%Y-%m-%d') AS next_due_date,
            vr.next_service_type,
            vr.follow_up_plan,
            vr.schedule_status,
            vr.completed_at,
            vr.rescheduled_at,
            vr.created_at,

            u.full_name
              AS clinic_contact_name,

            u.clinic_name

          FROM vet_records vr

          INNER JOIN users u
            ON vr.clinic_user_id =
               u.user_id

          WHERE vr.pet_id = ?

          ORDER BY
            vr.visit_date DESC,
            vr.record_id DESC
          `,
          [petId]
        );

      return res.json({
        success: true,
        pet: petRows[0],
        records,
      });
    } catch (error) {
      console.error(
        "GET CLINIC VET RECORDS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load veterinary records.",
      });
    }
  }
);


router.get(
  "/owner-health-overview",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const ownerId =
        req.user.userId;


      const philippineToday = `
        DATE(
          CONVERT_TZ(
            UTC_TIMESTAMP(),
            '+00:00',
            '+08:00'
          )
        )
      `;


      const [schedules] =
        await db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,

            p.pet_name,
            p.species,
            p.breed,
            p.photo_url,

            COALESCE(NULLIF(vr.next_service_type, ''), vr.service_type) AS service_type,
            vr.next_service_type,
            vr.follow_up_plan,
            DATE_FORMAT(vr.visit_date, '%Y-%m-%d') AS visit_date,
            DATE_FORMAT(vr.next_due_date, '%Y-%m-%d') AS next_due_date,
            vr.schedule_status,

            DATEDIFF(
              vr.next_due_date,
              ${philippineToday}
            ) AS days_until_due

          FROM vet_records vr

          INNER JOIN pets p
            ON vr.pet_id = p.pet_id

          WHERE p.owner_id = ?
            AND vr.next_due_date
                IS NOT NULL
            AND vr.schedule_status =
                'Pending'

          ORDER BY
            vr.next_due_date ASC,
            vr.record_id DESC
          `,
          [ownerId]
        );


      const overdue = [];
      const dueSoon = [];
      const upcoming = [];

      for (
        const schedule of schedules
      ) {
        const days = Number(
          schedule.days_until_due
        );

        if (days < 0) {
          overdue.push(schedule);
        } else if (days <= 7) {
          dueSoon.push(schedule);
        } else {
          upcoming.push(schedule);
        }
      }

      return res.json({
        success: true,

        summary: {
          overdue: overdue.length,
          dueSoon: dueSoon.length,
          upcoming: upcoming.length,
          total: schedules.length,
        },

        schedules: {
          overdue,
          dueSoon,
          upcoming,
        },

        allSchedules: schedules,
      });
    } catch (error) {
      console.error(
        "GET OWNER HEALTH OVERVIEW ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load health overview.",
      });
    }
  }
);


router.get(
  "/owner/:petId",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const petId = Number(
        req.params.petId
      );

      const ownerId =
        req.user.userId;


      if (
        !Number.isInteger(petId) ||
        petId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }


      const [petRows] =
        await db.query(
          `
          SELECT
            pet_id,
            pet_name,
            species,
            breed,
            photo_url
          FROM pets
          WHERE pet_id = ?
            AND owner_id = ?
          LIMIT 1
          `,
          [
            petId,
            ownerId,
          ]
        );

      if (petRows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Pet not found or you do not own this pet.",
        });
      }


      const [records] =
        await db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,
            DATE_FORMAT(vr.visit_date, '%Y-%m-%d') AS visit_date,
            vr.service_type,
            vr.diagnosis,
            vr.treatment,
            vr.medication,
            vr.notes,
            DATE_FORMAT(vr.next_due_date, '%Y-%m-%d') AS next_due_date,
            vr.next_service_type,
            vr.follow_up_plan,
            vr.schedule_status,
            vr.completed_at,
            vr.rescheduled_at,
            vr.created_at,

            u.full_name
              AS clinic_contact_name,

            u.clinic_name

          FROM vet_records vr

          INNER JOIN users u
            ON vr.clinic_user_id =
               u.user_id

          WHERE vr.pet_id = ?

          ORDER BY
            vr.visit_date DESC,
            vr.record_id DESC
          `,
          [petId]
        );

      return res.json({
        success: true,
        pet: petRows[0],
        records,
      });
    } catch (error) {
      console.error(
        "GET OWNER VET RECORDS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load veterinary records.",
      });
    }
  }
);

router.patch(
  "/:recordId/cancel",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const recordId = Number(req.params.recordId);
      const ownerId = req.user.userId;

      if (!Number.isInteger(recordId) || recordId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid veterinary record ID.",
        });
      }

      const [records] = await db.query(
        `
        SELECT
          vr.record_id,
          vr.pet_id,
          vr.clinic_user_id,
          COALESCE(NULLIF(vr.next_service_type, ''), vr.service_type) AS service_type,
          DATE_FORMAT(vr.next_due_date, '%Y-%m-%d') AS next_due_date,
          vr.schedule_status,
          vr.rescheduled_at,
          p.pet_name
        FROM vet_records vr
        INNER JOIN pets p ON p.pet_id = vr.pet_id
        WHERE vr.record_id = ?
          AND p.owner_id = ?
        LIMIT 1
        `,
        [recordId, ownerId]
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Schedule not found or you do not own this pet.",
        });
      }

      const schedule = records[0];
      if (!schedule.next_due_date) {
        return res.status(400).json({
          success: false,
          message: "This veterinary record does not have a schedule.",
        });
      }
      if (schedule.schedule_status !== "Pending") {
        return res.status(409).json({
          success: false,
          message:
            schedule.schedule_status === "Completed"
              ? "A completed schedule cannot be cancelled."
              : "This schedule has already been cancelled.",
        });
      }
      if (schedule.rescheduled_at) {
        return res.status(409).json({
          success: false,
          message: "A rescheduled schedule can no longer be cancelled.",
        });
      }

      const dueDate = parseDateOnly(schedule.next_due_date);
      const today = parseDateOnly(getPhilippineToday());
      const daysUntilDue =
        dueDate && today
          ? Math.round((dueDate.getTime() - today.getTime()) / 86400000)
          : null;

      if (daysUntilDue === null) {
        return res.status(400).json({
          success: false,
          message: "The schedule due date is invalid.",
        });
      }

      if (daysUntilDue <= 3) {
        return res.status(409).json({
          success: false,
          message:
            "Schedules due within 3 days can no longer be cancelled. Please reschedule instead.",
        });
      }

      const [result] = await db.query(
        `
        UPDATE vet_records vr
        INNER JOIN pets p ON p.pet_id = vr.pet_id
        SET
          vr.schedule_status = 'Cancelled',
          vr.completed_at = NULL,
          vr.cancelled_at = CONVERT_TZ(
            UTC_TIMESTAMP(),
            '+00:00',
            '+08:00'
          )
        WHERE vr.record_id = ?
          AND p.owner_id = ?
          AND vr.next_due_date IS NOT NULL
          AND vr.schedule_status = 'Pending'
          AND vr.rescheduled_at IS NULL
        `,
        [recordId, ownerId]
      );

      if (result.affectedRows === 0) {
        return res.status(409).json({
          success: false,
          message: "This schedule is no longer pending.",
        });
      }

      await notifyClinicOfOwnerScheduleChange({
        clinicUserId: schedule.clinic_user_id,
        petId: schedule.pet_id,
        petName: schedule.pet_name,
        serviceType: schedule.service_type,
        action: "cancelled",
      });

      return res.json({
        success: true,
        message: "Scheduled treatment cancelled.",
        schedule: {
          record_id: schedule.record_id,
          schedule_status: "Cancelled",
          next_due_date: schedule.next_due_date,
        },
      });
    } catch (error) {
      console.error("CANCEL OWNER SCHEDULE ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to cancel the schedule.",
      });
    }
  }
);

router.patch(
  "/:recordId/reschedule",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const recordId = Number(req.params.recordId);
      const ownerId = req.user.userId;
      const nextDueDate = String(req.body.next_due_date || "").trim();
      const parsedDate = parseDateOnly(nextDueDate);

      if (!Number.isInteger(recordId) || recordId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid veterinary record ID.",
        });
      }
      if (!nextDueDate) {
        return res.status(400).json({
          success: false,
          message: "A new schedule date is required.",
        });
      }
      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: "The new schedule date is invalid.",
        });
      }
      if (nextDueDate <= getPhilippineToday()) {
        return res.status(400).json({
          success: false,
          message: "The new schedule date must be in the future.",
        });
      }

      const [records] = await db.query(
        `
        SELECT
          vr.record_id,
          vr.pet_id,
          vr.clinic_user_id,
          COALESCE(NULLIF(vr.next_service_type, ''), vr.service_type) AS service_type,
          DATE_FORMAT(vr.next_due_date, '%Y-%m-%d') AS next_due_date,
          vr.schedule_status,
          vr.rescheduled_at,
          p.pet_name
        FROM vet_records vr
        INNER JOIN pets p ON p.pet_id = vr.pet_id
        WHERE vr.record_id = ?
          AND p.owner_id = ?
        LIMIT 1
        `,
        [recordId, ownerId]
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Schedule not found or you do not own this pet.",
        });
      }

      const schedule = records[0];
      if (!schedule.next_due_date) {
        return res.status(400).json({
          success: false,
          message: "This veterinary record does not have a schedule.",
        });
      }
      if (schedule.schedule_status !== "Pending") {
        return res.status(409).json({
          success: false,
          message:
            schedule.schedule_status === "Completed"
              ? "A completed schedule cannot be rescheduled."
              : "A cancelled schedule cannot be rescheduled.",
        });
      }
      if (schedule.rescheduled_at) {
        return res.status(409).json({
          success: false,
          message: "This schedule has already been rescheduled and can no longer be changed.",
        });
      }
      if (schedule.next_due_date === nextDueDate) {
        return res.status(400).json({
          success: false,
          message: "Please choose a date different from the current schedule.",
        });
      }

      const connection = await db.getConnection();
      let result;
      try {
        await connection.beginTransaction();
        [result] = await connection.query(
          `
          UPDATE vet_records vr
          INNER JOIN pets p ON p.pet_id = vr.pet_id
          SET
            vr.next_due_date = ?,
            vr.cancelled_at = NULL,
            vr.rescheduled_at = CONVERT_TZ(
              UTC_TIMESTAMP(),
              '+00:00',
              '+08:00'
            )
          WHERE vr.record_id = ?
            AND p.owner_id = ?
            AND vr.next_due_date IS NOT NULL
            AND vr.schedule_status = 'Pending'
            AND vr.rescheduled_at IS NULL
          `,
          [nextDueDate, recordId, ownerId]
        );

        if (result.affectedRows === 0) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            message: "This schedule is no longer pending.",
          });
        }

        await connection.query("DELETE FROM reminder_logs WHERE record_id = ?", [recordId]);
        await connection.commit();
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }

      await notifyClinicOfOwnerScheduleChange({
        clinicUserId: schedule.clinic_user_id,
        petId: schedule.pet_id,
        petName: schedule.pet_name,
        serviceType: schedule.service_type,
        action: "rescheduled",
        nextDueDate,
      });

      return res.json({
        success: true,
        message: "Scheduled treatment rescheduled.",
        schedule: {
          record_id: schedule.record_id,
          schedule_status: "Pending",
          next_due_date: nextDueDate,
        },
      });
    } catch (error) {
      console.error("RESCHEDULE OWNER SCHEDULE ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to reschedule the treatment.",
      });
    }
  }
);


router.patch(
  "/:recordId/complete",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const recordId = Number(
        req.params.recordId
      );

      const clinicUserId =
        req.user.userId;


      if (
        !Number.isInteger(recordId) ||
        recordId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid veterinary record ID.",
        });
      }


      const [recordRows] =
        await db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,
            vr.clinic_user_id,
            COALESCE(NULLIF(vr.next_service_type, ''), vr.service_type) AS service_type,
            vr.next_due_date,
            vr.schedule_status,
            vr.completed_at,

            p.pet_name

          FROM vet_records vr

          INNER JOIN pets p
            ON vr.pet_id = p.pet_id

          WHERE vr.record_id = ?

          LIMIT 1
          `,
          [recordId]
        );

      if (
        recordRows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Health schedule not found.",
        });
      }

      const record =
        recordRows[0];

      if (!hasValidClinicScan(req, record.pet_id)) {
        return res.status(403).json({
          success: false,
          message: "Scan the pet's TIMAN QR code before completing this veterinary schedule.",
        });
      }


      if (
        Number(record.clinic_user_id) !==
        Number(clinicUserId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "This schedule was not created by your clinic.",
        });
      }


      if (!record.next_due_date) {
        return res.status(400).json({
          success: false,
          message:
            "This veterinary record does not have a health schedule.",
        });
      }


      if (
        record.schedule_status ===
        "Completed"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This health schedule has already been completed.",
        });
      }

      if (
        record.schedule_status ===
        "Cancelled"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A cancelled schedule cannot be completed.",
        });
      }


      const authorized =
        await checkClinicAuthorization(
          record.pet_id,
          clinicUserId
        );

      if (!authorized) {
        return res.status(403).json({
          success: false,
          message:
            "Your clinic is not authorized to update this pet's health schedule.",
        });
      }


      const [updateResult] =
        await db.query(
          `
          UPDATE vet_records

          SET
            schedule_status =
              'Completed',

            completed_at =
              CONVERT_TZ(
                UTC_TIMESTAMP(),
                '+00:00',
                '+08:00'
              )

          WHERE record_id = ?
            AND clinic_user_id = ?
            AND schedule_status =
                'Pending'
          `,
          [recordId, clinicUserId]
        );

      if (
        updateResult.affectedRows === 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This schedule is no longer pending.",
        });
      }

      return res.json({
        success: true,

        message:
          `${record.pet_name}'s ${record.service_type} schedule has been completed.`,

        schedule: {
          record_id:
            record.record_id,

          pet_id:
            record.pet_id,

          pet_name:
            record.pet_name,

          service_type:
            record.service_type,

          schedule_status:
            "Completed",
        },
      });
    } catch (error) {
      console.error(
        "COMPLETE HEALTH SCHEDULE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to complete health schedule.",
      });
    }
  }
);

module.exports = router;
