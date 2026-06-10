require("dotenv").config();

var isProduction = process.env.NODE_ENV === "production";
var jwtSecret = process.env.JWT_SECRET || "dev-only-change-in-production";

if (isProduction) {
  if (!process.env.JWT_SECRET || jwtSecret.length < 32) {
    console.error("FATAL: Set JWT_SECRET to a random string of at least 32 characters in production.");
    process.exit(1);
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
  ownerEmail: process.env.OWNER_EMAIL || "",
  businessName: process.env.BUSINESS_NAME || "Ryan's Home Solutions",
  timezone: process.env.TIMEZONE || "America/Los_Angeles",
  slotMinutes: Number(process.env.SLOT_MINUTES) || 120,
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@rhsvegas.com"
  }
};
