const nodemailer = require("nodemailer");
const config = require("../config");
const { formatDateTimeLong, businessNowIso } = require("../utils");

let transporter = null;

function isEmailConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

function getOwnerEmail() {
  return (config.ownerEmail || config.smtp.user || "").trim();
}

function getFromAddress() {
  var from = (config.smtp.from || "").trim();
  if (!from || from.indexOf("@") === -1) {
    return config.smtp.user;
  }
  return from;
}

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      requireTLS: config.smtp.port === 587,
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
      var label = item.priceLabel || "$" + (item.price || 0);
      return i + 1 + ". " + item.name + " — " + label;
    })
    .join("\n");
}

async function sendMail(options) {
  var transport = getTransporter();
  if (!transport) {
    throw new Error("SMTP is not configured on the server.");
  }

  await transport.sendMail(
    Object.assign(
      {
        from: getFromAddress()
      },
      options
    )
  );
}

async function sendNewBookingRequestEmail(booking, items, employeeName) {
  var lines = formatItemsList(items);
  var appointment = formatDateTimeLong(booking.start_at);
  var ownerEmail = getOwnerEmail();
  var ownerBody = [
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

  if (!isEmailConfigured()) {
    console.warn("[email] SMTP not configured — owner notification was not sent.");
    console.log(ownerBody);
    return { sent: false, reason: "smtp_not_configured" };
  }

  if (!ownerEmail) {
    console.warn("[email] OWNER_EMAIL is not set — owner notification was not sent.");
    console.log(ownerBody);
    return { sent: false, reason: "owner_email_missing" };
  }

  await sendMail({
    to: ownerEmail,
    subject: "Booking request " + booking.order_id + " — " + booking.customer_name,
    text: ownerBody
  });

  return { sent: true };
}

async function sendBookingRequestReceivedEmail(booking, items) {
  var lines = formatItemsList(items);
  var appointment = formatDateTimeLong(booking.start_at);
  var customerBody = [
    "Hi " + booking.customer_name + ",",
    "",
    "Thank you for choosing " + config.businessName + ".",
    "",
    "We received your booking request (" + booking.order_id + ").",
    "",
    "Requested services:",
    lines,
    "",
    "Requested appointment: " + appointment,
    "",
    "Your request is pending review. We will email you again once your appointment is confirmed.",
    "",
    "No payment is due now.",
    "",
    "— " + config.businessName
  ].join("\n");

  if (!isEmailConfigured()) {
    console.warn("[email] SMTP not configured — customer request email was not sent.");
    return { sent: false, reason: "smtp_not_configured" };
  }

  await sendMail({
    to: booking.customer_email,
    subject: "We received your booking request — " + config.businessName,
    text: customerBody
  });

  return { sent: true };
}

async function sendBookingConfirmationEmail(booking, items, employeeName) {
  var lines = formatItemsList(items);
  var appointment = formatDateTimeLong(booking.start_at);
  var customerBody = [
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

  if (!isEmailConfigured()) {
    console.warn("[email] SMTP not configured — confirmation email was not sent.");
    console.log(customerBody);
    return { sent: false, reason: "smtp_not_configured" };
  }

  await sendMail({
    to: booking.customer_email,
    subject: "Appointment confirmed — " + config.businessName,
    text: customerBody
  });

  return { sent: true };
}

async function sendCheckoutEmails(booking, items, employeeName) {
  var ownerResult = await sendNewBookingRequestEmail(booking, items, employeeName);
  var customerResult = await sendBookingRequestReceivedEmail(booking, items);
  return {
    owner: ownerResult,
    customer: customerResult
  };
}

module.exports = {
  isEmailConfigured,
  sendNewBookingRequestEmail,
  sendBookingRequestReceivedEmail,
  sendBookingConfirmationEmail,
  sendCheckoutEmails
};
