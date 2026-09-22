const express = require("express");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const {
  sendExpoPushNotification,
} = require("../services/pushService");

const router = express.Router();

// =====================================================
// HELPER: CHECK USER ROLE
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
// HELPER: SEND PUSH TO USER
// =====================================================

const sendPushToUser = async ({
  userId,
  title,
  body,
  data = {},
}) => {
  try {
    const [tokenRows] = await db.query(
      `
      SELECT expo_push_token
      FROM push_tokens
      WHERE user_id = ?
        AND is_active = TRUE
      `,
      [userId]
    );

    console.log(
      `TIMAN: Active push tokens for user ${userId}:`,
      tokenRows.length
    );

    for (const tokenRow of tokenRows) {
      try {
        const result =
          await sendExpoPushNotification({
            to: tokenRow.expo_push_token,
            title,
            body,
            data,
          });

        console.log(
          "TIMAN PUSH RESULT:",
          result
        );
      } catch (error) {
        console.error(
          "TIMAN PUSH TOKEN ERROR:",
          error
        );
      }
    }

    return tokenRows.length;
  } catch (error) {
    console.error(
      "SEND PUSH TO USER ERROR:",
      error
    );

    return 0;
  }
};

// =====================================================
// CLINIC: REQUEST ACCESS
//
// POST /api/authorizations/request/:petId
// =====================================================

router.post(
  "/request/:petId",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const petId =
        Number(req.params.petId);

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

      // ---------------------------------------------
      // GET PET
      // ---------------------------------------------

      const [petRows] = await db.query(
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

      // ---------------------------------------------
      // GET CLINIC INFORMATION
      // ---------------------------------------------

      const [clinicRows] = await db.query(
        `
        SELECT
          user_id,
          full_name,
          clinic_name
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
          message:
            "Clinic account not found.",
        });
      }

      const clinic =
        clinicRows[0];

      const clinicDisplayName =
        clinic.clinic_name ||
        clinic.full_name ||
        "A veterinary clinic";

      // ---------------------------------------------
      // CHECK EXISTING AUTHORIZATION
      // ---------------------------------------------

      const [authorizationRows] =
        await db.query(
          `
          SELECT
            authorization_id,
            status
          FROM clinic_authorizations
          WHERE pet_id = ?
            AND clinic_user_id = ?
          LIMIT 1
          `,
          [
            petId,
            clinicUserId,
          ]
        );

      let authorizationId;
      let responseStatus = 201;

      if (
        authorizationRows.length > 0
      ) {
        const authorization =
          authorizationRows[0];

        if (
          authorization.status ===
          "Approved"
        ) {
          return res.status(409).json({
            success: false,
            status: "Approved",
            message:
              "Your clinic is already authorized to access this pet.",
          });
        }

        if (
          authorization.status ===
          "Pending"
        ) {
          return res.status(409).json({
            success: false,
            status: "Pending",
            message:
              "An authorization request is already waiting for the owner.",
          });
        }

        await db.query(
          `
          UPDATE clinic_authorizations
          SET
            status = 'Pending',
            requested_at =
              CURRENT_TIMESTAMP,
            responded_at = NULL
          WHERE authorization_id = ?
          `,
          [
            authorization
              .authorization_id,
          ]
        );

        authorizationId =
          authorization.authorization_id;

        responseStatus = 200;
      } else {
        const [insertResult] =
          await db.query(
            `
            INSERT INTO clinic_authorizations (
              pet_id,
              clinic_user_id,
              status
            )
            VALUES (?, ?, 'Pending')
            `,
            [
              petId,
              clinicUserId,
            ]
          );

        authorizationId =
          insertResult.insertId;
      }

      // ---------------------------------------------
      // SAVE OWNER NOTIFICATION
      // ---------------------------------------------

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
        VALUES (?, ?, ?, ?, ?, ?, FALSE)
        `,
        [
          pet.owner_id,
          "clinic_access_request",
          "Clinic Access Request",
          `${clinicDisplayName} requested access to ${pet.pet_name}.`,
          pet.pet_id,
          authorizationId,
        ]
      );

      // ---------------------------------------------
      // SEND POPUP PUSH TO OWNER
      // ---------------------------------------------

      await sendPushToUser({
        userId: pet.owner_id,

        title:
          "Clinic Access Request",

        body:
          `${clinicDisplayName} requested access to ${pet.pet_name}.`,

        data: {
          type:
            "clinic_access_request",

          authorizationId,

          petId:
            pet.pet_id,

          clinicUserId,
        },
      });

      // ---------------------------------------------
      // NOTIFY PET OWNER
      // ---------------------------------------------

      await sendPushToUser({
        userId: pet.owner_id,

        title:
          "Clinic Access Request",

        body:
          `${clinicDisplayName} requested access to ${pet.pet_name}.`,

        data: {
          type:
            "clinic_access_request",

          authorizationId,

          petId:
            pet.pet_id,

          clinicUserId,
        },
      });

      return res
        .status(responseStatus)
        .json({
          success: true,
          status: "Pending",
          authorizationId,
          message:
            "Access request sent to the pet owner.",
        });
    } catch (error) {
      console.error(
        "REQUEST AUTHORIZATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to request clinic authorization.",
      });
    }
  }
);

