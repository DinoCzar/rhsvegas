const db = require("../db");
const { wallClockIso, businessNowIso, addMinutesToWallClock } = require("../utils");

const SCHEDULE_WEEKS = 12;
const SCHEDULE_START_HOURS = [9, 10, 11, 12];
const SCHEDULE_SLOT_MINUTES = 60;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

async function weeklyEnabled(userId, dayOfWeek, startHour) {
  const row = await db.get(
    "SELECT 1 AS ok FROM weekly_availability WHERE user_id = ? AND day_of_week = ? AND start_hour = ?",
    [userId, dayOfWeek, startHour]
  );
  return Boolean(row);
}

async function dateOverride(userId, dateStr, startHour) {
  return db.get(
    "SELECT enabled FROM date_availability_overrides WHERE user_id = ? AND date = ? AND start_hour = ?",
    [userId, dateStr, startHour]
  );
}

async function isEffectivelyEnabled(userId, dateStr, startHour) {
  const override = await dateOverride(userId, dateStr, startHour);
  if (override) {
    return override.enabled === 1;
  }
  const dow = parseDateOnly(dateStr).getDay();
  return await weeklyEnabled(userId, dow, startHour);
}

async function getWeeklySchedule(userId) {
  const rows = await db.all(
    "SELECT day_of_week, start_hour FROM weekly_availability WHERE user_id = ? ORDER BY day_of_week, start_hour",
    [userId]
  );

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

async function getDateSchedule(userId, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("INVALID_DATE");
  }

  const horizon = scheduleHorizon();
  if (dateStr < horizon.from || dateStr > horizon.to) {
    throw new Error("DATE_OUT_OF_RANGE");
  }

  const dow = parseDateOnly(dateStr).getDay();
  const hours = await Promise.all(
    SCHEDULE_START_HOURS.map(async function (startHour) {
      const override = await dateOverride(userId, dateStr, startHour);
      const weekly = await weeklyEnabled(userId, dow, startHour);
      const enabled = await isEffectivelyEnabled(userId, dateStr, startHour);
      return {
        startHour: startHour,
        label: formatHourLabel(startHour),
        enabled: enabled,
        weeklyDefault: weekly,
        hasOverride: Boolean(override)
      };
    })
  );

  return {
    date: dateStr,
    dayOfWeek: dow,
    dayLabel: DAY_LABELS[dow],
    hours: hours,
    horizon: horizon
  };
}

async function saveWeeklySchedule(userId, enabledSlots) {
  await db.transaction(async function (tx) {
    await tx.run("DELETE FROM weekly_availability WHERE user_id = ?", [userId]);
    for (var i = 0; i < enabledSlots.length; i += 1) {
      var slot = enabledSlots[i];
      await tx.run(
        "INSERT INTO weekly_availability (user_id, day_of_week, start_hour) VALUES (?, ?, ?)",
        [userId, slot.dayOfWeek, slot.startHour]
      );
    }
  });
  await syncGeneratedSlots(userId);
}

async function saveDateOverrides(userId, dateStr, hourStates) {
  const horizon = scheduleHorizon();
  if (dateStr < horizon.from || dateStr > horizon.to) {
    throw new Error("DATE_OUT_OF_RANGE");
  }

  const dow = parseDateOnly(dateStr).getDay();
  await db.transaction(async function (tx) {
    for (var i = 0; i < hourStates.length; i += 1) {
      var entry = hourStates[i];
      const weekly = await weeklyEnabled(userId, dow, entry.startHour);
      if (entry.enabled === weekly) {
        await tx.run(
          "DELETE FROM date_availability_overrides WHERE user_id = ? AND date = ? AND start_hour = ?",
          [userId, dateStr, entry.startHour]
        );
      } else {
        await tx.run(
          `INSERT INTO date_availability_overrides (user_id, date, start_hour, enabled)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, date, start_hour) DO UPDATE SET enabled = excluded.enabled`,
          [userId, dateStr, entry.startHour, entry.enabled ? 1 : 0]
        );
      }
    }
  });
  await syncGeneratedSlotsForDate(userId, dateStr);
}

async function clearDateOverrides(userId, dateStr) {
  await db.run("DELETE FROM date_availability_overrides WHERE user_id = ? AND date = ?", [
    userId,
    dateStr
  ]);
  await syncGeneratedSlotsForDate(userId, dateStr);
}

function slotTimesForHour(dateStr, startHour) {
  const startAt = wallClockIso(dateStr, startHour, 0);
  const endAt = addMinutesToWallClock(startAt, SCHEDULE_SLOT_MINUTES);
  return { startAt: startAt, endAt: endAt };
}

