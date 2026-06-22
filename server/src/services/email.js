const nodemailer = require("nodemailer");
const config = require("../config");
const { formatDateTimeLong, businessNowIso } = require("../utils");

let transporter = null;

function getEmailProvider() {
  if (config.resend.apiKey) {
    return "resend";
  }
  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    return "smtp";
  }
  return null;
}

function isEmailConfigured() {
  return Boolean(getEmailProvider());
}

function getOwnerEmail() {
  return (config.ownerEmail || config.smtp.user || "").trim();
}

function getFromAddress() {
  var from = (config.emailFrom || config.smtp.from || "").trim();
  if (from && from.indexOf("@") !== -1) {
    return from;
  }
  if (config.smtp.user) {
    return config.smtp.user;
  }
  return "";
}

function formatFromHeader() {
  var address = getFromAddress();
  if (!address) {
    return config.businessName + " <onboarding@resend.dev>";
  }
  if (address.indexOf("<") !== -1) {
    return address;
  }
  return config.businessName + " <" + address + ">";
}

function getTransporter() {
  if (getEmailProvider() !== "smtp") {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      requireTLS: config.smtp.port === 587,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
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
      var line = i + 1 + ". " + item.name + " — " + label;
      if (item.taskDescription) {
        line += "\n   Task: " + item.taskDescription;
      }
      return line;
    })
    .join("\n");
}

async function sendViaResend(options) {
  var response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.resend.apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: formatFromHeader(),
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      text: options.text
    })
  });

  var data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    var detail = data.message || data.error || "Resend API error " + response.status;
    console.error("[email] Resend send failed:", detail);
    throw new Error(detail);
  }

  return data;
}

async function sendViaSmtp(options) {
  var transport = getTransporter();
  if (!transport) {
    throw new Error("SMTP is not configured on the server.");
  }

  try {
    await transport.sendMail(
      Object.assign(
        {
          from: getFromAddress()
        },
        options
      )
    );
  } catch (err) {
    var detail = err.response || err.message || String(err);
    console.error("[email] SMTP send failed:", detail);
    throw err;
  }
}

async function sendMail(options) {
  if (getEmailProvider() === "resend") {
    return sendViaResend(options);
  }
  if (getEmailProvider() === "smtp") {
    return sendViaSmtp(options);
  }
  throw new Error("Email is not configured on the server.");
}

function getEmailStatus() {
  var ownerEmail = getOwnerEmail();
  var provider = getEmailProvider();
  return {
    configured: Boolean(provider),
    provider: provider,
    ownerEmailSet: Boolean(ownerEmail),
    smtpHost: config.smtp.host || null,
    smtpPort: config.smtp.port || null,
    smtpUser: config.smtp.user || null,
    fromAddress: provider ? getFromAddress() || null : null,
    ownerEmail: ownerEmail || null,
    resendConfigured: Boolean(config.resend.apiKey)
  };
}

async function verifySmtpConnection() {
  var provider = getEmailProvider();
  if (!provider) {
    return { ok: false, reason: "email_not_configured" };
  }

  if (provider === "resend") {
    return { ok: true, provider: "resend" };
  }

  var transport = getTransporter();
  try {
    await transport.verify();
    return { ok: true, provider: "smtp" };
  } catch (err) {
    var detail = err.response || err.message || String(err);
    console.error("[email] SMTP connection test failed:", detail);
    return { ok: false, reason: "smtp_connection_failed", detail: detail, provider: "smtp" };
  }
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
    console.warn("[email] Email not configured — owner notification was not sent for", booking.order_id);
    return { sent: false, reason: "email_not_configured" };
  }

  if (!ownerEmail) {
    console.warn("[email] OWNER_EMAIL is not set — owner notification was not sent for", booking.order_id);
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
    console.warn("[email] Email not configured — customer request email was not sent.");
    return { sent: false, reason: "email_not_configured" };
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
    console.warn("[email] Email not configured — confirmation email was not sent for", booking.order_id);
    return { sent: false, reason: "email_not_configured" };
  }

  await sendMail({
    to: booking.customer_email,
    subject: "Appointment confirmed — " + config.businessName,
    text: customerBody
  });

  return { sent: true };
}

async function sendCheckoutEmails(booking, items, employeeName) {
  var ownerResult;
  var customerResult;

  try {
    ownerResult = await sendNewBookingRequestEmail(booking, items, employeeName);
  } catch (err) {
    console.error("[email] Owner notification failed:", err.message);
    ownerResult = { sent: false, reason: "send_failed", error: err.message };
  }

  try {
    customerResult = await sendBookingRequestReceivedEmail(booking, items);
  } catch (err) {
    console.error("[email] Customer request email failed:", err.message);
    customerResult = { sent: false, reason: "send_failed", error: err.message };
  }

  console.log("[email] Checkout emails:", {
    orderId: booking.order_id,
    owner: ownerResult,
    customer: customerResult
  });

  return {
    owner: ownerResult,
    customer: customerResult
  };
}

async function sendTestEmail(to) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "email_not_configured" };
  }

  await sendMail({
    to: to,
    subject: "RHS Vegas email test — " + config.businessName,
    text: [
      "This is a test email from your Ryan's Home Solutions booking server.",
      "",
      "If you received this, email delivery is working correctly.",
      "",
      "Provider: " + getEmailProvider(),
      "Sent: " + businessNowIso().replace("T", " ") + " PT"
    ].join("\n")
  });

  return { sent: true, to: to, provider: getEmailProvider() };
}

module.exports = {
  isEmailConfigured,
  getEmailStatus,
  verifySmtpConnection,
  sendNewBookingRequestEmail,
  sendBookingRequestReceivedEmail,
  sendBookingConfirmationEmail,
  sendCheckoutEmails,
  sendTestEmail
};
