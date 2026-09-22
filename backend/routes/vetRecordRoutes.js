const express = require("express");
const db = require("../config/db");
const authMiddleware = require(
  "../middleware/authMiddleware"
);
const {
  sendExpoPushNotification,
} = require("../services/pushService");

const router = express.Router();

// =====================================================
// HELPER: REQUIRE ROLE
// =====================================================

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

// =====================================================
// HELPER: CHECK CLINIC AUTHORIZATION
// =====================================================

const checkClinicAuthorization = async (
  petId,
  clinicUserId
) => {
  const [rows] = await db.query(
    `
    SELECT
      authorization_id,
      status
    FROM clinic_authorizations
    WHERE pet_id = ?
      AND clinic_user_id = ?
    LIMIT 1
    `,
    [petId, clinicUserId]
  );

  if (rows.length === 0) {
    return false;
  }

  return rows[0].status === "Approved";
};

// =====================================================
// CLINIC: ADD VETERINARY RECORD
//
// POST /api/vet-records/:petId
// =====================================================

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
      } = req.body;

      // ===============================================
      // VALIDATE PET ID
      // ===============================================

      if (
        !Number.isInteger(petId) ||
        petId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }

      // ===============================================
      // REQUIRED FIELDS
      // ===============================================

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

      // ===============================================
      // VALID SERVICE TYPE
      // ===============================================

      const allowedServices = [
        "Checkup",
        "Vaccination",
        "Deworming",
        "Treatment",
        "Surgery",
        "Other",
      ];

      if (
        !allowedServices.includes(
          service_type
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid service type.",
        });
      }

      // ===============================================
      // CHECK PET + GET OWNER
      // ===============================================

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

      // ===============================================
      // CHECK CLINIC AUTHORIZATION
      // ===============================================

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

      // ===============================================
      // GET CLINIC INFORMATION
      // ===============================================

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

      // ===============================================
      // INSERT VETERINARY RECORD
      //
      // schedule_status automatically becomes Pending
      // because of the MySQL default.
      // ===============================================

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
            next_due_date
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            petId,
            clinicUserId,
            visit_date,
            service_type,
            diagnosis?.trim() || null,
            treatment?.trim() || null,
            medication?.trim() || null,
            notes?.trim() || null,
            next_due_date || null,
          ]
        );

      const recordId =
        result.insertId;

      // ===============================================
      // BUILD OWNER NOTIFICATION
      // ===============================================

      const notificationType =
        "vet_record_added";

      const notificationTitle =
        "New Veterinary Record";

      let notificationMessage =
        `${pet.pet_name}'s ${service_type} record ` +
        `was updated by ${clinicDisplayName}.`;

      if (next_due_date) {
        notificationMessage +=
          ` A next health schedule was also set.`;
      }

      // ===============================================
      // SAVE TO TIMAN NOTIFICATION INBOX
      // ===============================================

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
        // Do not undo the veterinary record if
        // inbox notification storage fails.
        console.error(
          "VET RECORD INBOX NOTIFICATION ERROR:",
          notificationDbError
        );
      }

      // ===============================================
      // GET OWNER'S ACTIVE PUSH TOKENS
      // ===============================================

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

        // =============================================
        // SEND IMMEDIATE PUSH TO OWNER
        // =============================================

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
                    service_type,

                  nextDueDate:
                    next_due_date || null,
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
        // Veterinary record is already saved,
        // so push failure must not make the request fail.
        console.error(
          "GET OWNER PUSH TOKEN ERROR:",
          pushTokenError
        );
      }

      // ===============================================
      // SUCCESS
      // ===============================================

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
// =====================================================
// CLINIC: GET AUTHORIZED PET RECORDS
//
// GET /api/vet-records/clinic/:petId
// =====================================================

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

      // ===============================================
      // VALIDATE PET ID
      // ===============================================

      if (
        !Number.isInteger(petId) ||
        petId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }

      // ===============================================
      // CHECK AUTHORIZATION
      // ===============================================

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

      // ===============================================
      // GET PET
      // ===============================================

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

      // ===============================================
      // GET VETERINARY RECORDS
      // ===============================================

      const [records] =
        await db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,
            vr.clinic_user_id,
            vr.visit_date,
            vr.service_type,
            vr.diagnosis,
            vr.treatment,
            vr.medication,
            vr.notes,
            vr.next_due_date,
            vr.schedule_status,
            vr.completed_at,
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

// =====================================================
// OWNER: GET HEALTH OVERVIEW FOR ALL OWNED PETS
//
// GET /api/vet-records/owner-health-overview
// =====================================================

router.get(
  "/owner-health-overview",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const ownerId =
        req.user.userId;

      // ===============================================
      // PHILIPPINE CURRENT DATE
      // ===============================================

      const philippineToday = `
        DATE(
          CONVERT_TZ(
            UTC_TIMESTAMP(),
            '+00:00',
            '+08:00'
          )
        )
      `;

      // ===============================================
      // GET ACTIVE HEALTH SCHEDULES
      //
      // Only Pending schedules appear on dashboard.
      // Completed / Cancelled are excluded.
      // ===============================================

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

            vr.service_type,
            vr.visit_date,
            vr.next_due_date,
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

      // ===============================================
      // CLASSIFY SCHEDULES
      //
      // Overdue:
      // before today
      //
      // Due Soon:
      // today through next 7 days
      //
      // Upcoming:
      // more than 7 days
      // ===============================================

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

// =====================================================
// OWNER: GET PET VETERINARY RECORDS
//
// GET /api/vet-records/owner/:petId
// =====================================================

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

      // ===============================================
      // VALIDATE PET ID
      // ===============================================

      if (
        !Number.isInteger(petId) ||
        petId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }

      // ===============================================
      // VERIFY OWNERSHIP
      // ===============================================

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

      // ===============================================
      // GET RECORDS
      // ===============================================

      const [records] =
        await db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,
            vr.visit_date,
            vr.service_type,
            vr.diagnosis,
            vr.treatment,
            vr.medication,
            vr.notes,
            vr.next_due_date,
            vr.schedule_status,
            vr.completed_at,
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

// =====================================================
// CLINIC: COMPLETE PET HEALTH SCHEDULE
//
// PATCH /api/vet-records/:recordId/complete
// =====================================================

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

      // ===============================================
      // VALIDATE RECORD ID
      // ===============================================

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

      // ===============================================
      // GET HEALTH SCHEDULE
      // ===============================================

      const [recordRows] =
        await db.query(
          `
          SELECT
            vr.record_id,
            vr.pet_id,
            vr.clinic_user_id,
            vr.service_type,
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

      // ===============================================
      // MUST HAVE A SCHEDULE
      // ===============================================

      if (!record.next_due_date) {
        return res.status(400).json({
          success: false,
          message:
            "This veterinary record does not have a health schedule.",
        });
      }

      // ===============================================
      // CHECK CURRENT STATUS
      // ===============================================

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

      // ===============================================
      // CHECK CLINIC AUTHORIZATION
      // ===============================================

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

      // ===============================================
      // MARK AS COMPLETED
      //
      // completed_at uses Philippine time.
      // ===============================================

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
            AND schedule_status =
                'Pending'
          `,
          [recordId]
        );

      // Protect against duplicate requests.
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
