const express = require("express");
const db = require("../db");
const { authRequired, adminRequired } = require("../middleware/auth");
const { BOOKING_STATUS } = require("../constants/bookings");
const { formatAppointmentTime, formatDateTimeLong } = require("../utils");
const { sendBookingConfirmationEmail, sendNewBookingRequestEmail } = require("../services/email");

const router = express.Router();

function bookingToResponse(row) {
  var items = [];
  try {
    items = JSON.parse(row.items_json || "[]");
  } catch (err) {
    items = [];
  }

  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    estimatedTotal: row.estimated_total,
    items: items,
    appointmentStart: row.start_at,
    appointmentEnd: row.end_at,
    appointmentLabel: formatDateTimeLong(row.start_at),
    appointmentTime: formatAppointmentTime(row.start_at),
    employeeName: row.employee_name,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

function getBookingById(bookingId) {
  return db
    .prepare(
      `
      SELECT b.*, s.start_at, s.end_at, u.name AS employee_name
      FROM bookings b
      JOIN availability_slots s ON s.id = b.slot_id
      JOIN users u ON u.id = b.user_id
      WHERE b.id = ?
    `
    )
    .get(bookingId);
}

/** Admin: list booking requests */
router.get("/requests", authRequired, adminRequired, (req, res) => {
  const status = req.query.status || BOOKING_STATUS.PENDING;
  const allowed = [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.DENIED, "all"];
  if (allowed.indexOf(status) === -1) {
    return res.status(400).json({ ok: false, error: "Invalid status filter." });
  }

  let sql = `
    SELECT b.*, s.start_at, s.end_at, u.name AS employee_name
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN users u ON u.id = b.user_id
  `;
  const params = [];

  if (status !== "all") {
    sql += " WHERE b.status = ?";
    params.push(status);
  }

  sql += " ORDER BY b.created_at DESC";

  const rows = db.prepare(sql).all(...params);
  res.json({
    ok: true,
    bookings: rows.map(bookingToResponse)
  });
});

/** Admin: approve a pending booking request */
router.post("/:id/approve", authRequired, adminRequired, async (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = getBookingById(bookingId);

  if (!booking) {
    return res.status(404).json({ ok: false, error: "Booking request not found." });
  }
  if (booking.status !== BOOKING_STATUS.PENDING) {
    return res.status(409).json({ ok: false, error: "Only pending requests can be approved." });
  }

  db.prepare(
    `
    UPDATE bookings
    SET status = ?, reviewed_at = datetime('now'), reviewed_by = ?
    WHERE id = ?
  `
  ).run(BOOKING_STATUS.APPROVED, req.user.id, bookingId);

  const items = JSON.parse(booking.items_json || "[]");

  try {
    await sendBookingConfirmationEmail(booking, items, booking.employee_name);
  } catch (emailErr) {
    console.error("[email] Failed to send confirmation:", emailErr.message);
  }

  res.json({
    ok: true,
    booking: bookingToResponse(getBookingById(bookingId))
  });
});

/** Admin: deny a pending booking request */
router.post("/:id/deny", authRequired, adminRequired, (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = getBookingById(bookingId);

  if (!booking) {
    return res.status(404).json({ ok: false, error: "Booking request not found." });
  }
  if (booking.status !== BOOKING_STATUS.PENDING) {
    return res.status(409).json({ ok: false, error: "Only pending requests can be denied." });
  }

  db.prepare("DELETE FROM bookings WHERE id = ?").run(bookingId);

  res.json({ ok: true });
});

module.exports = router;