async function syncGeneratedSlotsForDate(userId, dateStr) {
  const nowIso = businessNowIso();

  for (var i = 0; i < SCHEDULE_START_HOURS.length; i += 1) {
    var startHour = SCHEDULE_START_HOURS[i];
    const { startAt, endAt } = slotTimesForHour(dateStr, startHour);
    const enabled = await isEffectivelyEnabled(userId, dateStr, startHour);

    const existing = await db.get(
      `
      SELECT s.id, s.generated, b.id AS booking_id
      FROM availability_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('pending', 'approved')
      WHERE s.user_id = ? AND s.start_at = ? AND s.end_at = ?
    `,
      [userId, startAt, endAt]
    );

    if (enabled) {
      if (!existing && startAt > nowIso) {
        await db.run(
          "INSERT INTO availability_slots (user_id, start_at, end_at, generated) VALUES (?, ?, ?, 1)",
          [userId, startAt, endAt]
        );
      }
      continue;
    }

    if (existing && existing.generated === 1 && !existing.booking_id) {
      await db.run("DELETE FROM availability_slots WHERE id = ?", [existing.id]);
    }
  }
}

async function syncGeneratedSlots(userId) {
  const horizon = scheduleHorizon();
  const cursor = parseDateOnly(horizon.from);
  const end = parseDateOnly(horizon.to);

  await db.run(
    `
    DELETE FROM availability_slots
    WHERE user_id = ?
      AND generated = 1
      AND id NOT IN (SELECT slot_id FROM bookings WHERE status IN ('pending', 'approved') AND slot_id IS NOT NULL)
      AND start_at >= ?
      AND start_at <= ?
  `,
    [userId, horizon.from + "T00:00:00", horizon.to + "T23:59:59"]
  );

  while (cursor <= end) {
    await syncGeneratedSlotsForDate(userId, formatDateOnly(cursor));
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

async function syncActiveUsersForDate(dateStr) {
  const users = await db.all("SELECT id FROM users WHERE active = 1");
  for (var i = 0; i < users.length; i += 1) {
    await syncGeneratedSlotsForDate(users[i].id, dateStr);
  }
}

async function isBookableSlot(userId, dateStr, startHour, nowIso) {
  if (!(await isEffectivelyEnabled(userId, dateStr, startHour))) {
    return false;
  }

  const { startAt, endAt } = slotTimesForHour(dateStr, startHour);
  if (startAt <= nowIso) {
    return false;
  }

  const row = await db.get(
    `
      SELECT b.id AS booking_id
      FROM availability_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('pending', 'approved')
      WHERE s.user_id = ? AND s.start_at = ? AND s.end_at = ?
    `,
    [userId, startAt, endAt]
  );

  if (!row) {
    return true;
  }

  return !row.booking_id;
}

async function dateHasAvailableSlots(dateStr, nowIso) {
  const users = await db.all("SELECT id FROM users WHERE active = 1");
  if (!users.length) {
    return false;
  }

  for (var u = 0; u < users.length; u += 1) {
    for (var h = 0; h < SCHEDULE_START_HOURS.length; h += 1) {
      if (await isBookableSlot(users[u].id, dateStr, SCHEDULE_START_HOURS[h], nowIso)) {
        return true;
      }
    }
  }
  return false;
}

async function getAvailableDates(from, to) {
  const horizon = scheduleHorizon();
  const rangeFrom = from && from >= horizon.from ? from : horizon.from;
  const rangeTo = to && to <= horizon.to ? to : horizon.to;
  const nowIso = businessNowIso();
  const dates = [];
  const cursor = parseDateOnly(rangeFrom);
  const end = parseDateOnly(rangeTo);

  while (cursor <= end) {
    const dateStr = formatDateOnly(cursor);
    if (await dateHasAvailableSlots(dateStr, nowIso)) {
      dates.push(dateStr);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

async function getPublicSlotsForDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("INVALID_DATE");
  }

  const horizon = scheduleHorizon();
  if (dateStr < horizon.from || dateStr > horizon.to) {
    throw new Error("DATE_OUT_OF_RANGE");
  }

  await syncActiveUsersForDate(dateStr);

  const dayStart = dateStr + "T00:00:00";
  const dayEnd = dateStr + "T23:59:59";
  const nowIso = businessNowIso();

  return db.all(
    `
      SELECT s.id, s.start_at, s.end_at, u.name AS employee_name
      FROM availability_slots s
      JOIN users u ON u.id = s.user_id AND u.active = 1
      LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('pending', 'approved')
      WHERE b.id IS NULL
        AND s.generated = 1
        AND s.start_at >= ?
        AND s.start_at <= ?
        AND s.start_at > ?
      ORDER BY s.start_at
    `,
    [dayStart, dayEnd, nowIso]
  );
}

async function syncAllActiveUsers() {
  const users = await db.all("SELECT id FROM users WHERE active = 1");
  for (var i = 0; i < users.length; i += 1) {
    await syncGeneratedSlots(users[i].id);
  }
  return users.length;
}

async function resolveTargetUserId(req, bodyUserId) {
  if (req.user.role === "admin" && bodyUserId) {
    const targetUserId = Number(bodyUserId);
    const exists = await db.get("SELECT id FROM users WHERE id = ? AND active = 1", [targetUserId]);
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
  syncAllActiveUsers,
  syncActiveUsersForDate,
  getAvailableDates,
  getPublicSlotsForDate,
  normalizeEnabledSlots,
  normalizeHourStates,
  resolveTargetUserId
};
