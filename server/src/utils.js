const config = require("./config");

/** Appointment times are stored as business-local wall clock: YYYY-MM-DDTHH:mm:ss */
function parseWallClock(iso) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    y: Number(match[1]),
    mo: Number(match[2]),
    d: Number(match[3]),
    h: Number(match[4]),
    mi: Number(match[5]),
    s: Number(match[6])
  };
}

function wallClockIso(dateStr, hour, minute) {
  const pad = (n) => String(n).padStart(2, "0");
  return dateStr + "T" + pad(hour) + ":" + pad(minute || 0) + ":00";
}

function wallClockFromTime(dateStr, timeStr) {
  const parts = timeStr.split(":");
  return wallClockIso(dateStr, Number(parts[0]), Number(parts[1] || 0));
}

function businessNowIso() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  function get(type) {
    return parts.find(function (p) {
      return p.type === type;
    }).value;
  }

  return (
    get("year") +
    "-" +
    get("month") +
    "-" +
    get("day") +
    "T" +
    get("hour") +
    ":" +
    get("minute") +
    ":" +
    get("second")
  );
}

function isWallClockPast(iso) {
  return iso <= businessNowIso();
}

function formatAppointmentTime(iso) {
  const parsed = parseWallClock(iso);
  if (!parsed) {
    return iso;
  }
  const h12 = parsed.h % 12 || 12;
  const ampm = parsed.h < 12 ? "AM" : "PM";
  return h12 + ":" + String(parsed.mi).padStart(2, "0") + " " + ampm;
}

function formatSlotLabel(startIso) {
  return formatAppointmentTime(startIso);
}

function formatDateTimeLong(iso) {
  const parsed = parseWallClock(iso);
  if (!parsed) {
    return iso;
  }

  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC"
  }).format(Date.UTC(parsed.y, parsed.mo - 1, parsed.d, 12, 0, 0));

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(Date.UTC(parsed.y, parsed.mo - 1, parsed.d, 12, 0, 0));

  return weekday + ", " + datePart + ", " + formatAppointmentTime(iso) + " PT";
}

function makeOrderId() {
  const now = businessNowIso().replace(/[-:T]/g, "");
  return "RHS-" + now.slice(0, 8) + "-" + now.slice(8, 14);
}

function parseLocalDateTime(dateStr, timeStr) {
  return wallClockFromTime(dateStr, timeStr);
}

function toIsoLocal(value) {
  if (typeof value === "string") {
    return value;
  }
  throw new Error("toIsoLocal expects a wall-clock ISO string.");
}

function addMinutesToWallClock(iso, minutes) {
  const parsed = parseWallClock(iso);
  if (!parsed) {
    return iso;
  }
  const total = parsed.h * 60 + parsed.mi + minutes;
  const dayOffset = Math.floor(total / (24 * 60));
  const remaining = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(remaining / 60);
  const minute = remaining % 60;
  const base = new Date(Date.UTC(parsed.y, parsed.mo - 1, parsed.d + dayOffset, 12, 0, 0));
  const dateStr =
    base.getUTCFullYear() +
    "-" +
    String(base.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(base.getUTCDate()).padStart(2, "0");
  return wallClockIso(dateStr, hour, minute);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  formatSlotLabel,
  formatAppointmentTime,
  formatDateTimeLong,
  makeOrderId,
  parseLocalDateTime,
  toIsoLocal,
  wallClockIso,
  wallClockFromTime,
  businessNowIso,
  isWallClockPast,
  addMinutesToWallClock,
  parseWallClock,
  isValidEmail
};
