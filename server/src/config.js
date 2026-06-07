require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-in-production",
  databasePath: process.env.DATABASE_PATH || "./data/rhsvegas.db",
  frontendOrigins: (process.env.FRONTEND_ORIGINS || "http://localhost:8080")
    .split(",")
    .map((s) => s.trim())
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