// =====================================================
// CLINIC: SCAN PET QR
//
// GET /api/authorizations/scan/:qrCode
// =====================================================

router.get(
  "/scan/:qrCode",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const qrCode = String(
        req.params.qrCode || ""
      ).trim();

      const clinicUserId =
        req.user.userId;

      if (!qrCode) {
        return res.status(400).json({
          success: false,
          message: "QR code is required.",
        });
      }

      // ---------------------------------------------
      // FIND PET
      // ---------------------------------------------

      const [petRows] = await db.query(
        `
        SELECT
          p.pet_id,
          p.owner_id,
          p.pet_name,
          p.species,
          p.breed,
          p.sex,
          p.birth_date,
          p.color,
          p.identifying_marks,
          p.photo_url,
          p.qr_code,
          p.pet_status,

          u.full_name AS owner_name,
          u.contact_number AS owner_contact

        FROM pets p

        INNER JOIN users u
          ON p.owner_id = u.user_id

        WHERE p.qr_code = ?

        LIMIT 1
        `,
        [qrCode]
      );

      if (petRows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No pet was found for this QR code.",
        });
      }

      const pet = petRows[0];

      // ---------------------------------------------
      // CHECK CLINIC AUTHORIZATION
      // ---------------------------------------------

      const [authorizationRows] =
        await db.query(
          `
          SELECT
            authorization_id,
            status,
            requested_at,
            responded_at

          FROM clinic_authorizations

          WHERE pet_id = ?
            AND clinic_user_id = ?

          LIMIT 1
          `,
          [
            pet.pet_id,
            clinicUserId,
          ]
        );

      const authorization =
        authorizationRows.length > 0
          ? authorizationRows[0]
          : null;

      const status =
        authorization
          ? authorization.status
          : "None";

      return res.json({
        success: true,

        authorized:
          status === "Approved",

        status,

        authorization,

        pet: {
          pet_id:
            pet.pet_id,

          owner_id:
            pet.owner_id,

          pet_name:
            pet.pet_name,

          species:
            pet.species,

          breed:
            pet.breed,

          sex:
            pet.sex,

          birth_date:
            pet.birth_date,

          color:
            pet.color,

          identifying_marks:
            pet.identifying_marks,

          photo_url:
            pet.photo_url,

          pet_status:
            pet.pet_status,

          owner_name:
            pet.owner_name,

          owner_contact:
            pet.owner_contact,
        },
      });
    } catch (error) {
      console.error(
        "SCAN PET QR ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to scan pet QR code.",
      });
    }
  }
);

// =====================================================
// CLINIC: CHECK PET AUTHORIZATION
//
// GET /api/authorizations/check/:petId
// =====================================================

