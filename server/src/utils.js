const config = require("./config");

function formatSlotLabel(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts = { hour: "numeric", minute: "2-digit", timeZone: config.timezone };
  const fmt = new Intl.DateTimeFormat("en-US", opts);
  return fmt.format(start) + " – " + fmt.format(end);
}

function formatDateTimeLong(iso) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: config.timezone,
    timeZoneName: "short"
  }).format(date);
}

function makeOrderId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    "RHS-" +
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    "-" +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function parseLocalDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0);
}

function toIsoLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":00"
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  formatSlotLabel,
  formatDateTimeLong,
  makeOrderId,
  parseLocalDateTime,
  toIsoLocal,
  isValidEmail
};
