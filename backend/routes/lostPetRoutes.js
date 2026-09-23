const express = require("express");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();






router.post(
  "/:petId/missing",
  authMiddleware,
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      if (req.user.role !== "owner") {
        return res.status(403).json({
          success: false,
          message: "Only pet owners can report a pet as missing.",
        });
      }

      const petId = Number(req.params.petId);

      const {
        currentCondition,
        ownerMessage,
        lastSeenLatitude,
        lastSeenLongitude,
      } = req.body;


      


      if (!petId || Number.isNaN(petId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }

      if (
        currentCondition !== "Safe" &&
        currentCondition !== "Not Safe"
      ) {
        return res.status(400).json({
          success: false,
          message: "Please select Safe or Not Safe.",
        });
      }

      if (
        !ownerMessage ||
        !ownerMessage.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter a message for the finder.",
        });
      }

      await connection.beginTransaction();


      


      const [pets] = await connection.query(
        `
        SELECT
          pet_id,
          owner_id,
          pet_name,
          pet_status
        FROM pets
        WHERE pet_id = ?
        AND owner_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          petId,
          req.user.userId,
        ]
      );

      if (pets.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "Pet not found or you do not own this pet.",
        });
      }

      const pet = pets[0];

      

      const [activeCases] = await connection.query(
        `
        SELECT lost_report_id
        FROM lost_pet_reports
        WHERE pet_id = ?
        AND case_status = 'Active'
        LIMIT 1
        `,
        [petId]
      );

      if (activeCases.length > 0) {
        await connection.rollback();

        return res.status(409).json({
          success: false,
          message: `${pet.pet_name} already has an active missing-pet report.`,
        });
      }


      const latitude =
        lastSeenLatitude === null ||
        lastSeenLatitude === undefined ||
        lastSeenLatitude === ""
          ? null
          : Number(lastSeenLatitude);

      const longitude =
        lastSeenLongitude === null ||
        lastSeenLongitude === undefined ||
        lastSeenLongitude === ""
          ? null
          : Number(lastSeenLongitude);

      if (
        latitude !== null &&
        (
          Number.isNaN(latitude) ||
          latitude < -90 ||
          latitude > 90
        )
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: "Invalid latitude.",
        });
      }

      if (
        longitude !== null &&
        (
          Number.isNaN(longitude) ||
          longitude < -180 ||
          longitude > 180
        )
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: "Invalid longitude.",
        });
      }


      const [insertResult] = await connection.query(
        `
        INSERT INTO lost_pet_reports (
          pet_id,
          owner_id,
          current_condition,
          owner_message,
          last_seen_latitude,
          last_seen_longitude,
          missing_since,
          case_status
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW(), 'Active')
        `,
        [
          petId,
          req.user.userId,
          currentCondition,
          ownerMessage.trim(),
          latitude,
          longitude,
        ]
      );


      await connection.query(
        `
        UPDATE pets
        SET pet_status = 'Missing'
        WHERE pet_id = ?
        AND owner_id = ?
        `,
        [
          petId,
          req.user.userId,
        ]
      );

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: `${pet.pet_name} has been reported as missing.`,
        lostReport: {
          lostReportId: insertResult.insertId,
          petId,
          petName: pet.pet_name,
          petStatus: "Missing",
          currentCondition,
          ownerMessage: ownerMessage.trim(),
          lastSeenLatitude: latitude,
          lastSeenLongitude: longitude,
        },
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "LOST PET ROLLBACK ERROR:",
          rollbackError
        );
      }

      console.error(
        "REPORT MISSING PET ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to report the pet as missing.",
      });
    } finally {
      connection.release();
    }
  }
);




router.get(
  "/:petId",
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== "owner") {
        return res.status(403).json({
          success: false,
          message: "Only pet owners can view these lost-pet details.",
        });
      }

      const petId = Number(req.params.petId);

      if (!petId || Number.isNaN(petId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }




      const [reports] = await db.query(
        `
        SELECT
          l.lost_report_id,
          l.pet_id,
          l.owner_id,
          l.current_condition,
          l.owner_message,
          l.last_seen_latitude,
          l.last_seen_longitude,
          l.missing_since,
          l.recovered_at,
          l.case_status,

          p.pet_name,
          p.species,
          p.breed,
          p.sex,
          p.photo_url,
          p.qr_code,
          p.pet_status

        FROM lost_pet_reports l

        INNER JOIN pets p
          ON p.pet_id = l.pet_id

        WHERE l.pet_id = ?
        AND l.owner_id = ?
        AND l.case_status = 'Active'

        ORDER BY l.lost_report_id DESC
        LIMIT 1
        `,
        [
          petId,
          req.user.userId,
        ]
      );

      if (reports.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No active lost-pet report was found.",
        });
      }

      const report = reports[0];


      const [scans] = await db.query(
        `
        SELECT
          scan_id,
          latitude,
          longitude,
          location_shared,
          scanned_at

        FROM qr_scan_history

        WHERE pet_id = ?
        AND lost_report_id = ?

        ORDER BY scanned_at DESC
        LIMIT 20
        `,
        [
          petId,
          report.lost_report_id,
        ]
      );

      return res.json({
        success: true,

        lostReport: {
          lostReportId:
            report.lost_report_id,

          petId:
            report.pet_id,

          petName:
            report.pet_name,

          species:
            report.species,

          breed:
            report.breed,

          sex:
            report.sex,

          photoUrl:
            report.photo_url,

          qrCode:
            report.qr_code,

          petStatus:
            report.pet_status,

          currentCondition:
            report.current_condition,

          ownerMessage:
            report.owner_message,

          lastSeenLatitude:
            report.last_seen_latitude,

          lastSeenLongitude:
            report.last_seen_longitude,

          missingSince:
            report.missing_since,

          caseStatus:
            report.case_status,
        },

        scans: scans.map((scan) => ({
          scanId:
            scan.scan_id,

          latitude:
            scan.latitude,

          longitude:
            scan.longitude,

          locationShared:
            Boolean(scan.location_shared),

          scannedAt:
            scan.scanned_at,
        })),
      });
    } catch (error) {
      console.error(
        "GET LOST PET DETAILS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load lost-pet details.",
      });
    }
  }
);



router.patch(
  "/:petId/recovered",
  authMiddleware,
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      if (req.user.role !== "owner") {
        return res.status(403).json({
          success: false,
          message: "Only pet owners can mark a pet as recovered.",
        });
      }

      const petId = Number(req.params.petId);

      if (!petId || Number.isNaN(petId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pet ID.",
        });
      }

      await connection.beginTransaction();

      const [pets] = await connection.query(
        `
        SELECT
          pet_id,
          pet_name
        FROM pets
        WHERE pet_id = ?
        AND owner_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          petId,
          req.user.userId,
        ]
      );

      if (pets.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "Pet not found or you do not own this pet.",
        });
      }

      const pet = pets[0];


      const [reports] = await connection.query(
        `
        SELECT lost_report_id
        FROM lost_pet_reports
        WHERE pet_id = ?
        AND owner_id = ?
        AND case_status = 'Active'
        ORDER BY lost_report_id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [
          petId,
          req.user.userId,
        ]
      );

      if (reports.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "No active lost-pet report was found.",
        });
      }


      await connection.query(
        `
        UPDATE lost_pet_reports
        SET
          case_status = 'Recovered',
          recovered_at = NOW()
        WHERE lost_report_id = ?
        `,
        [
          reports[0].lost_report_id,
        ]
      );


      await connection.query(
        `
        UPDATE pets
        SET pet_status = 'Safe'
        WHERE pet_id = ?
        AND owner_id = ?
        `,
        [
          petId,
          req.user.userId,
        ]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: `${pet.pet_name} has been marked as safely recovered.`,
        pet: {
          petId,
          petName: pet.pet_name,
          petStatus: "Safe",
        },
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "RECOVERY ROLLBACK ERROR:",
          rollbackError
        );
      }

      console.error(
        "RECOVER LOST PET ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to mark the pet as recovered.",
      });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;