router.get(
  "/check/:petId",
  authMiddleware,
  requireRole("clinic"),
  async (req, res) => {
    try {
      const petId =
        Number(req.params.petId);

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

      const [petRows] = await db.query(
        `
        SELECT
          pet_id,
          pet_name,
          species,
          breed,
          sex,
          color,
          identifying_marks,
          photo_url,
          pet_status

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

      const [rows] = await db.query(
        `
        SELECT
          authorization_id,
          status,
          requested_at,
          responded_at

        FROM clinic_authorizations

        WHERE pet_id = ?
          AND clinic_user_id = ?

        LIMIT 1
        `,
        [
          petId,
          clinicUserId,
        ]
      );

      if (rows.length === 0) {
        return res.json({
          success: true,
          authorized: false,
          status: "None",
          authorization: null,
          pet: petRows[0],
        });
      }

      const authorization =
        rows[0];

      return res.json({
        success: true,

        authorized:
          authorization.status ===
          "Approved",

        status:
          authorization.status,

        authorization,

        pet: petRows[0],
      });
    } catch (error) {
      console.error(
        "CHECK AUTHORIZATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to check clinic authorization.",
      });
    }
  }
);

// =====================================================
// OWNER: VIEW AUTHORIZATION REQUESTS
//
// GET /api/authorizations/owner
// =====================================================

router.get(
  "/owner",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const ownerId =
        req.user.userId;

      const [rows] = await db.query(
        `
        SELECT
          ca.authorization_id,
          ca.pet_id,
          ca.clinic_user_id,
          ca.status,
          ca.requested_at,
          ca.responded_at,

          p.pet_name,
          p.species,
          p.breed,
          p.photo_url,

          u.full_name AS clinic_contact_name,
          u.clinic_name

        FROM clinic_authorizations ca

        INNER JOIN pets p
          ON ca.pet_id = p.pet_id

        INNER JOIN users u
          ON ca.clinic_user_id = u.user_id

        WHERE p.owner_id = ?

        ORDER BY
          CASE
            WHEN ca.status = 'Pending'
              THEN 0
            ELSE 1
          END,
          ca.requested_at DESC
        `,
        [ownerId]
      );

      return res.json({
        success: true,
        authorizations: rows,
      });
    } catch (error) {
      console.error(
        "OWNER AUTHORIZATION LIST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load clinic authorization requests.",
      });
    }
  }
);

// =====================================================
// OWNER: APPROVE REQUEST
//
// PATCH /api/authorizations/:authorizationId/approve
// =====================================================

router.patch(
  "/:authorizationId/approve",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const authorizationId =
        Number(
          req.params.authorizationId
        );

      const ownerId =
        req.user.userId;

      if (
        !Number.isInteger(
          authorizationId
        ) ||
        authorizationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid authorization ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          ca.authorization_id,
          ca.status,
          ca.clinic_user_id,

          p.pet_id,
          p.pet_name,
          p.owner_id

        FROM clinic_authorizations ca

        INNER JOIN pets p
          ON ca.pet_id = p.pet_id

        WHERE ca.authorization_id = ?
          AND p.owner_id = ?

        LIMIT 1
        `,
        [
          authorizationId,
          ownerId,
        ]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Authorization request not found.",
        });
      }

      const authorization =
        rows[0];

      if (
        authorization.status ===
        "Approved"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This clinic is already approved.",
        });
      }

      if (
        authorization.status !==
        "Pending"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only pending requests can be approved.",
        });
      }

      await db.query(
        `
        UPDATE clinic_authorizations
        SET
          status = 'Approved',
          responded_at =
            CURRENT_TIMESTAMP
        WHERE authorization_id = ?
        `,
        [authorizationId]
      );

      // Notify clinic.
      await sendPushToUser({
        userId:
          authorization.clinic_user_id,

        title:
          "Access Request Approved",

        body:
          `Your clinic can now access ${authorization.pet_name}.`,

        data: {
          type:
            "clinic_access_approved",

          authorizationId,

          petId:
            authorization.pet_id,
        },
      });

      return res.json({
        success: true,
        status: "Approved",
        message:
          "Clinic access has been approved.",
      });
    } catch (error) {
      console.error(
        "APPROVE AUTHORIZATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to approve clinic access.",
      });
    }
  }
);

