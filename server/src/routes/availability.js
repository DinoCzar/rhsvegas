const express = require("express");
const db = require("../db");
const config = require("../config");
const { authRequired, adminRequired } = require("../middleware/auth");
const {
  formatSlotLabel,
  parseLocalDateTime,
  toIsoLocal
} = require("../utils");
const schedule = require("../services/availability-schedule");

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

/** Public: dates within range that have at least one staff-scheduled open slot */
router.get("/dates", (req, res) => {
  try {
    const horizon = schedule.scheduleHorizon();
    const from = req.query.from;
    const to = req.query.to;

    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({ ok: false, error: "Invalid from date (YYYY-MM-DD)." });
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ ok: false, error: "Invalid to date (YYYY-MM-DD)." });
    }

    const dates = schedule.getAvailableDates(from, to);
    res.json({
      ok: true,
      from: from || horizon.from,
      to: to || horizon.to,
      dates: dates
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Could not load available dates." });
  }
});

/** Public: available slots for a date (not yet booked) */
router.get("/", (req, res) => {
  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Valid date query required (YYYY-MM-DD)." });
  }

  try {
    const rows = schedule.getPublicSlotsForDate(date);
    res.json({
      ok: true,
      date,
      slots: rows.map(slotToResponse)
    });
  } catch (err) {
    if (err.message === "DATE_OUT_OF_RANGE") {
      return res.status(400).json({
        ok: false,
        error: "Date must be within the next " + schedule.SCHEDULE_WEEKS + " weeks."
      });
    }
    console.error(err);
    res.status(500).json({ ok: false, error: "Could not load availability." });
  }
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

function resolveScheduleUserId(req) {
  if (req.user.role === "admin" && req.query.userId) {
    const targetUserId = Number(req.query.userId);
    const exists = db.prepare("SELECT id FROM users WHERE id = ? AND active = 1").get(targetUserId);
    if (!exists) {
      return null;
    }
    return targetUserId;
  }
  return req.user.id;
}

/** Weekly recurring schedule */
router.get("/schedule/weekly", authRequired, (req, res) => {
  const userId = resolveScheduleUserId(req);
  if (!userId) {
    return res.status(400).json({ ok: false, error: "Employee not found." });
  }
  res.json({
    ok: true,
    horizon: schedule.scheduleHorizon(),
    schedule: schedule.getWeeklySchedule(userId)
  });
});

router.put("/schedule/weekly", authRequired, (req, res) => {
  try {
    const userId = schedule.resolveTargetUserId(req, req.body?.userId);
    const enabledSlots = schedule.normalizeEnabledSlots(req.body?.enabledSlots);
    schedule.saveWeeklySchedule(userId, enabledSlots);
    res.json({
      ok: true,
      schedule: schedule.getWeeklySchedule(userId)
    });
  } catch (err) {
    if (err.message === "EMPLOYEE_NOT_FOUND") {
      return res.status(400).json({ ok: false, error: "Employee not found." });
    }
    throw err;
  }
});

/** Per-date adjustments (overrides weekly defaults) */
router.get("/schedule/date/:date", authRequired, (req, res) => {
  const userId = resolveScheduleUserId(req);
  if (!userId) {
    return res.status(400).json({ ok: false, error: "Employee not found." });
  }
  try {
    res.json({
      ok: true,
      day: schedule.getDateSchedule(userId, req.params.date)
    });
  } catch (err) {
    if (err.message === "INVALID_DATE") {
      return res.status(400).json({ ok: false, error: "Invalid date format." });
    }
    if (err.message === "DATE_OUT_OF_RANGE") {
      return res.status(400).json({
        ok: false,
        error: "Date must be within the next " + schedule.SCHEDULE_WEEKS + " weeks."
      });
    }
    throw err;
  }
});

router.put("/schedule/date/:date", authRequired, (req, res) => {
  try {
    const userId = schedule.resolveTargetUserId(req, req.body?.userId);
    const hourStates = schedule.normalizeHourStates(req.body?.hours);
    schedule.saveDateOverrides(userId, req.params.date, hourStates);
    res.json({
      ok: true,
      day: schedule.getDateSchedule(userId, req.params.date)
    });
  } catch (err) {
    if (err.message === "EMPLOYEE_NOT_FOUND") {
      return res.status(400).json({ ok: false, error: "Employee not found." });
    }
    if (err.message === "DATE_OUT_OF_RANGE") {
      return res.status(400).json({
        ok: false,
        error: "Date must be within the next " + schedule.SCHEDULE_WEEKS + " weeks."
      });
    }
    throw err;
  }
});

router.delete("/schedule/date/:date", authRequired, (req, res) => {
  try {
    const userId = schedule.resolveTargetUserId(req, req.query.userId);
    schedule.clearDateOverrides(userId, req.params.date);
    res.json({
      ok: true,
      day: schedule.getDateSchedule(userId, req.params.date)
    });
  } catch (err) {
    if (err.message === "EMPLOYEE_NOT_FOUND") {
      return res.status(400).json({ ok: false, error: "Employee not found." });
    }
    if (err.message === "DATE_OUT_OF_RANGE") {
      return res.status(400).json({
        ok: false,
        error: "Date must be within the next " + schedule.SCHEDULE_WEEKS + " weeks."
      });
    }
    throw err;
  }
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
      "INSERT INTO availability_slots (user_id, start_at, end_at, generated) VALUES (?, ?, ?, 0)"
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
