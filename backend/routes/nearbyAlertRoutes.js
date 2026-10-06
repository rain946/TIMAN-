const express = require("express");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getNearbyAlertEnrollmentStatus,
  parseCoordinatePair,
} = require("../services/nearbyLostPetAlertService");

const router = express.Router();
router.use(authMiddleware);

router.get("/preferences", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT nearby_alerts_enabled, alert_latitude, alert_longitude,
              location_updated_at
       FROM nearby_alert_preferences WHERE user_id = ? LIMIT 1`,
      [req.user.userId]
    );
    const preference = rows[0];
    const enrollment = getNearbyAlertEnrollmentStatus(preference);
    return res.json({
      success: true,
      preference: {
        nearbyAlertsEnabled: enrollment.nearbyAlertsEnabled,
        hasLocation: enrollment.hasLocation,
        locationUpdatedAt: preference?.location_updated_at || null,
        locationFresh: enrollment.locationFresh,
        enrollmentNeeded: enrollment.enrollmentNeeded,
        enrollmentReason: enrollment.enrollmentReason,
      },
    });
  } catch (error) {
    console.error("GET NEARBY ALERT PREFERENCE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load nearby-alert settings." });
  }
});

router.put("/preferences", async (req, res) => {
  try {
    const { nearbyAlertsEnabled, alertLatitude, alertLongitude, clearLocation } = req.body || {};
    if (typeof nearbyAlertsEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: "nearbyAlertsEnabled must be true or false." });
    }
    if (clearLocation !== undefined && typeof clearLocation !== "boolean") {
      return res.status(400).json({ success: false, message: "clearLocation must be true or false." });
    }

    const coordinates = parseCoordinatePair(alertLatitude, alertLongitude);
    if (!coordinates.valid) {
      return res.status(400).json({
        success: false,
        message:
          coordinates.reason === "partial_coordinates"
            ? "Latitude and longitude must be supplied together."
            : "Invalid latitude or longitude.",
      });
    }

    const suppliedLocation = !coordinates.empty;
    await db.query(
      `INSERT INTO nearby_alert_preferences (
         user_id, nearby_alerts_enabled, alert_latitude, alert_longitude, location_updated_at
       ) VALUES (?, ?, ?, ?, CASE WHEN ? THEN NOW() ELSE NULL END)
       ON DUPLICATE KEY UPDATE
         nearby_alerts_enabled = VALUES(nearby_alerts_enabled),
         alert_latitude = CASE
           WHEN ? THEN NULL WHEN ? THEN VALUES(alert_latitude) ELSE alert_latitude END,
         alert_longitude = CASE
           WHEN ? THEN NULL WHEN ? THEN VALUES(alert_longitude) ELSE alert_longitude END,
         location_updated_at = CASE
           WHEN ? THEN NULL WHEN ? THEN NOW() ELSE location_updated_at END`,
      [
        req.user.userId,
        nearbyAlertsEnabled,
        suppliedLocation ? coordinates.latitude : null,
        suppliedLocation ? coordinates.longitude : null,
        suppliedLocation,
        Boolean(clearLocation),
        suppliedLocation,
        Boolean(clearLocation),
        suppliedLocation,
        Boolean(clearLocation),
        suppliedLocation,
      ]
    );

    const [rows] = await db.query(
      `SELECT nearby_alerts_enabled, alert_latitude, alert_longitude, location_updated_at
       FROM nearby_alert_preferences WHERE user_id = ? LIMIT 1`,
      [req.user.userId]
    );
    const preference = rows[0];
    return res.json({
      success: true,
      message: "Nearby lost-pet alert settings updated.",
      preference: {
        nearbyAlertsEnabled: Boolean(preference.nearby_alerts_enabled),
        hasLocation: preference.alert_latitude !== null && preference.alert_longitude !== null,
        locationUpdatedAt: preference.location_updated_at,
      },
    });
  } catch (error) {
    console.error("UPDATE NEARBY ALERT PREFERENCE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update nearby-alert settings." });
  }
});

router.get("/pets/:petId", async (req, res) => {
  try {
    const petId = Number(req.params.petId);
    if (!Number.isInteger(petId) || petId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid pet ID." });
    }
    const [rows] = await db.query(
      `SELECT p.pet_id, p.pet_name, p.species, p.breed, p.color,
              p.identifying_marks, p.photo_url, p.pet_status,
              l.lost_report_id, l.missing_since
       FROM pets p
       INNER JOIN lost_pet_reports l ON l.pet_id = p.pet_id
       WHERE p.pet_id = ? AND p.pet_status = 'Missing' AND l.case_status = 'Active'
       ORDER BY l.lost_report_id DESC LIMIT 1`,
      [petId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "This pet is no longer listed as missing." });
    }
    const pet = rows[0];
    return res.json({
      success: true,
      pet: {
        petId: pet.pet_id,
        petName: pet.pet_name,
        species: pet.species,
        breed: pet.breed,
        color: pet.color,
        identifyingMarks: pet.identifying_marks,
        photoUrl: pet.photo_url,
        petStatus: pet.pet_status,
        lostReportId: pet.lost_report_id,
        missingSince: pet.missing_since,
      },
    });
  } catch (error) {
    console.error("GET NEARBY LOST PET DETAIL ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load missing-pet details." });
  }
});

module.exports = router;
