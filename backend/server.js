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
  "/api/lost-pets",
  lostPetRoutes
);

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
  "/api/profile",
  profileRoutes
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
