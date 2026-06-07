require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../db");

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const name = process.env.ADMIN_NAME || "Admin";

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before running seed.");
  process.exit(1);
}

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (existing) {
  console.log("Admin user already exists:", email);
  process.exit(0);
}

const hash = bcrypt.hashSync(password, 10);
db.prepare(
  "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')"
).run(email, hash, name);

console.log("Created admin user:", email);
