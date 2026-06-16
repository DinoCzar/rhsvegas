const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const {
  formatSlotLabel,
  parseLocalDateTime,
  isWallClockPast
} = require("../utils");
const schedule = require("../services/availability-schedule");
const { asyncHandler } = require("../async-handler");
const { publicReadLimiter, authWriteLimiter } = require("../middleware/rate-limit");

const router = express.Router();

function slotToResponse(row) {
  return {
    id: row.id,
    start: row.start_at,
    end: row.end_at,
    label: formatSlotLabel(row.start_at),
    employeeName: row.employee_name || row.name
  };
}

router.get(
  "/dates",
  publicReadLimiter,
  asyncHandler(async function (req, res) {
    const horizon = schedule.scheduleHorizon();
    const from = req.query.from;
    const to = req.query.to;

    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({ ok: false, error: "Invalid from date (YYYY-MM-DD)." });
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ ok: false, error: "Invalid to date (YYYY-MM-DD)." });
    }

    const dates = await schedule.getAvailableDates(from, to);
    res.json({
      ok: true,
      from: from || horizon.from,
      to: to || horizon.to,
      dates: dates
    });
  })
);

router.get(
  "/",
  publicReadLimiter,
  asyncHandler(async function (req, res) {
    const date = req.query.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "Valid date query required (YYYY-MM-DD)." });
    }

    try {
      const rows = await schedule.getPublicSlotsForDate(date);
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
      throw err;
    }
  })
);

async function resolveScheduleUserId(req) {
  if (req.user.role === "admin" && req.query.userId) {
    const targetUserId = Number(req.query.userId);
    const exists = await db.get("SELECT id FROM users WHERE id = ? AND active = 1", [targetUserId]);
    if (!exists) {
      return null;
    }
    return targetUserId;
  }
  return req.user.id;
}

router.get(
  "/manage",
  authRequired,
  asyncHandler(async function (req, res) {
    const { from, to, userId } = req.query;
    let sql = `
    SELECT s.id, s.user_id, s.start_at, s.end_at, s.created_at,
           u.name AS employee_name,
           b.id AS booking_id, b.order_id, b.status AS booking_status
    FROM availability_slots s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('pending', 'approved')
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

    const rows = await db.all(sql, params);
    res.json({ ok: true, slots: rows });
  })
);

router.get(
  "/schedule/weekly",
  authRequired,
  asyncHandler(async function (req, res) {
    const userId = await resolveScheduleUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Employee not found." });
    }
    res.json({
      ok: true,
      horizon: schedule.scheduleHorizon(),
      schedule: await schedule.getWeeklySchedule(userId)
    });
  })
);

router.put(
  "/schedule/weekly",
  authRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    try {
      const userId = await schedule.resolveTargetUserId(req, req.body?.userId);
      const enabledSlots = schedule.normalizeEnabledSlots(req.body?.enabledSlots);
      await schedule.saveWeeklySchedule(userId, enabledSlots);
      res.json({
        ok: true,
        schedule: await schedule.getWeeklySchedule(userId)
      });
    } catch (err) {
      if (err.message === "EMPLOYEE_NOT_FOUND") {
        return res.status(400).json({ ok: false, error: "Employee not found." });
      }
      throw err;
    }
  })
);

router.get(
  "/schedule/date/:date",
  authRequired,
  asyncHandler(async function (req, res) {
    const userId = await resolveScheduleUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Employee not found." });
    }
    try {
      res.json({
        ok: true,
        day: await schedule.getDateSchedule(userId, req.params.date)
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
  })
);

router.put(
  "/schedule/date/:date",
  authRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    try {
      const userId = await schedule.resolveTargetUserId(req, req.body?.userId);
      const hourStates = schedule.normalizeHourStates(req.body?.hours);
      await schedule.saveDateOverrides(userId, req.params.date, hourStates);
      res.json({
        ok: true,
        day: await schedule.getDateSchedule(userId, req.params.date)
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
  })
);

router.delete(
  "/schedule/date/:date",
  authRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    try {
      const userId = await schedule.resolveTargetUserId(req, req.query.userId);
      await schedule.clearDateOverrides(userId, req.params.date);
      res.json({
        ok: true,
        day: await schedule.getDateSchedule(userId, req.params.date)
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
  })
);

router.post(
  "/",
  authRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    const { date, startTime, endTime, userId } = req.body || {};

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ ok: false, error: "date, startTime, and endTime required." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "Invalid date format." });
    }

    const startAt = parseLocalDateTime(date, startTime);
    const endAt = parseLocalDateTime(date, endTime);

    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return res.status(400).json({ ok: false, error: "Invalid start or end time." });
    }
    if (endAt <= startAt) {
      return res.status(400).json({ ok: false, error: "End time must be after start time." });
    }
    if (isWallClockPast(startAt)) {
      return res.status(400).json({ ok: false, error: "Cannot add availability in the past." });
    }

    let targetUserId = req.user.id;
    if (userId && req.user.role === "admin") {
      targetUserId = Number(userId);
      const exists = await db.get("SELECT id FROM users WHERE id = ? AND active = 1", [targetUserId]);
      if (!exists) {
        return res.status(400).json({ ok: false, error: "Employee not found." });
      }
    }

    const overlap = await db.get(
      `
      SELECT id FROM availability_slots
      WHERE user_id = ?
        AND start_at < ?
        AND end_at > ?
    `,
      [targetUserId, endAt, startAt]
    );

    if (overlap) {
      return res.status(409).json({ ok: false, error: "This time overlaps an existing slot." });
    }

    const result = await db.run(
      "INSERT INTO availability_slots (user_id, start_at, end_at, generated) VALUES (?, ?, ?, 0)",
      [targetUserId, startAt, endAt]
    );

    const row = await db.get(
      `
      SELECT s.id, s.start_at, s.end_at, u.name AS employee_name
      FROM availability_slots s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `,
      [result.lastInsertRowid]
    );

    res.status(201).json({ ok: true, slot: slotToResponse(row) });
  })
);

router.delete(
  "/:id",
  authRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    const slotId = Number(req.params.id);
    const slot = await db.get(
      `
      SELECT s.*, b.id AS booking_id, b.status AS booking_status
      FROM availability_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('pending', 'approved')
      WHERE s.id = ?
    `,
      [slotId]
    );

    if (!slot) {
      return res.status(404).json({ ok: false, error: "Slot not found." });
    }
    if (req.user.role !== "admin" && slot.user_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: "You can only delete your own slots." });
    }
    if (slot.booking_id && slot.booking_status !== "denied") {
      return res.status(409).json({ ok: false, error: "Cannot delete a booked slot." });
    }

    await db.run("DELETE FROM availability_slots WHERE id = ?", [slotId]);
    res.json({ ok: true });
  })
);

module.exports = router;
