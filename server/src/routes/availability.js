const express = require("express");
const db = require("../db");
const config = require("../config");
const { authRequired, adminRequired } = require("../middleware/auth");
const {
  formatSlotLabel,
  parseLocalDateTime,
  toIsoLocal
} = require("../utils");

const router = express.Router();

function slotToResponse(row) {
  return {
    id: row.id,
    start: row.start_at,
    end: row.end_at,
    label: formatSlotLabel(row.start_at, row.end_at),
    employeeName: row.employee_name || row.name
  };
}

/** Public: available slots for a date (not yet booked) */
router.get("/", (req, res) => {
  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Valid date query required (YYYY-MM-DD)." });
  }

  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;
  const nowIso = toIsoLocal(new Date());

  const rows = db
    .prepare(
      `
      SELECT s.id, s.start_at, s.end_at, u.name AS employee_name
      FROM availability_slots s
      JOIN users u ON u.id = s.user_id AND u.active = 1
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE b.id IS NULL
        AND s.start_at >= ?
        AND s.start_at <= ?
        AND s.start_at > ?
      ORDER BY s.start_at
    `
    )
    .all(dayStart, dayEnd, nowIso);

  res.json({
    ok: true,
    date,
    slots: rows.map(slotToResponse)
  });
});

/** Employee/admin: list slots (own or all for admin) */
router.get("/manage", authRequired, (req, res) => {
  const { from, to, userId } = req.query;
  let sql = `
    SELECT s.id, s.user_id, s.start_at, s.end_at, s.created_at,
           u.name AS employee_name,
           b.id AS booking_id, b.order_id
    FROM availability_slots s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN bookings b ON b.slot_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role !== "admin") {
    sql += " AND s.user_id = ?";
    params.push(req.user.id);
  } else if (userId) {
    sql += " AND s.user_id = ?";
    params.push(Number(userId));
  }

  if (from) {
    sql += " AND s.start_at >= ?";
    params.push(from + "T00:00:00");
  }
  if (to) {
    sql += " AND s.start_at <= ?";
    params.push(to + "T23:59:59");
  }

  sql += " ORDER BY s.start_at";

  const rows = db.prepare(sql).all(...params);
  res.json({ ok: true, slots: rows });
});

/** Add availability slot */
router.post("/", authRequired, (req, res) => {
  const { date, startTime, endTime, userId } = req.body || {};

  if (!date || !startTime || !endTime) {
    return res.status(400).json({ ok: false, error: "date, startTime, and endTime required." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Invalid date format." });
  }

  const start = parseLocalDateTime(date, startTime);
  const end = parseLocalDateTime(date, endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ ok: false, error: "Invalid start or end time." });
  }
  if (end <= start) {
    return res.status(400).json({ ok: false, error: "End time must be after start time." });
  }
  if (start <= new Date()) {
    return res.status(400).json({ ok: false, error: "Cannot add availability in the past." });
  }

  let targetUserId = req.user.id;
  if (userId && req.user.role === "admin") {
    targetUserId = Number(userId);
    const exists = db.prepare("SELECT id FROM users WHERE id = ? AND active = 1").get(targetUserId);
    if (!exists) {
      return res.status(400).json({ ok: false, error: "Employee not found." });
    }
  }

  const startAt = toIsoLocal(start);
  const endAt = toIsoLocal(end);

  const overlap = db
    .prepare(
      `
      SELECT id FROM availability_slots
      WHERE user_id = ?
        AND start_at < ?
        AND end_at > ?
    `
    )
    .get(targetUserId, endAt, startAt);

  if (overlap) {
    return res.status(409).json({ ok: false, error: "This time overlaps an existing slot." });
  }

  const result = db
    .prepare(
      "INSERT INTO availability_slots (user_id, start_at, end_at) VALUES (?, ?, ?)"
    )
    .run(targetUserId, startAt, endAt);

  const row = db
    .prepare(
      `
      SELECT s.id, s.start_at, s.end_at, u.name AS employee_name
      FROM availability_slots s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ ok: true, slot: slotToResponse(row) });
});

/** Delete unbooked slot */
router.delete("/:id", authRequired, (req, res) => {
  const slotId = Number(req.params.id);
  const slot = db
    .prepare(
      `
      SELECT s.*, b.id AS booking_id
      FROM availability_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE s.id = ?
    `
    )
    .get(slotId);

  if (!slot) {
    return res.status(404).json({ ok: false, error: "Slot not found." });
  }
  if (req.user.role !== "admin" && slot.user_id !== req.user.id) {
    return res.status(403).json({ ok: false, error: "You can only delete your own slots." });
  }
  if (slot.booking_id) {
    return res.status(409).json({ ok: false, error: "Cannot delete a booked slot." });
  }

  db.prepare("DELETE FROM availability_slots WHERE id = ?").run(slotId);
  res.json({ ok: true });
});

module.exports = router;
