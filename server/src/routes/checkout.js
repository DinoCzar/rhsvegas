const express = require("express");
const db = require("../db");
const { makeOrderId, isValidEmail } = require("../utils");
const { sendBookingEmails } = require("../services/email");

const router = express.Router();

router.post("/", async (req, res) => {
  const order = req.body?.order || req.body;
  if (!order) {
    return res.status(400).json({ ok: false, error: "Missing order payload." });
  }

  const required = ["name", "address", "email", "phone", "slotId"];
  for (const field of required) {
    if (!order[field] || String(order[field]).trim() === "") {
      return res.status(400).json({ ok: false, error: `Missing required field: ${field}` });
    }
  }

  if (!isValidEmail(order.email)) {
    return res.status(400).json({ ok: false, error: "Invalid email address." });
  }

  if (!order.items || !order.items.length) {
    return res.status(400).json({ ok: false, error: "Cart is empty." });
  }

  const slotId = Number(order.slotId);
  const orderId = makeOrderId();

  const book = db.transaction(() => {
    const slot = db
      .prepare(
        `
        SELECT s.*, u.name AS employee_name
        FROM availability_slots s
        JOIN users u ON u.id = s.user_id AND u.active = 1
        LEFT JOIN bookings b ON b.slot_id = s.id
        WHERE s.id = ?
      `
      )
      .get(slotId);

    if (!slot) {
      throw new Error("SLOT_NOT_FOUND");
    }

    const existing = db.prepare("SELECT id FROM bookings WHERE slot_id = ?").get(slotId);
    if (existing) {
      throw new Error("SLOT_TAKEN");
    }

    if (new Date(slot.start_at) <= new Date()) {
      throw new Error("SLOT_PAST");
    }

    db.prepare(
      `
      INSERT INTO bookings (
        order_id, slot_id, user_id,
        customer_name, customer_email, customer_phone, customer_address,
        items_json, estimated_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      orderId,
      slotId,
      slot.user_id,
      order.name.trim(),
      order.email.trim().toLowerCase(),
      order.phone.trim(),
      order.address.trim(),
      JSON.stringify(order.items),
      Number(order.estimatedTotal) || 0
    );

    return { slot, orderId };
  });

  try {
    const { slot, orderId: id } = book();

    const booking = {
      order_id: id,
      customer_name: order.name.trim(),
      customer_email: order.email.trim(),
      customer_phone: order.phone.trim(),
      customer_address: order.address.trim(),
      estimated_total: Number(order.estimatedTotal) || 0,
      start_at: slot.start_at,
      end_at: slot.end_at
    };

    try {
      await sendBookingEmails(booking, order.items, slot.employee_name);
    } catch (emailErr) {
      console.error("[email] Failed to send:", emailErr.message);
    }

    res.json({
      ok: true,
      orderId: id,
      appointmentStart: slot.start_at,
      employeeName: slot.employee_name
    });
  } catch (err) {
    const code = err.message;
    if (code === "SLOT_NOT_FOUND") {
      return res.status(404).json({ ok: false, error: "Selected time slot not found." });
    }
    if (code === "SLOT_TAKEN") {
      return res.status(409).json({ ok: false, error: "That time was just booked. Please choose another." });
    }
    if (code === "SLOT_PAST") {
      return res.status(400).json({ ok: false, error: "That time slot is no longer available." });
    }
    throw err;
  }
});

module.exports = router;
