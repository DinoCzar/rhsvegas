const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const config = require("../config");
const { authRequired, adminRequired, JWT_ALGORITHMS } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rate-limit");
const { isValidEmail } = require("../utils");
const { asyncHandler } = require("../async-handler");

const router = express.Router();

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async function (req, res) {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password required." });
    }

    const user = await db.get(
      "SELECT id, email, name, role, active, password_hash FROM users WHERE email = ?",
      [String(email).trim().toLowerCase()]
    );

    if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
      algorithm: JWT_ALGORITHMS[0]
    });

    res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  })
);

router.get("/me", authRequired, function (req, res) {
  res.json({ ok: true, user: req.user });
});

router.post(
  "/test-email",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const { sendTestEmail, getEmailStatus } = require("../services/email");
    const status = getEmailStatus();

    if (!status.configured) {
      return res.status(503).json({
        ok: false,
        error: "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render Environment."
      });
    }

    const to = (req.body && req.body.to ? String(req.body.to) : status.ownerEmail || req.user.email).trim();
    if (!to || !isValidEmail(to)) {
      return res.status(400).json({ ok: false, error: "Valid email address required." });
    }

    try {
      const result = await sendTestEmail(to);
      res.json({ ok: true, result: result });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: "Failed to send test email.",
        detail: err.response || err.message
      });
    }
  })
);

router.post(
  "/users",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const { email, password, name, role } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ ok: false, error: "Email, password, and name required." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email." });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters." });
    }

    const userRole = role === "admin" ? "admin" : "employee";
    const hash = bcrypt.hashSync(password, 10);

    try {
      const result = await db.run(
        "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
        [String(email).trim().toLowerCase(), hash, name.trim(), userRole]
      );

      res.status(201).json({
        ok: true,
        user: {
          id: result.lastInsertRowid,
          email: String(email).trim().toLowerCase(),
          name: name.trim(),
          role: userRole
        }
      });
    } catch (err) {
      if (String(err.message).includes("UNIQUE")) {
        return res.status(409).json({ ok: false, error: "Email already in use." });
      }
      throw err;
    }
  })
);

router.get(
  "/users",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const users = await db.all(
      "SELECT id, email, name, role, active, created_at FROM users ORDER BY name"
    );
    res.json({ ok: true, users });
  })
);

module.exports = router;
