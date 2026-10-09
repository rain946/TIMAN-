const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./config/db");

const authRoutes =
  require("./routes/authRoutes");

const petRoutes =
  require("./routes/petRoutes");

const publicRoutes =
  require("./routes/publicRoutes");

const authorizationRoutes =
  require("./routes/authorizationRoutes");

const vetRecordRoutes =
  require("./routes/vetRecordRoutes");

const pushTokenRoutes =
  require("./routes/pushTokenRoutes");

const notificationRoutes =
  require("./routes/notificationRoutes");

const lostPetRoutes = require("./routes/lostPetRoutes");
const nearbyAlertRoutes = require("./routes/nearbyAlertRoutes");

const clinicDashboardRoutes =
  require("./routes/clinicDashboardRoutes");

const clinicReportRoutes =
  require("./routes/clinicReportRoutes");

const petCareScheduleRoutes =
  require("./routes/petCareScheduleRoutes");

const {
  startReminderScheduler,
} = require("./services/reminderScheduler");

const profileRoutes =
  require("./routes/profileRoutes");

const app = express();

const PORT =
  process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    Object.prototype.hasOwnProperty.call(error, "body")
  ) {
    console.warn("INVALID API JSON BODY:", req.method, req.originalUrl);
    return res.status(400).json({
      success: false,
      message: "The request body is not valid JSON.",
    });
  }

  return next(error);
});

// =====================================================
// STATIC UPLOADS
// =====================================================

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

// =====================================================
// API ROUTES
// =====================================================


app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/pets",
  petRoutes
);

app.use(
  "/api/authorizations",
  authorizationRoutes
);

app.use(
  "/api/vet-records",
  vetRecordRoutes
);

app.use(
  "/api/push-tokens",
  pushTokenRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/lost-pets",
  lostPetRoutes
);

app.use(
  "/api/nearby-alerts",
  nearbyAlertRoutes
);

app.use(
  "/api/profile",
  profileRoutes
);

app.use(
  "/api/clinic-dashboard",
  clinicDashboardRoutes
);

app.use(
  "/api/clinic-reports",
  clinicReportRoutes
);

app.use(
  "/api/pet-care-schedules",
  petCareScheduleRoutes
);

// Public pet profile routes
app.use("/", publicRoutes);
// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "TIMAN API is running.",
  });
});

// =====================================================
// DATABASE TEST
// =====================================================

app.get(
  "/api/test-db",
  async (req, res) => {
    try {
      const [rows] =
        await db.query(`
          SELECT
            DATABASE() AS database_name,
            NOW() AS server_time
        `);

      res.json({
        success: true,
        message:
          "TIMAN MySQL connection successful.",
        data:
          rows[0],
      });
    } catch (error) {
      console.error(
        "DATABASE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Database connection failed.",
        error:
          error.message,
      });
    }
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `TIMAN API running on port ${PORT}`
    );
    startReminderScheduler();
  }
);
