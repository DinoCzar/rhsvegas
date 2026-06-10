require("dotenv").config();
const db = require("../db");
const { ensureAdminUser } = require("../bootstrap-admin");

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before running seed.");
  process.exit(1);
}

const existed = Boolean(db.prepare("SELECT id FROM users WHERE email = ?").get(email));
ensureAdminUser();

if (existed) {
  console.log("Admin user already exists:", email);
} else {
  console.log("Created admin user:", email);
}