// =====================================================
// OWNER: DECLINE REQUEST
//
// PATCH /api/authorizations/:authorizationId/decline
// =====================================================

router.patch(
  "/:authorizationId/decline",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const authorizationId =
        Number(
          req.params.authorizationId
        );

      const ownerId =
        req.user.userId;

      if (
        !Number.isInteger(
          authorizationId
        ) ||
        authorizationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid authorization ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          ca.authorization_id,
          ca.status,
          ca.clinic_user_id,

          p.pet_id,
          p.pet_name

        FROM clinic_authorizations ca

        INNER JOIN pets p
          ON ca.pet_id = p.pet_id

        WHERE ca.authorization_id = ?
          AND p.owner_id = ?

        LIMIT 1
        `,
        [
          authorizationId,
          ownerId,
        ]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Authorization request not found.",
        });
      }

      const authorization =
        rows[0];

      if (
        authorization.status !==
        "Pending"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only pending requests can be declined.",
        });
      }

      await db.query(
        `
        UPDATE clinic_authorizations
        SET
          status = 'Declined',
          responded_at =
            CURRENT_TIMESTAMP
        WHERE authorization_id = ?
        `,
        [authorizationId]
      );

      // Notify clinic.
      await sendPushToUser({
        userId:
          authorization.clinic_user_id,

        title:
          "Access Request Declined",

        body:
          `Your access request for ${authorization.pet_name} was declined.`,

        data: {
          type:
            "clinic_access_declined",

          authorizationId,

          petId:
            authorization.pet_id,
        },
      });

      return res.json({
        success: true,
        status: "Declined",
        message:
          "Clinic access request declined.",
      });
    } catch (error) {
      console.error(
        "DECLINE AUTHORIZATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to decline clinic access.",
      });
    }
  }
);

// =====================================================
// OWNER: REVOKE APPROVED ACCESS
//
// PATCH /api/authorizations/:authorizationId/revoke
// =====================================================

router.patch(
  "/:authorizationId/revoke",
  authMiddleware,
  requireRole("owner"),
  async (req, res) => {
    try {
      const authorizationId =
        Number(
          req.params.authorizationId
        );

      const ownerId =
        req.user.userId;

      if (
        !Number.isInteger(
          authorizationId
        ) ||
        authorizationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid authorization ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          ca.authorization_id,
          ca.status,
          ca.clinic_user_id,

          p.pet_id,
          p.pet_name

        FROM clinic_authorizations ca

        INNER JOIN pets p
          ON ca.pet_id = p.pet_id

        WHERE ca.authorization_id = ?
          AND p.owner_id = ?

        LIMIT 1
        `,
        [
          authorizationId,
          ownerId,
        ]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Authorization record not found.",
        });
      }

      const authorization =
        rows[0];

      if (
        authorization.status !==
        "Approved"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only approved clinic access can be revoked.",
        });
      }

      await db.query(
        `
        UPDATE clinic_authorizations
        SET
          status = 'Revoked',
          responded_at =
            CURRENT_TIMESTAMP
        WHERE authorization_id = ?
        `,
        [authorizationId]
      );

      // Notify clinic.
      await sendPushToUser({
        userId:
          authorization.clinic_user_id,

        title:
          "Clinic Access Revoked",

        body:
          `Your access to ${authorization.pet_name} has been revoked by the owner.`,

        data: {
          type:
            "clinic_access_revoked",

          authorizationId,

          petId:
            authorization.pet_id,
        },
      });

      return res.json({
        success: true,
        status: "Revoked",
        message:
          "Clinic access has been revoked.",
      });
    } catch (error) {
      console.error(
        "REVOKE AUTHORIZATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to revoke clinic access.",
      });
    }
  }
);

module.exports = router;
