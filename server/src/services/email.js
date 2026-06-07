const nodemailer = require("nodemailer");
const config = require("../config");
const { formatDateTimeLong } = require("../utils");

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

async function sendBookingEmails(booking, items, employeeName) {
  const lines = items
    .map((item, i) => {
      const label = item.priceLabel || "$" + (item.price || 0);
      return `${i + 1}. ${item.name} — ${label}`;
    })
    .join("\n");

  const appointment = formatDateTimeLong(booking.start_at);
  const ownerBody = [
    `New service request — ${config.businessName}`,
    "",
    `Order ID: ${booking.order_id}`,
    "",
    "CUSTOMER",
    `Name: ${booking.customer_name}`,
    `Email: ${booking.customer_email}`,
    `Phone: ${booking.customer_phone}`,
    `Address: ${booking.customer_address}`,
    "",
    "SERVICES",
    lines,
    "",
    `Estimated total: $${Number(booking.estimated_total).toFixed(0)}`,
    "Note: No payment collected online.",
    "",
    "APPOINTMENT",
    `${appointment}`,
    `Assigned to: ${employeeName}`,
    "",
    `Submitted: ${new Date().toLocaleString("en-US", { timeZone: config.timezone })}`
  ].join("\n");

  const customerBody = [
    `Hi ${booking.customer_name},`,
    "",
    `Thank you for choosing ${config.businessName}.`,
    "",
    `We received your service request (${booking.order_id}).`,
    "",
    "Requested services:",
    lines,
    "",
    `Appointment: ${appointment}`,
    "",
    "No payment is due now. We will confirm your appointment shortly.",
    "",
    `— ${config.businessName}`
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
      subject: `New booking ${booking.order_id} — ${booking.customer_name}`,
      text: ownerBody
    });
  }

  await transport.sendMail({
    from: config.smtp.from,
    to: booking.customer_email,
    subject: `We received your service request — ${config.businessName}`,
    text: customerBody
  });

  return { sent: true };
}

module.exports = { sendBookingEmails };
