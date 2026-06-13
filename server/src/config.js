require("dotenv").config();

var isProduction = process.env.NODE_ENV === "production";
var jwtSecret = (process.env.JWT_SECRET || "").trim();

if (!jwtSecret) {
  jwtSecret = "dev-only-change-in-production";
}

if (isProduction) {
  if (!process.env.JWT_SECRET || jwtSecret.length < 32) {
    console.error("");
    console.error("=== RHS Vegas API — startup failed ===");
    console.error("JWT_SECRET is missing or too short (need 32+ characters).");
    console.error("");
    console.error("Fix in Render dashboard → rhsvegas-api → Environment:");
    console.error("  1. Add or edit JWT_SECRET");
    console.error("  2. Use a long random string (run: openssl rand -base64 32)");
    console.error("  3. Save — Render will redeploy automatically");
    console.error("");
    process.exit(1);
  }
}

if (isProduction) {
  var resendReady = Boolean((process.env.RESEND_API_KEY || "").trim());
  var smtpReady =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (!resendReady && !smtpReady) {
    console.warn("");
    console.warn("=== RHS Vegas API — email not configured ===");
    console.warn("Booking emails will NOT send until email is configured.");
    console.warn("On Render, use Resend (SMTP ports are blocked):");
    console.warn("  RESEND_API_KEY, EMAIL_FROM, OWNER_EMAIL");
    console.warn("");
  } else if (!resendReady && smtpReady) {
    console.warn("");
    console.warn("[email] SMTP is configured but Render blocks outbound SMTP.");
    console.warn("Add RESEND_API_KEY in Render Environment for reliable delivery.");
    console.warn("");
  } else if (!process.env.OWNER_EMAIL) {
    console.warn("[email] OWNER_EMAIL is not set — owner alerts need a destination address.");
  }
}

module.exports = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  databasePath: process.env.DATABASE_PATH || "./data/rhsvegas.db",
  frontendOrigins: (process.env.FRONTEND_ORIGINS || "http://localhost:8080")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean),
  apiHosts: (process.env.API_HOSTS ||
    "localhost,rhsvegas-api-c5y0.onrender.com,api.rhsvegas.com")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean),
  ownerEmail: process.env.OWNER_EMAIL || "",
  businessName: process.env.BUSINESS_NAME || "Ryan's Home Solutions",
  timezone: process.env.TIMEZONE || "America/Los_Angeles",
  slotMinutes: Number(process.env.SLOT_MINUTES) || 120,
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_FROM || "",
  resend: {
    apiKey: (process.env.RESEND_API_KEY || "").trim()
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@rhsvegas.com"
  }
};
