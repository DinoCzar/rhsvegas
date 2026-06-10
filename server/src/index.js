const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const authRoutes = require("./routes/auth");
const availabilityRoutes = require("./routes/availability");
const checkoutRoutes = require("./routes/checkout");

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
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "rhsvegas-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/checkout", checkoutRoutes);

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

app.listen(config.port, "0.0.0.0", () => {
  console.log("RHS Vegas API listening on port " + config.port);
  console.log("Employee portal: /admin/");
});
