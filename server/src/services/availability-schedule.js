const db = require("../db");
const config = require("../config");
const { parseLocalDateTime, toIsoLocal } = require("../utils");

const SCHEDULE_WEEKS = 12;
const SCHEDULE_START_HOURS = [9, 10, 11, 12];
const SCHEDULE_SLOT_MINUTES = 60;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function padHour(hour) {
  return String(hour).padStart(2, "0") + ":00";
}

function formatHourLabel(hour) {
  if (hour === 12) return "12pm";
  if (hour < 12) return hour + "am";
  return hour - 12 + "pm";
}

function parseDateOnly(dateStr) {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateOnly(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function scheduleHorizon() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + 1);

  const to = new Date(from);
  to.setDate(to.getDate() + SCHEDULE_WEEKS * 7 - 1);

  return { from: formatDateOnly(from), to: formatDateOnly(to) };
}

function weeklyEnabled(userId, dayOfWeek, startHour) {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM weekly_availability WHERE user_id = ? AND day_of_week = ? AND start_hour = ?"
    )
    .get(userId, dayOfWeek, startHour);
  return Boolean(row);
}

function dateOverride(userId, dateStr, startHour) {
  return db
    .prepare(
      "SELECT enabled FROM date_availability_overrides WHERE user_id = ? AND date = ? AND start_hour = ?"
    )
    .get(userId, dateStr, startHour);
}

function isEffectivelyEnabled(userId, dateStr, startHour) {
  const override = dateOverride(userId, dateStr, startHour);
  if (override) {
    return override.enabled === 1;
  }
  const dow = parseDateOnly(dateStr).getDay();
  return weeklyEnabled(userId, dow, startHour);
}

function getWeeklySchedule(userId) {
  const rows = db
    .prepare(
      "SELECT day_of_week, start_hour FROM weekly_availability WHERE user_id = ? ORDER BY day_of_week, start_hour"
    )
    .all(userId);

  const grid = {};
  for (var d = 0; d < 7; d += 1) {
    grid[d] = [];
  }
  rows.forEach(function (row) {
    grid[row.day_of_week].push(row.start_hour);
  });

  return {
    weeks: SCHEDULE_WEEKS,
    startHours: SCHEDULE_START_HOURS,
    dayLabels: DAY_LABELS,
    hourLabels: SCHEDULE_START_HOURS.map(formatHourLabel),
    grid: grid
  };
}

function getDateSchedule(userId, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("INVALID_DATE");
  }

  const horizon = scheduleHorizon();
  if (dateStr < horizon.from || dateStr > horizon.to) {
    throw new Error("DATE_OUT_OF_RANGE");
  }

  const dow = parseDateOnly(dateStr).getDay();
  const hours = SCHEDULE_START_HOURS.map(function (startHour) {
    const override = dateOverride(userId, dateStr, startHour);
    const weekly = weeklyEnabled(userId, dow, startHour);
    const enabled = isEffectivelyEnabled(userId, dateStr, startHour);
    return {
      startHour: startHour,
      label: formatHourLabel(startHour),
      enabled: enabled,
      weeklyDefault: weekly,
      hasOverride: Boolean(override)
    };
  });

  return {
    date: dateStr,
    dayOfWeek: dow,
    dayLabel: DAY_LABELS[dow],
    hours: hours,
    horizon: horizon
  };
}

function saveWeeklySchedule(userId, enabledSlots) {
  const replace = db.transaction(function (slots) {
    db.prepare("DELETE FROM weekly_availability WHERE user_id = ?").run(userId);
    const insert = db.prepare(
      "INSERT INTO weekly_availability (user_id, day_of_week, start_hour) VALUES (?, ?, ?)"
    );
    slots.forEach(function (slot) {
      insert.run(userId, slot.dayOfWeek, slot.startHour);
    });
  });

  replace(enabledSlots);
  syncGeneratedSlots(userId);
}

