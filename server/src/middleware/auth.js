const jwt = require("jsonwebtoken");
const config = require("../config");
const db = require("../db");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db
      .prepare("SELECT id, email, name, role, active FROM users WHERE id = ?")
      .get(payload.sub);

    if (!user || !user.active) {
      return res.status(401).json({ ok: false, error: "Invalid or inactive account." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid or expired session." });
  }
}

function adminRequired(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin access required." });
  }
  next();
}

module.exports = { authRequired, adminRequired };
