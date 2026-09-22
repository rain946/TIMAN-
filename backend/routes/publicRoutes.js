const express = require("express");
const db = require("../config/db");

const {
  sendExpoPushNotification,
} = require("../services/pushService");

const router = express.Router();

// =====================================================
// HELPER: ESCAPE HTML
// =====================================================

const escapeHtml = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

// =====================================================
// API: PUBLIC PET DATA
// GET /api/public/pets/:qrCode
// =====================================================

router.get("/api/public/pets/:qrCode", async (req, res) => {
  try {
    const { qrCode } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        p.pet_id,
        p.pet_name,
        p.species,
        p.breed,
        p.sex,
        p.color,
        p.identifying_marks,
        p.photo_url,
        p.pet_status,
        p.qr_code,
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

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pet not found.",
      });
    }

    return res.json({
      success: true,
      pet: rows[0],
    });
  } catch (error) {
    console.error("PUBLIC PET ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load pet information.",
    });
  }
});

// =====================================================
// PUBLIC WEB PROFILE
// GET /public/pet/:qrCode
// =====================================================

router.get("/public/pet/:qrCode", async (req, res) => {
  try {
    const { qrCode } = req.params;

    const [rows] = await db.query(
      `
        SELECT
          p.pet_id,
          p.pet_name,
          p.species,
          p.breed,
          p.sex,
          p.color,
          p.identifying_marks,
          p.photo_url,
          p.pet_status,
          p.qr_code,

          u.full_name AS owner_name,
          u.contact_number AS owner_contact,

          lr.current_condition,
          lr.owner_message,
          lr.missing_since

        FROM pets p

        INNER JOIN users u
          ON p.owner_id = u.user_id

        LEFT JOIN lost_pet_reports lr
          ON lr.lost_report_id = (
            SELECT lr2.lost_report_id
            FROM lost_pet_reports lr2
            WHERE lr2.pet_id = p.pet_id
              AND lr2.case_status = 'Active'
            ORDER BY lr2.lost_report_id DESC
            LIMIT 1
          )

        WHERE p.qr_code = ?

        LIMIT 1
      `,
      [qrCode]
    );

    if (rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <title>TIMAN - Pet Not Found</title>

            <style>
              body {
                margin: 0;
                font-family: Arial, sans-serif;
                background: #fffdf7;
                color: #26352b;
              }

              .container {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 25px;
                box-sizing: border-box;
              }

              .card {
                width: 100%;
                max-width: 420px;
                background: white;
                border: 1px solid #e2e8e4;
                border-radius: 22px;
                padding: 30px 22px;
                text-align: center;
              }

              .logo {
                font-size: 28px;
                font-weight: 800;
                color: #176b3a;
              }

              h1 {
                font-size: 22px;
                margin-top: 25px;
              }

              p {
                color: #78857d;
                line-height: 1.6;
              }
            </style>
          </head>

          <body>
            <div class="container">
              <div class="card">
                <div class="logo">TIMAN</div>

                <h1>Pet Not Found</h1>

                <p>
                  This QR code is not connected to an
                  active pet record.
                </p>
              </div>
            </div>
          </body>
        </html>
      `);
    }

    const pet = rows[0];

    const petName = escapeHtml(pet.pet_name);
    const species = escapeHtml(pet.species);
    const breed = escapeHtml(pet.breed || "Not specified");
    const sex = escapeHtml(pet.sex);
    const color = escapeHtml(pet.color || "Not specified");

    const marks = escapeHtml(
      pet.identifying_marks || "No identifying marks recorded."
    );

    const status = escapeHtml(pet.pet_status);

    const ownerName = escapeHtml(
      pet.owner_name || "Pet Owner"
    );

    const ownerContact = escapeHtml(
      pet.owner_contact || ""
    );

    const photoUrl = pet.photo_url
      ? escapeHtml(pet.photo_url)
      : null;

    const petId =
      `PET-${String(pet.pet_id).padStart(4, "0")}`;

    const isMissing =
      pet.pet_status === "Missing";

    const currentCondition = escapeHtml(
      pet.current_condition || "Unknown"
    );

    const ownerMessage = escapeHtml(
      pet.owner_message || ""
    );

    const statusClass =
      pet.pet_status === "Missing"
        ? "missing"
        : pet.pet_status === "Found"
        ? "found"
        : "safe";

    const statusMessage = isMissing
      ? `
          <div class="missing-alert">
            <strong>Missing Pet</strong>

            <p>
              If you found ${petName}, please contact
              the owner using the information below.
            </p>

            <div class="finder-condition">
              <span>Current Condition</span>
              <strong>${currentCondition}</strong>
            </div>

            ${
              ownerMessage
                ? `
                  <div class="finder-message">
                    <span>Message from Owner</span>
                    <p>${ownerMessage}</p>
                  </div>
                `
                : ""
            }
          </div>
        `
      : "";

    const contactButton = ownerContact
      ? `
        <a
          class="contact-button"
          href="tel:${ownerContact}"
        >
          Contact Owner
        </a>
      `
      : `
        <div class="no-contact">
          Owner contact is unavailable.
        </div>
      `;

    return res.send(`
      <!DOCTYPE html>

      <html>
        <head>
          <meta charset="UTF-8" />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />

          <title>TIMAN - ${petName}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              font-family:
                Arial,
                Helvetica,
                sans-serif;

              background: #fffdf7;
              color: #26352b;
            }

            .header {
              background: #176b3a;
              color: white;
              text-align: center;
              padding: 22px 20px 55px;
            }

            .brand {
              font-size: 25px;
              font-weight: 800;
              letter-spacing: 2px;
            }

            .brand-subtitle {
              margin-top: 4px;
              font-size: 11px;
              opacity: 0.85;
            }

            .container {
              width: 100%;
              max-width: 480px;
              margin: -35px auto 0;
              padding: 0 18px 40px;
            }

            .profile-card {
              background: white;
              border-radius: 24px;
              border: 1px solid #e1e8e3;
              padding: 24px 20px;
              text-align: center;

              box-shadow:
                0 5px 18px rgba(0, 0, 0, 0.05);
            }

            .photo {
              width: 130px;
              height: 130px;
              border-radius: 65px;
              object-fit: cover;

              border: 5px solid #eef6ef;

              background: #e8f2e9;
            }

            .photo-placeholder {
              width: 130px;
              height: 130px;
              margin: auto;

              border-radius: 65px;

              background: #e8f2e9;

              display: flex;
              align-items: center;
              justify-content: center;

              font-size: 45px;
            }

            .pet-name {
              margin: 15px 0 0;
              font-size: 27px;
              font-weight: 800;
            }

            .pet-id {
              margin-top: 5px;
              color: #89958e;
              font-size: 12px;
            }

            .status {
              display: inline-block;

              margin-top: 12px;

              padding:
                7px
                15px;

              border-radius: 30px;

              font-size: 12px;
              font-weight: 700;
            }

            .safe {
              background: #e6f3e8;
              color: #267542;
            }

            .missing {
              background: #fde7e4;
              color: #b64236;
            }

            .found {
              background: #fff1cf;
              color: #8c6a16;
            }

            .finder-condition {
              margin-top: 15px;
              padding: 12px 14px;
              background: white;
              border-radius: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 15px;
            }

            .finder-condition span {
              color: #7a867f;
              font-size: 12px;
            }

            .finder-condition strong {
              color: #b64236;
              font-size: 13px;
            }

            .finder-message {
              margin-top: 10px;
              padding: 12px 14px;
              background: white;
              border-radius: 12px;
              text-align: left;
            }

            .finder-message span {
              display: block;
              color: #7a867f;
              font-size: 11px;
              margin-bottom: 5px;
            }

            .finder-message p {
              margin: 0;
              color: #26352b;
              font-size: 13px;
              line-height: 1.5;
            }

            .missing-alert {
              margin-top: 18px;
              padding: 15px;

              border-radius: 15px;

              background: #fff0ee;

              color: #9e3e34;

              text-align: left;
            }

            .missing-alert p {
              margin-bottom: 0;
              line-height: 1.5;
              font-size: 13px;
            }

            .section {
              margin-top: 18px;

              background: white;

              border: 1px solid #e1e8e3;

              border-radius: 18px;

              padding: 18px;
            }

            .section-title {
              font-size: 15px;
              font-weight: 800;

              margin-bottom: 14px;
            }

            .row {
              display: flex;

              justify-content:
                space-between;

              gap: 20px;

              padding:
                11px 0;

              border-bottom:
                1px solid #eef1ef;
            }

            .row:last-child {
              border-bottom: none;
            }

            .label {
              color: #7a867f;
              font-size: 12px;
            }

            .value {
              font-size: 12px;
              font-weight: 700;
              text-align: right;
            }

            .marks {
              margin: 0;

              color: #5f6f65;

              font-size: 13px;

              line-height: 1.6;
            }

            .owner-name {
              font-size: 16px;
              font-weight: 800;
            }

            .owner-note {
              margin-top: 5px;

              font-size: 11px;

              line-height: 1.5;

              color: #849088;
            }

            .contact-button {
              display: block;

              margin-top: 15px;

              padding: 15px;

              border-radius: 13px;

              background: #176b3a;

              color: white;

              text-align: center;

              text-decoration: none;

              font-size: 14px;
              font-weight: 700;
            }

            .no-contact {
              margin-top: 14px;

              padding: 12px;

              background: #f3f5f3;

              border-radius: 12px;

              color: #849088;

              font-size: 12px;
            }

            .privacy {
              margin-top: 18px;

              padding: 15px;

              border-radius: 15px;

              background: #eef6ef;

              color: #637269;

              font-size: 11px;

              line-height: 1.6;

              text-align: center;
            }

            .footer {
              margin-top: 24px;

              text-align: center;

              color: #9aa49e;

              font-size: 10px;
            }
          </style>
        </head>

        <body>

          <div class="header">

            <div class="brand">
              TIMAN
            </div>

            <div class="brand-subtitle">
              Pet Identification
            </div>

          </div>

          <main class="container">

            <section class="profile-card">

              ${
                photoUrl
                  ? `
                    <img
                      class="photo"
                      src="${photoUrl}"
                      alt="${petName}"
                    />
                  `
                  : `
                    <div class="photo-placeholder">
                      🐾
                    </div>
                  `
              }

              <h1 class="pet-name">
                ${petName}
              </h1>

              <div class="pet-id">
                ${petId}
              </div>

              <div
                class="status ${statusClass}"
              >
                ${status}
              </div>

              ${statusMessage}

            </section>

            <section class="section">

              <div class="section-title">
                Pet Information
              </div>

              <div class="row">

                <span class="label">
                  Species
                </span>

                <span class="value">
                  ${species}
                </span>

              </div>

              <div class="row">

                <span class="label">
                  Breed
                </span>

                <span class="value">
                  ${breed}
                </span>

              </div>

              <div class="row">

                <span class="label">
                  Sex
                </span>

                <span class="value">
                  ${sex}
                </span>

              </div>

              <div class="row">

                <span class="label">
                  Color
                </span>

                <span class="value">
                  ${color}
                </span>

              </div>

            </section>

            <section class="section">

              <div class="section-title">
                Identifying Marks
              </div>

              <p class="marks">
                ${marks}
              </p>

            </section>

            <section class="section">

              <div class="section-title">
                Pet Owner
              </div>

              <div class="owner-name">
                ${ownerName}
              </div>

              <div class="owner-note">
                Contact the owner if you found
                this pet or need to report its
                location.
              </div>

              ${contactButton}

            </section>

            <div class="privacy">
              TIMAN only displays limited
              information needed for pet
              identification and recovery.
              Private account information such
              as email and home address is not
              shown.
            </div>

            <div class="footer">
              TIMAN • QR-Based Pet Identification
            </div>

            </main>

            <script>
              (function () {
                const qrCode =
                  ${JSON.stringify(pet.qr_code)};

                const reloadKey =
                  "timan_scan_reload_" + qrCode;

                let isReloadAfterScan = false;
                let submitting = false;

                try {
                  isReloadAfterScan =
                    sessionStorage.getItem(reloadKey) === "1";

                  if (isReloadAfterScan) {
                    sessionStorage.removeItem(reloadKey);
                  }
                } catch (error) {
                  console.log(
                    "Session storage unavailable."
                  );
                }

                // Prevent automatic reload from creating
                // another QR scan.
                if (isReloadAfterScan) {
                  console.log(
                    "TIMAN automatic reload. Duplicate prevented."
                  );
                  return;
                }

                async function submitScan(
                  latitude = null,
                  longitude = null
                ) {
                  if (submitting) {
                    return;
                  }

                  submitting = true;

                  try {
                    const response = await fetch(
                      "/api/public/pets/" +
                        encodeURIComponent(qrCode) +
                        "/scan",
                      {
                        method: "POST",

                        headers: {
                          "Content-Type":
                            "application/json",
                        },

                        body: JSON.stringify({
                          latitude,
                          longitude,
                        }),
                      }
                    );

                    const result =
                      await response.json();

                    if (!response.ok) {
                      console.error(
                        "Unable to record TIMAN scan:",
                        result
                      );

                      submitting = false;
                      return;
                    }

                    console.log(
                      "TIMAN QR scan recorded:",
                      result
                    );

                    try {
                      sessionStorage.setItem(
                        reloadKey,
                        "1"
                      );
                    } catch (error) {
                      console.log(
                        "Unable to save reload marker."
                      );
                    }

                    window.location.reload();
                  } catch (error) {
                    submitting = false;

                    console.error(
                      "TIMAN QR scan failed:",
                      error
                    );
                  }
                }

                function continueWithoutLocation() {
                  submitScan(null, null);
                }

                function requestFinderLocation() {
                  if (!("geolocation" in navigator)) {
                    alert(
                      "Location is not supported by this browser."
                    );

                    continueWithoutLocation();
                    return;
                  }

                  navigator.geolocation.getCurrentPosition(
                    function (position) {
                      console.log(
                        "TIMAN location received:",
                        position.coords.latitude,
                        position.coords.longitude
                      );

                      submitScan(
                        position.coords.latitude,
                        position.coords.longitude
                      );
                    },

                    function (error) {
                      console.log(
                        "TIMAN location error:",
                        error.code,
                        error.message
                      );

                      if (error.code === 1) {
                        alert(
                          "Location access was denied. Please allow Location for this website, then scan the QR again."
                        );
                      } else if (error.code === 2) {
                        alert(
                          "Your current location could not be determined. Please make sure your phone Location is turned on."
                        );
                      } else if (error.code === 3) {
                        alert(
                          "Location request timed out. Please try again."
                        );
                      } else {
                        alert(
                          "Unable to get your current location."
                        );
                      }

                      continueWithoutLocation();
                    },

                    {
                      enableHighAccuracy: true,
                      timeout: 20000,
                      maximumAge: 0,
                    }
                  );
                }

                // Create location request overlay.
                const overlay =
                  document.createElement("div");

                overlay.style.position = "fixed";
                overlay.style.left = "0";
                overlay.style.top = "0";
                overlay.style.right = "0";
                overlay.style.bottom = "0";
                overlay.style.background =
                  "rgba(0, 0, 0, 0.55)";
                overlay.style.zIndex = "99999";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.padding = "20px";

                const card =
                  document.createElement("div");

                card.style.width = "100%";
                card.style.maxWidth = "390px";
                card.style.background = "#ffffff";
                card.style.borderRadius = "20px";
                card.style.padding = "24px";
                card.style.textAlign = "center";
                card.style.fontFamily =
                  "Arial, sans-serif";

                card.innerHTML = \`
                  <div
                    style="
                      font-size: 38px;
                      margin-bottom: 10px;
                    "
                  >
                    📍
                  </div>

                  <div
                    style="
                      font-size: 20px;
                      font-weight: 800;
                      color: #26352b;
                    "
                  >
                    Share Scan Location
                  </div>

                  <p
                    style="
                      color: #6f7d74;
                      font-size: 13px;
                      line-height: 1.6;
                      margin: 12px 0 20px;
                    "
                  >
                    TIMAN can share your current location
                    with the pet owner so they know where
                    this QR code was scanned.
                  </p>

                  <button
                    id="timan-location-button"
                    style="
                      width: 100%;
                      border: 0;
                      background: #176b3a;
                      color: white;
                      padding: 15px;
                      border-radius: 12px;
                      font-size: 14px;
                      font-weight: 700;
                      cursor: pointer;
                    "
                  >
                    Share My Location
                  </button>

                  <button
                    id="timan-skip-button"
                    style="
                      width: 100%;
                      border: 0;
                      background: transparent;
                      color: #78857d;
                      padding: 14px;
                      font-size: 12px;
                      cursor: pointer;
                    "
                  >
                    Continue Without Location
                  </button>
                \`;

                overlay.appendChild(card);
                document.body.appendChild(overlay);

                document
                  .getElementById(
                    "timan-location-button"
                  )
                  .addEventListener(
                    "click",
                    function () {
                      this.disabled = true;
                      this.innerText =
                        "Getting Location...";

                      requestFinderLocation();
                    }
                  );

                document
                  .getElementById(
                    "timan-skip-button"
                  )
                  .addEventListener(
                    "click",
                    function () {
                      overlay.remove();

                      continueWithoutLocation();
                    }
                  );
              })();
            </script>

          </body>
        </html>
    `);
  } catch (error) {
    console.error(
      "PUBLIC PROFILE ERROR:",
      error
    );

    return res.status(500).send(
      "Unable to load pet profile."
    );
  }
});

// =====================================================
// PUBLIC FINDER QR SCAN
// POST /api/public/pets/:qrCode/scan
// =====================================================
//
// This route is called when a finder opens a pet's
// permanent QR profile.
//
// Behavior:
// 1. Find pet and owner.
// 2. If no active lost report exists, create one.
// 3. Automatically mark the pet as Missing.
// 4. Record the QR scan.
// 5. Save location when the finder allows it.
// 6. Notify the owner.
// 7. Notify approved clinics.
// =====================================================

router.post(
  "/api/public/pets/:qrCode/scan",
  async (req, res) => {
    let connection;

    try {
      const { qrCode } = req.params;

      const {
        latitude = null,
        longitude = null,
      } = req.body || {};

      // ========================================
      // VALIDATE QR
      // ========================================

      if (!qrCode || !qrCode.trim()) {
        return res.status(400).json({
          success: false,
          message: "Invalid QR code.",
        });
      }

      // ========================================
      // VALIDATE OPTIONAL LOCATION
      // ========================================

      let validLatitude = null;
      let validLongitude = null;
      let locationShared = false;

      if (
        latitude !== null &&
        latitude !== undefined &&
        longitude !== null &&
        longitude !== undefined
      ) {
        const parsedLatitude =
          Number(latitude);

        const parsedLongitude =
          Number(longitude);

        if (
          Number.isFinite(parsedLatitude) &&
          Number.isFinite(parsedLongitude) &&
          parsedLatitude >= -90 &&
          parsedLatitude <= 90 &&
          parsedLongitude >= -180 &&
          parsedLongitude <= 180
        ) {
          validLatitude = parsedLatitude;
          validLongitude = parsedLongitude;
          locationShared = true;
        }
      }

      // ========================================
      // START TRANSACTION
      // ========================================

      connection =
        await db.getConnection();

      await connection.beginTransaction();

      // ========================================
      // FIND PET + OWNER
      // Lock pet row during scan processing.
      // ========================================

      const [petRows] =
        await connection.query(
          `
            SELECT
              p.pet_id,
              p.pet_name,
              p.owner_id,
              p.pet_status,
              p.qr_code,
              u.full_name AS owner_name
            FROM pets p

            INNER JOIN users u
              ON p.owner_id = u.user_id

            WHERE p.qr_code = ?

            LIMIT 1

            FOR UPDATE
          `,
          [qrCode]
        );

      if (petRows.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message:
            "This QR code is not registered in TIMAN.",
        });
      }

      const pet = petRows[0];

      const wasAlreadyMissing =
        pet.pet_status === "Missing";

      // ========================================
      // FIND ACTIVE LOST REPORT
      // ========================================

      const [activeReportRows] =
        await connection.query(
          `
            SELECT
              lost_report_id,
              pet_id,
              owner_id,
              current_condition,
              owner_message,
              case_status
            FROM lost_pet_reports
            WHERE pet_id = ?
              AND case_status = 'Active'
            ORDER BY lost_report_id DESC
            LIMIT 1
            FOR UPDATE
          `,
          [pet.pet_id]
        );

      let lostReportId;

      let createdAutomaticReport = false;

      // ========================================
      // CREATE AUTOMATIC REPORT IF NONE EXISTS
      // ========================================

      if (activeReportRows.length === 0) {
        const automaticMessage =
          "This pet was automatically marked as missing after its permanent QR code was scanned.";

        const [insertReportResult] =
          await connection.query(
            `
              INSERT INTO lost_pet_reports (
                pet_id,
                owner_id,
                current_condition,
                owner_message,
                last_seen_latitude,
                last_seen_longitude,
                case_status
              )
              VALUES (
                ?,
                ?,
                'Unknown',
                ?,
                ?,
                ?,
                'Active'
              )
            `,
            [
              pet.pet_id,
              pet.owner_id,
              automaticMessage,
              validLatitude,
              validLongitude,
            ]
          );

        lostReportId =
          insertReportResult.insertId;

        createdAutomaticReport = true;
      } else {
        lostReportId =
          activeReportRows[0].lost_report_id;

        // Update last-known location only when
        // the finder actually shared location.
        if (locationShared) {
          await connection.query(
            `
              UPDATE lost_pet_reports
              SET
                last_seen_latitude = ?,
                last_seen_longitude = ?
              WHERE lost_report_id = ?
            `,
            [
              validLatitude,
              validLongitude,
              lostReportId,
            ]
          );
        }
      }

      // ========================================
      // MARK PET AS MISSING
      // ========================================

      if (!wasAlreadyMissing) {
        await connection.query(
          `
            UPDATE pets
            SET pet_status = 'Missing'
            WHERE pet_id = ?
          `,
          [pet.pet_id]
        );
      }

      // ========================================
      // SAVE QR SCAN HISTORY
      // ========================================

      const [scanResult] =
        await connection.query(
          `
            INSERT INTO qr_scan_history (
              pet_id,
              lost_report_id,
              latitude,
              longitude,
              location_shared
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            pet.pet_id,
            lostReportId,
            validLatitude,
            validLongitude,
            locationShared ? 1 : 0,
          ]
        );

      // ========================================
      // GET OWNER PUSH TOKENS
      // ========================================

      const [ownerTokenRows] =
        await connection.query(
          `
            SELECT
              expo_push_token
            FROM push_tokens
            WHERE user_id = ?
              AND is_active = 1
          `,
          [pet.owner_id]
        );

      // ========================================
      // GET APPROVED CLINICS
      // ========================================

      const [clinicRows] =
        await connection.query(
          `
            SELECT DISTINCT
              ca.clinic_user_id,
              u.clinic_name,
              u.full_name
            FROM clinic_authorizations ca

            INNER JOIN users u
              ON ca.clinic_user_id = u.user_id

            WHERE ca.pet_id = ?
              AND ca.status = 'Approved'
          `,
          [pet.pet_id]
        );

      const clinicUserIds =
        clinicRows.map(
          (clinic) =>
            clinic.clinic_user_id
        );

      // ========================================
      // GET CLINIC PUSH TOKENS
      // ========================================

      let clinicTokenRows = [];

      if (clinicUserIds.length > 0) {
        const placeholders =
          clinicUserIds
            .map(() => "?")
            .join(", ");

        const [tokens] =
          await connection.query(
            `
              SELECT
                user_id,
                expo_push_token
              FROM push_tokens
              WHERE user_id IN (${placeholders})
                AND is_active = 1
            `,
            clinicUserIds
          );

        clinicTokenRows = tokens;
      }

      // ========================================
      // COMMIT DATABASE CHANGES
      // ========================================

      await connection.commit();

      connection.release();
      connection = null;

      // ========================================
      // SEND NOTIFICATIONS AFTER COMMIT
      // ========================================

      const notificationPromises = [];

      // ========================================
      // OWNER NOTIFICATION
      // ========================================

      const ownerTitle =
        wasAlreadyMissing
          ? `${pet.pet_name}'s QR was scanned`
          : `${pet.pet_name} may have been found`;

      const ownerBody =
        locationShared
          ? wasAlreadyMissing
            ? `Someone scanned ${pet.pet_name}'s QR code and shared a location. Check Missing Pet Details.`
            : `Someone scanned ${pet.pet_name}'s QR code. TIMAN marked the pet as missing and received a scan location.`
          : wasAlreadyMissing
            ? `Someone scanned ${pet.pet_name}'s QR code. No location was shared.`
            : `Someone scanned ${pet.pet_name}'s QR code. TIMAN marked the pet as missing. No location was shared.`;

      for (const tokenRow of ownerTokenRows) {
        notificationPromises.push(
          sendExpoPushNotification({
            to: tokenRow.expo_push_token,

            title: ownerTitle,

            body: ownerBody,

            data: {
              type: "pet_qr_scan",
              petId: String(
                pet.pet_id
              ),
              lostReportId: String(
                lostReportId
              ),
              scanId: String(
                scanResult.insertId
              ),
              locationShared,
            },
          })
        );
      }

      // ========================================
      // CLINIC NOTIFICATION
      // ========================================

      const clinicTitle =
        `${pet.pet_name}'s QR was scanned`;

      const clinicBody =
        locationShared
          ? `${pet.pet_name}'s permanent QR was scanned by a finder and a location was shared.`
          : `${pet.pet_name}'s permanent QR was scanned by a finder. No location was shared.`;

      for (
        const tokenRow of clinicTokenRows
      ) {
        notificationPromises.push(
          sendExpoPushNotification({
            to: tokenRow.expo_push_token,

            title: clinicTitle,

            body: clinicBody,

            data: {
              type: "pet_qr_scan",
              petId: String(
                pet.pet_id
              ),
              lostReportId: String(
                lostReportId
              ),
              scanId: String(
                scanResult.insertId
              ),
              locationShared,
            },
          })
        );
      }

      // Push failure must NOT undo the scan.
      const notificationResults =
        await Promise.allSettled(
          notificationPromises
        );

      console.log(
        "PUBLIC QR SCAN:",
        {
          petId: pet.pet_id,
          petName: pet.pet_name,
          scanId:
            scanResult.insertId,
          lostReportId,
          wasAlreadyMissing,
          createdAutomaticReport,
          locationShared,
          ownerPushTokens:
            ownerTokenRows.length,
          approvedClinics:
            clinicRows.length,
          clinicPushTokens:
            clinicTokenRows.length,
          notifications:
            notificationResults.length,
        }
      );

      // ========================================
      // RESPONSE
      // ========================================

      return res.status(201).json({
        success: true,

        message:
          "QR scan recorded successfully.",

        scan: {
          scanId:
            scanResult.insertId,

          petId:
            pet.pet_id,

          lostReportId,

          locationShared,

          latitude:
            validLatitude,

          longitude:
            validLongitude,
        },

        pet: {
          petId:
            pet.pet_id,

          petName:
            pet.pet_name,

          status:
            "Missing",
        },

        automaticMissing:
          !wasAlreadyMissing,

        createdAutomaticReport,

        notified: {
          ownerDevices:
            ownerTokenRows.length,

          approvedClinics:
            clinicRows.length,

          clinicDevices:
            clinicTokenRows.length,
        },
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "QR SCAN ROLLBACK ERROR:",
            rollbackError
          );
        }

        connection.release();
      }

      console.error(
        "PUBLIC QR SCAN ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to record QR scan.",
      });
    }
  }
);

module.exports = router;