function saveDateOverrides(userId, dateStr, hourStates) {
  const horizon = scheduleHorizon();
  if (dateStr < horizon.from || dateStr > horizon.to) {
    throw new Error("DATE_OUT_OF_RANGE");
  }

  const dow = parseDateOnly(dateStr).getDay();
  const apply = db.transaction(function (states) {
    const upsert = db.prepare(`
      INSERT INTO date_availability_overrides (user_id, date, start_hour, enabled)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, date, start_hour) DO UPDATE SET enabled = excluded.enabled
    `);
    const remove = db.prepare(
      "DELETE FROM date_availability_overrides WHERE user_id = ? AND date = ? AND start_hour = ?"
    );

    states.forEach(function (entry) {
      const weekly = weeklyEnabled(userId, dow, entry.startHour);
      if (entry.enabled === weekly) {
        remove.run(userId, dateStr, entry.startHour);
      } else {
        upsert.run(userId, dateStr, entry.startHour, entry.enabled ? 1 : 0);
      }
    });
  });

  apply(hourStates);
  syncGeneratedSlotsForDate(userId, dateStr);
}

function clearDateOverrides(userId, dateStr) {
  db.prepare("DELETE FROM date_availability_overrides WHERE user_id = ? AND date = ?").run(
    userId,
    dateStr
  );
  syncGeneratedSlotsForDate(userId, dateStr);
}

function slotTimesForHour(dateStr, startHour) {
  const start = parseLocalDateTime(dateStr, padHour(startHour));
  const end = new Date(start.getTime() + SCHEDULE_SLOT_MINUTES * 60 * 1000);
  return { startAt: toIsoLocal(start), endAt: toIsoLocal(end) };
}

function syncGeneratedSlotsForDate(userId, dateStr) {
  const nowIso = toIsoLocal(new Date());

  SCHEDULE_START_HOURS.forEach(function (startHour) {
    const { startAt, endAt } = slotTimesForHour(dateStr, startHour);
    const enabled = isEffectivelyEnabled(userId, dateStr, startHour);

    const existing = db
      .prepare(
        `
        SELECT s.id, s.generated, b.id AS booking_id
        FROM availability_slots s
        LEFT JOIN bookings b ON b.slot_id = s.id
        WHERE s.user_id = ? AND s.start_at = ? AND s.end_at = ?
      `
      )
      .get(userId, startAt, endAt);

    if (enabled) {
      if (!existing && startAt > nowIso) {
        db.prepare(
          "INSERT INTO availability_slots (user_id, start_at, end_at, generated) VALUES (?, ?, ?, 1)"
        ).run(userId, startAt, endAt);
      }
      return;
    }

    if (existing && existing.generated === 1 && !existing.booking_id) {
      db.prepare("DELETE FROM availability_slots WHERE id = ?").run(existing.id);
    }
  });
}

