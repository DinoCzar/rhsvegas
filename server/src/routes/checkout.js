const express = require("express");
const db = require("../db");
const { makeOrderId, isValidEmail, isWallClockPast } = require("../utils");
const { sendCheckoutEmails } = require("../services/email");
const { validateOrderItems } = require("../services/pricing");
const { checkoutLimiter } = require("../middleware/rate-limit");
const { BOOKING_STATUS } = require("../constants/bookings");

const router = express.Router();

const MAX_FIELD_LENGTH = 500;

router.post("/", checkoutLimiter, async (req, res) => {
  const order = req.body?.order || req.body;
  if (!order) {
    return res.status(400).json({ ok: false, error: "Missing order payload." });
  }

  const required = ["name", "address", "email", "phone", "slotId"];
  for (const field of required) {
    if (!order[field] || String(order[field]).trim() === "") {
      return res.status(400).json({ ok: false, error: "Missing required field: " + field });
    }
  }

  if (!isValidEmail(order.email)) {
    return res.status(400).json({ ok: false, error: "Invalid email address." });
  }

  for (const field of ["name", "address", "phone"]) {
    if (String(order[field]).trim().length > MAX_FIELD_LENGTH) {
      return res.status(400).json({ ok: false, error: "Field too long: " + field });
    }
  }

  let validatedItems;
  try {
    validatedItems = validateOrderItems(order.items);
  } catch (err) {
    if (err.message === "UNKNOWN_ITEM") {
      return res.status(400).json({ ok: false, error: "One or more cart items are not valid services." });
    }
    if (err.message === "INVALID_PRICE") {
      return res.status(400).json({ ok: false, error: "Cart prices do not match our service list. Please refresh and try again." });
    }
    return res.status(400).json({ ok: false, error: "Invalid cart items." });
  }

  const slotId = Number(order.slotId);
  const orderId = makeOrderId();

  const book = db.transaction(function () {
    const slot = db
      .prepare(
        `
        SELECT s.*, u.name AS employee_name
        FROM availability_slots s
        JOIN users u ON u.id = s.user_id AND u.active = 1
        WHERE s.id = ?
      `
      )
      .get(slotId);

    if (!slot) {
      throw new Error("SLOT_NOT_FOUND");
    }

    if (slot.generated !== 1) {
      throw new Error("SLOT_NOT_PUBLIC");
    }

    const existing = db
      .prepare(
        "SELECT id FROM bookings WHERE slot_id = ? AND status IN ('pending', 'approved')"
      )
      .get(slotId);
    if (existing) {
      throw new Error("SLOT_TAKEN");
    }

    if (isWallClockPast(slot.start_at)) {
      throw new Error("SLOT_PAST");
    }

    db.prepare(
      `
      INSERT INTO bookings (
        order_id, slot_id, user_id,
        customer_name, customer_email, customer_phone, customer_address,
        items_json, estimated_total, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      orderId,
      slotId,
      slot.user_id,
      order.name.trim(),
      order.email.trim().toLowerCase(),
      order.phone.trim(),
      order.address.trim(),
      JSON.stringify(validatedItems.items),
      validatedItems.estimatedTotal,
      BOOKING_STATUS.PENDING
    );

    return { slot: slot, orderId: orderId };
  });

  try {
    const result = book();
    const slot = result.slot;
    const id = result.orderId;

    const booking = {
      order_id: id,
      customer_name: order.name.trim(),
      customer_email: order.email.trim(),
      customer_phone: order.phone.trim(),
      customer_address: order.address.trim(),
      estimated_total: validatedItems.estimatedTotal,
      start_at: slot.start_at,
      end_at: slot.end_at
    };

    res.json({
      ok: true,
      orderId: id,
      status: BOOKING_STATUS.PENDING,
      appointmentStart: slot.start_at,
      employeeName: slot.employee_name
    });

    sendCheckoutEmails(booking, validatedItems.items, slot.employee_name).catch(function (emailErr) {
      console.error("[email] Failed to send checkout emails:", emailErr.message);
    });
  } catch (err) {
    const code = err.message;
    if (code === "SLOT_NOT_FOUND") {
      return res.status(404).json({ ok: false, error: "Selected time slot not found." });
    }
    if (code === "SLOT_NOT_PUBLIC") {
      return res.status(400).json({ ok: false, error: "Selected time slot is not available for booking." });
    }
    if (code === "SLOT_TAKEN") {
      return res.status(409).json({ ok: false, error: "That time was just requested. Please choose another." });
    }
    if (code === "SLOT_PAST") {
      return res.status(400).json({ ok: false, error: "That time slot is no longer available." });
    }
    throw err;
  }
});

module.exports = router;
