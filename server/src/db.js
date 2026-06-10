const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./config");

const dir = path.dirname(config.databasePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(config.databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS availability_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    generated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS weekly_availability (
    user_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_hour INTEGER NOT NULL,
    PRIMARY KEY (user_id, day_of_week, start_hour),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS date_availability_overrides (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_hour INTEGER NOT NULL,
    enabled INTEGER NOT NULL,
    PRIMARY KEY (user_id, date, start_hour),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_slots_start ON availability_slots(start_at);
  CREATE INDEX IF NOT EXISTS idx_slots_user ON availability_slots(user_id);

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL UNIQUE,
    slot_id INTEGER NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    items_json TEXT NOT NULL,
    estimated_total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (slot_id) REFERENCES availability_slots(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

try {
  db.exec("ALTER TABLE availability_slots ADD COLUMN generated INTEGER NOT NULL DEFAULT 0");
} catch (err) {
  // column already exists
}

module.exports = db;
