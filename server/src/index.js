const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { initDb, getDatabaseLabel } = require("./db");
const { ensureAdminUser } = require("./bootstrap-admin");
const { ensureAvailabilitySynced } = require("./bootstrap-availability");
const { getEmailStatus, verifySmtpConnection } = require("./services/email");
const authRoutes = require("./routes/auth");
const availabilityRoutes = require("./routes/availability");
const checkoutRoutes = require("./routes/checkout");
const bookingsRoutes = require("./routes/bookings");

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      try {
        var originHost = new URL(origin).hostname;
        var allowedHosts = config.apiHosts;
        if (allowedHosts.indexOf(originHost) !== -1) {
          callback(null, true);
          return;
        }
      } catch (err) {
        // fall through
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.json({ ok: true, service: "rhsvegas-api" });
  }

  var email = getEmailStatus();
  res.json({
    ok: true,
    service: "rhsvegas-api",
    host: req.get("host") || null,
    renderService: process.env.RENDER_SERVICE_NAME || null,
    email: {
      configured: email.configured,
      provider: email.provider,
      ownerEmailSet: email.ownerEmailSet,
      smtpHost: email.smtpHost,
      smtpUser: email.smtpUser,
      fromAddress: email.fromAddress,
      ownerEmail: email.ownerEmail,
      resendConfigured: email.resendConfigured
    }
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/bookings", bookingsRoutes);

var adminCandidates = [
  path.join(__dirname, "../../admin"),
  path.join(__dirname, "../admin")
];
var adminPath = adminCandidates.find(function (p) {
  return fs.existsSync(p);
});

if (adminPath) {
  app.use("/admin", express.static(adminPath));
} else {
  console.warn("Admin portal files not found — /admin/ will not be available.");
}

app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ ok: false, error: "Origin not allowed." });
  }
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error." });
});

async function start() {
  await initDb();

  app.listen(config.port, "0.0.0.0", async function () {
    console.log("RHS Vegas API listening on port " + config.port);
    console.log("Employee portal: /admin/");
    console.log("Database:", getDatabaseLabel());

    await ensureAdminUser();
    await ensureAvailabilitySynced();

    verifySmtpConnection().then(function (result) {
      if (result.ok && result.provider === "resend") {
        console.log("[email] Resend API configured.");
      } else if (result.ok) {
        console.log("[email] SMTP connection verified.");
      } else if (result.reason === "email_not_configured") {
        console.warn("[email] Email not configured — booking emails will not send.");
      } else {
        console.error("[email] Email connection test failed:", result.detail || result.reason);
      }
    });
  });
}

start().catch(function (err) {
  console.error("Failed to start API:", err);
  process.exit(1);
});
