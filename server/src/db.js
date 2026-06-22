const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client");
const config = require("./config");

var client = null;

function normalizeValue(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

function normalizeRow(row) {
  if (!row) {
    return undefined;
  }
  var out = {};
  Object.keys(row).forEach(function (key) {
    out[key] = normalizeValue(row[key]);
  });
  return out;
}

function normalizeRows(rows) {
  return (rows || []).map(normalizeRow);
}

function createExecutor(executor) {
  return {
    get: async function (sql, args) {
      var result = await executor.execute({ sql: sql, args: args || [] });
      return normalizeRow(result.rows[0]);
    },
    all: async function (sql, args) {
      var result = await executor.execute({ sql: sql, args: args || [] });
      return normalizeRows(result.rows);
    },
    run: async function (sql, args) {
      var result = await executor.execute({ sql: sql, args: args || [] });
      return {
        changes: result.rowsAffected,
        lastInsertRowid: normalizeValue(result.lastInsertRowid)
      };
    }
  };
}

function getClient() {
  if (!client) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return client;
}

async function exec(sql) {
  await getClient().executeMultiple(sql);
}

async function get(sql, args) {
  return createExecutor(getClient()).get(sql, args);
}

async function all(sql, args) {
  return createExecutor(getClient()).all(sql, args);
}

async function run(sql, args) {
  return createExecutor(getClient()).run(sql, args);
}

async function transaction(fn) {
  var txn = await getClient().transaction("write");
  var tx = createExecutor(txn);
  try {
    var result = await fn(tx);
    await txn.commit();
    return result;
  } catch (err) {
    await txn.rollback();
    throw err;
  }
}

var SCHEMA = `
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
    slot_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    items_json TEXT NOT NULL,
    estimated_total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_at TEXT,
    reviewed_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (slot_id) REFERENCES availability_slots(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS gallery_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caption TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL,
    image_data TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery_images(sort_order, id);

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    cart_name TEXT,
    price REAL NOT NULL DEFAULT 0,
    price_label TEXT,
    add_to_cart INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_services_section ON services(section, category, sort_order);
`;

async function runOptionalMigration(sql) {
  try {
    await exec(sql);
  } catch (err) {
    // column/index already exists on older databases
  }
}

async function initDb() {
  if (config.turso.url.startsWith("file:")) {
    var filePath = config.turso.url.replace(/^file:/, "");
    var dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  client = createClient({
    url: config.turso.url,
    authToken: config.turso.authToken || undefined
  });

  await exec("PRAGMA foreign_keys = ON;");
  await exec(SCHEMA);
  await runOptionalMigration(
    "ALTER TABLE availability_slots ADD COLUMN generated INTEGER NOT NULL DEFAULT 0;"
  );
  await runOptionalMigration(
    "ALTER TABLE bookings ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';"
  );
  await runOptionalMigration("ALTER TABLE bookings ADD COLUMN reviewed_at TEXT;");
  await runOptionalMigration("ALTER TABLE bookings ADD COLUMN reviewed_by INTEGER;");
  await runOptionalMigration(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot
      ON bookings(slot_id)
      WHERE status IN ('pending', 'approved');
  `);
}

function getDatabaseLabel() {
  if (config.turso.url.startsWith("file:")) {
    return config.turso.url;
  }
  return config.turso.url.replace(/\/\/[^@]+@/, "//***@");
}

module.exports = {
  initDb,
  get,
  all,
  run,
  exec,
  transaction,
  getDatabaseLabel
};
