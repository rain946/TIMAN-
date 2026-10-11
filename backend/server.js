const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config({ quiet: true });
require("./config/auth");
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
const isProduction =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.RAILWAY_ENVIRONMENT);

if (isProduction) {
  app.set("trust proxy", 1);
}

const configuredCorsOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
);

const isDevelopmentOrigin = (origin) => {
  if (isProduction) return false;

  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "10.0.2.2" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Native React Native clients normally do not send an Origin header.
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");
      if (
        configuredCorsOrigins.has(normalizedOrigin) ||
        isDevelopmentOrigin(normalizedOrigin)
      ) {
        return callback(null, true);
      }

      const error = new Error("CORS origin is not allowed.");
      error.code = "CORS_ORIGIN_DENIED";
      return callback(error);
    },
  })
);
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

if (!isProduction) {
  app.get(
    "/api/test-db",
    async (req, res) => {
      try {
        await db.query("SELECT 1");

        res.json({
          success: true,
          message:
            "TIMAN MySQL connection successful.",
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
        });
      }
    }
  );
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.code === "CORS_ORIGIN_DENIED") {
    return res.status(403).json({
      success: false,
      message: "This web origin is not allowed to access the TIMAN API.",
    });
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "The selected image must be 5 MB or smaller.",
    });
  }

  if (/Only valid JPG, PNG, and WEBP images/.test(error.message || "")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("UNHANDLED API ERROR:", {
    method: req.method,
    path: req.originalUrl,
    errorType: error.name,
    message: error.message,
  });

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

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