function syncGeneratedSlots(userId) {
  const horizon = scheduleHorizon();
  const cursor = parseDateOnly(horizon.from);
  const end = parseDateOnly(horizon.to);

  db.prepare(
    `
    DELETE FROM availability_slots
    WHERE user_id = ?
      AND generated = 1
      AND id NOT IN (SELECT slot_id FROM bookings WHERE slot_id IS NOT NULL)
      AND start_at >= ?
      AND start_at <= ?
  `
  ).run(userId, horizon.from + "T00:00:00", horizon.to + "T23:59:59");

  while (cursor <= end) {
    syncGeneratedSlotsForDate(userId, formatDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
}

function normalizeEnabledSlots(body) {
  if (!Array.isArray(body)) {
    return [];
  }
  return body
    .map(function (slot) {
      return {
        dayOfWeek: Number(slot.dayOfWeek),
        startHour: Number(slot.startHour)
      };
    })
    .filter(function (slot) {
      return (
        slot.dayOfWeek >= 0 &&
        slot.dayOfWeek <= 6 &&
        SCHEDULE_START_HOURS.indexOf(slot.startHour) !== -1
      );
    });
}

function normalizeHourStates(body) {
  if (!Array.isArray(body)) {
    return [];
  }
  return body
    .map(function (entry) {
      return {
        startHour: Number(entry.startHour),
        enabled: Boolean(entry.enabled)
      };
    })
    .filter(function (entry) {
      return SCHEDULE_START_HOURS.indexOf(entry.startHour) !== -1;
    });
}

function syncActiveUsersForDate(dateStr) {
  const users = db.prepare("SELECT id FROM users WHERE active = 1").all();
  users.forEach(function (user) {
    syncGeneratedSlotsForDate(user.id, dateStr);
  });
}

function isBookableSlot(userId, dateStr, startHour, nowIso) {
  if (!isEffectivelyEnabled(userId, dateStr, startHour)) {
    return false;
  }

  const { startAt, endAt } = slotTimesForHour(dateStr, startHour);
  if (startAt <= nowIso) {
    return false;
  }

  const row = db
    .prepare(
      `
      SELECT b.id AS booking_id
      FROM availability_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE s.user_id = ? AND s.start_at = ? AND s.end_at = ?
    `
    )
    .get(userId, startAt, endAt);

  if (!row) {
    return true;
  }

  return !row.booking_id;
}

function dateHasAvailableSlots(dateStr, nowIso) {
  const users = db.prepare("SELECT id FROM users WHERE active = 1").all();
  if (!users.length) {
    return false;
  }

  return users.some(function (user) {
    return SCHEDULE_START_HOURS.some(function (startHour) {
      return isBookableSlot(user.id, dateStr, startHour, nowIso);
    });
  });
}

function getAvailableDates(from, to) {
  const horizon = scheduleHorizon();
  const rangeFrom = from && from >= horizon.from ? from : horizon.from;
  const rangeTo = to && to <= horizon.to ? to : horizon.to;
  const nowIso = toIsoLocal(new Date());
  const dates = [];
  const cursor = parseDateOnly(rangeFrom);
  const end = parseDateOnly(rangeTo);

  while (cursor <= end) {
    const dateStr = formatDateOnly(cursor);
    if (dateHasAvailableSlots(dateStr, nowIso)) {
      dates.push(dateStr);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getPublicSlotsForDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("INVALID_DATE");
  }

  const horizon = scheduleHorizon();
  if (dateStr < horizon.from || dateStr > horizon.to) {
    throw new Error("DATE_OUT_OF_RANGE");
  }

  syncActiveUsersForDate(dateStr);

  const dayStart = dateStr + "T00:00:00";
  const dayEnd = dateStr + "T23:59:59";
  const nowIso = toIsoLocal(new Date());

  return db
    .prepare(
      `
      SELECT s.id, s.start_at, s.end_at, u.name AS employee_name
      FROM availability_slots s
      JOIN users u ON u.id = s.user_id AND u.active = 1
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE b.id IS NULL
        AND s.generated = 1
        AND s.start_at >= ?
        AND s.start_at <= ?
        AND s.start_at > ?
      ORDER BY s.start_at
    `
    )
    .all(dayStart, dayEnd, nowIso);
}

function resolveTargetUserId(req, bodyUserId) {
  if (req.user.role === "admin" && bodyUserId) {
    const targetUserId = Number(bodyUserId);
    const exists = db.prepare("SELECT id FROM users WHERE id = ? AND active = 1").get(targetUserId);
    if (!exists) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }
    return targetUserId;
  }
  return req.user.id;
}

module.exports = {
  SCHEDULE_WEEKS,
  SCHEDULE_START_HOURS,
  DAY_LABELS,
  scheduleHorizon,
  getWeeklySchedule,
  getDateSchedule,
  saveWeeklySchedule,
  saveDateOverrides,
  clearDateOverrides,
  syncGeneratedSlots,
  syncActiveUsersForDate,
  getAvailableDates,
  getPublicSlotsForDate,
  normalizeEnabledSlots,
  normalizeHourStates,
  resolveTargetUserId
};
