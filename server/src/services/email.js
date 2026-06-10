const nodemailer = require("nodemailer");
const config = require("../config");
const { formatDateTimeLong, businessNowIso } = require("../utils");

let transporter = null;

function getTransporter() {
  if (!config.smtp.host || !config.smtp.user) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }
  return transporter;
}

function formatItemsList(items) {
  return items
    .map(function (item, i) {
      const label = item.priceLabel || "$" + (item.price || 0);
      return i + 1 + ". " + item.name + " — " + label;
    })
    .join("\n");
}

async function sendNewBookingRequestEmail(booking, items, employeeName) {
  const lines = formatItemsList(items);
  const appointment = formatDateTimeLong(booking.start_at);
  const ownerBody = [
    "New booking request — " + config.businessName,
    "",
    "Order ID: " + booking.order_id,
    "Status: Pending approval",
    "",
    "CUSTOMER",
    "Name: " + booking.customer_name,
    "Email: " + booking.customer_email,
    "Phone: " + booking.customer_phone,
    "Address: " + booking.customer_address,
    "",
    "SERVICES",
    lines,
    "",
    "Estimated total: $" + Number(booking.estimated_total).toFixed(0),
    "Note: No payment collected online.",
    "",
    "REQUESTED APPOINTMENT",
    appointment,
    "Assigned to: " + employeeName,
    "",
    "Review and approve or deny this request in the staff portal.",
    "",
    "Submitted: " + businessNowIso().replace("T", " ") + " PT"
  ].join("\n");

  const transport = getTransporter();
  if (!transport) {
    console.log("[email] SMTP not configured. Owner notification:\n", ownerBody);
    return { sent: false };
  }

  if (config.ownerEmail) {
    await transport.sendMail({
      from: config.smtp.from,
      to: config.ownerEmail,
      subject: "Booking request " + booking.order_id + " — " + booking.customer_name,
      text: ownerBody
    });
  }

  return { sent: true };
}

async function sendBookingConfirmationEmail(booking, items, employeeName) {
  const lines = formatItemsList(items);
  const appointment = formatDateTimeLong(booking.start_at);
  const customerBody = [
    "Hi " + booking.customer_name + ",",
    "",
    "Your appointment with " + config.businessName + " is confirmed.",
    "",
    "Order ID: " + booking.order_id,
    "",
    "Services:",
    lines,
    "",
    "Appointment: " + appointment,
    "",
    "No payment is due now. We look forward to seeing you.",
    "",
    "— " + config.businessName
  ].join("\n");

  const transport = getTransporter();
  if (!transport) {
    console.log("[email] SMTP not configured. Customer confirmation:\n", customerBody);
    return { sent: false };
  }

  await transport.sendMail({
    from: config.smtp.from,
    to: booking.customer_email,
    subject: "Appointment confirmed — " + config.businessName,
    text: customerBody
  });

  return { sent: true };
}

/** @deprecated Use sendNewBookingRequestEmail + sendBookingConfirmationEmail */
async function sendBookingEmails(booking, items, employeeName) {
  await sendNewBookingRequestEmail(booking, items, employeeName);
  return sendBookingConfirmationEmail(booking, items, employeeName);
}

module.exports = {
  sendNewBookingRequestEmail,
  sendBookingConfirmationEmail,
  sendBookingEmails
};
