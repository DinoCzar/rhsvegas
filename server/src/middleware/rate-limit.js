const rateLimit = require("express-rate-limit");

function limiter(windowMs, max, message) {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: message }
  });
}

var loginLimiter = limiter(
  15 * 60 * 1000,
  10,
  "Too many login attempts. Please try again in 15 minutes."
);

var checkoutLimiter = limiter(
  60 * 60 * 1000,
  15,
  "Too many booking requests. Please try again later."
);

var publicReadLimiter = limiter(
  60 * 1000,
  120,
  "Too many requests. Please slow down."
);

var galleryImageLimiter = limiter(
  60 * 1000,
  300,
  "Too many image requests. Please try again shortly."
);

var authWriteLimiter = limiter(
  15 * 60 * 1000,
  80,
  "Too many changes. Please wait and try again."
);

module.exports = {
  loginLimiter,
  checkoutLimiter,
  publicReadLimiter,
  galleryImageLimiter,
  authWriteLimiter
};
