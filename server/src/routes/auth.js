const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const config = require("../config");
const { authRequired, adminRequired } = require("../middleware/auth");
const { isValidEmail } = require("../utils");

const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email and password required." });
  }

  const user = db
    .prepare("SELECT id, email, name, role, active, password_hash FROM users WHERE email = ?")
    .get(String(email).trim().toLowerCase());

  if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ ok: false, error: "Invalid email or password." });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: "7d"
  });

  res.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

router.get("/me", authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

router.post("/users", authRequired, adminRequired, (req, res) => {
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
    const result = db
      .prepare(
        "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
      )
      .run(String(email).trim().toLowerCase(), hash, name.trim(), userRole);

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
});

router.get("/users", authRequired, adminRequired, (req, res) => {
  const users = db
    .prepare("SELECT id, email, name, role, active, created_at FROM users ORDER BY name")
    .all();
  res.json({ ok: true, users });
});

module.exports = router;
