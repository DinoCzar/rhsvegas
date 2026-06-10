const rateLimit = require("express-rate-limit");

var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many login attempts. Please try again in 15 minutes." }
});

var checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many booking requests. Please try again later." }
});

module.exports = { loginLimiter, checkoutLimiter };
