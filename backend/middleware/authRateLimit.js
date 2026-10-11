const { rateLimit } = require("express-rate-limit");

const createAuthRateLimiter = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        message: "Too many attempts. Please wait and try again.",
      }),
  });

const loginRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

const registrationRateLimiter = createAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
});

const passwordRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

module.exports = {
  loginRateLimiter,
  passwordRateLimiter,
  registrationRateLimiter,
};
