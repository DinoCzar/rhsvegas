/**
 * Ryan's Home Solutions - Order & Booking Backend
 *
 * Deploy as a Google Apps Script web app:
 * 1. script.google.com -> New project -> paste this file
 * 2. Set CONFIG values below
 * 3. Enable Calendar API (Services -> Google Calendar API)
 * 4. Deploy -> New deployment -> Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the web app URL into js/config.js as apiUrl
 */

var CONFIG = {
  OWNER_EMAIL: "YOUR_EMAIL@example.com",
  OWNER_PHONE: "+17025551234",
  SEND_SMS: false,
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  TWILIO_FROM_NUMBER: "",

  CALENDAR_ID: "primary",
  TIMEZONE: "America/Los_Angeles",
  BUSINESS_START_HOUR: 8,
  BUSINESS_END_HOUR: 18,
  SLOT_MINUTES: 120,
  MIN_BOOKING_HOURS_AHEAD: 24,
  MAX_BOOKING_DAYS_AHEAD: 60,

  BUSINESS_NAME: "Ryan's Home Solutions"
};

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";

  if (action === "availability") {
    return jsonResponse(getAvailability_(e.parameter.date));
  }

  return jsonResponse({
    ok: true,
    message: "RHS Vegas booking API is running."
  });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === "checkout") {
      return jsonResponse(processCheckout_(data.order));
    }

    return jsonResponse({ ok: false, error: "Unknown action." });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAvailability_(dateStr) {
  if (!dateStr) {
    return { ok: false, error: "Missing date parameter." };
  }

  var parts = dateStr.split("-");
  if (parts.length !== 3) {
    return { ok: false, error: "Invalid date format. Use YYYY-MM-DD." };
  }

  var year = Number(parts[0]);
  var month = Number(parts[1]) - 1;
  var day = Number(parts[2]);

  var timeZone = CONFIG.TIMEZONE;
  var dayStart = new Date(year, month, day, CONFIG.BUSINESS_START_HOUR, 0, 0);
  var dayEnd = new Date(year, month, day, CONFIG.BUSINESS_END_HOUR, 0, 0);
  var now = new Date();
  var minStart = new Date(now.getTime() + CONFIG.MIN_BOOKING_HOURS_AHEAD * 60 * 60 * 1000);
  var maxDate = new Date(now.getTime() + CONFIG.MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  if (dayStart > maxDate) {
    return { ok: true, date: dateStr, slots: [] };
  }

  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var events = calendar.getEvents(dayStart, dayEnd);
  var busy = events.map(function (event) {
    return { start: event.getStartTime(), end: event.getEndTime() };
  });

  var slots = [];
  var slotMs = CONFIG.SLOT_MINUTES * 60 * 1000;
  var cursor = new Date(dayStart.getTime());

  while (cursor.getTime() + slotMs <= dayEnd.getTime()) {
    var slotEnd = new Date(cursor.getTime() + slotMs);
    var slotStart = new Date(cursor.getTime());

    if (slotStart >= minStart && !overlapsBusy_(slotStart, slotEnd, busy)) {
      slots.push({
        start: Utilities.formatDate(slotStart, timeZone, "yyyy-MM-dd'T'HH:mm:ss"),
        label: Utilities.formatDate(slotStart, timeZone, "h:mm a") + " – " +
          Utilities.formatDate(slotEnd, timeZone, "h:mm a")
      });
    }

    cursor = new Date(cursor.getTime() + slotMs);
  }

  return { ok: true, date: dateStr, slots: slots };
}

function overlapsBusy_(start, end, busy) {
  for (var i = 0; i < busy.length; i++) {
    if (start < busy[i].end && end > busy[i].start) {
      return true;
    }
  }
  return false;
}

function processCheckout_(order) {
  if (!order) {
    return { ok: false, error: "Missing order payload." };
  }

  var required = ["name", "address", "email", "phone"];
  for (var i = 0; i < required.length; i++) {
    if (!order[required[i]] || String(order[required[i]]).trim() === "") {
      return { ok: false, error: "Missing required field: " + required[i] };
    }
  }

  if (!order.items || !order.items.length) {
    return { ok: false, error: "Cart is empty." };
  }

  var orderId = "RHS-" + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmmss");
  var lines = order.items.map(function (item, index) {
    var priceLabel = item.priceLabel || formatMoneyLabel_(item.price);
    return (index + 1) + ". " + item.name + " — " + priceLabel;
  }).join("\n");

  var appointmentLine = "Not selected";
  var calendarEventId = "";

  if (order.appointmentStart) {
    appointmentLine = formatAppointmentLabel_(order.appointmentStart);
    var event = createCalendarEvent_(order, orderId, lines);
    calendarEventId = event.getId();
    appointmentLine = appointmentLine + " (added to Google Calendar)";
  }

  var ownerBody = [
    "New service request — " + CONFIG.BUSINESS_NAME,
    "",
    "Order ID: " + orderId,
    "",
    "CUSTOMER",
    "Name: " + order.name,
    "Email: " + order.email,
    "Phone: " + order.phone,
    "Address: " + order.address,
    "",
    "SERVICES",
    lines,
    "",
    "Estimated total: " + formatMoneyLabel_(order.estimatedTotal || 0),
    "Note: No payment collected online.",
    "",
    "APPOINTMENT",
    appointmentLine,
    "",
    "Submitted: " + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "MMM d, yyyy h:mm a z")
  ].join("\n");

  MailApp.sendEmail({
    to: CONFIG.OWNER_EMAIL,
    subject: "New booking request " + orderId + " — " + order.name,
    body: ownerBody
  });

  var customerBody = [
    "Hi " + order.name + ",",
    "",
    "Thank you for choosing " + CONFIG.BUSINESS_NAME + ".",
    "",
    "We received your service request (" + orderId + ").",
    "",
    "Requested services:",
    lines,
    "",
    "Appointment: " + (order.appointmentStart ? formatAppointmentLabel_(order.appointmentStart) : "We will contact you to schedule."),
    "",
    "No payment is due now. We will confirm your appointment shortly.",
    "",
    "— " + CONFIG.BUSINESS_NAME
  ].join("\n");

  MailApp.sendEmail({
    to: order.email,
    subject: "We received your service request — " + CONFIG.BUSINESS_NAME,
    body: customerBody
  });

  if (CONFIG.SEND_SMS && CONFIG.OWNER_PHONE) {
    sendOwnerSms_(orderId, order.name, order.appointmentStart);
  }

  return {
    ok: true,
    orderId: orderId,
    calendarEventId: calendarEventId
  };
}

function createCalendarEvent_(order, orderId, serviceLines) {
  var start = parseLocalDateTime_(order.appointmentStart);
  var end = new Date(start.getTime() + CONFIG.SLOT_MINUTES * 60 * 1000);
  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);

  var description = [
    "Order ID: " + orderId,
    "Customer: " + order.name,
    "Email: " + order.email,
    "Phone: " + order.phone,
    "Address: " + order.address,
    "",
    "Services:",
    serviceLines
  ].join("\n");

  return calendar.createEvent(
    "RHS Service — " + order.name,
    start,
    end,
    {
      description: description,
      location: order.address
    }
  );
}

function parseLocalDateTime_(value) {
  var parts = value.split("T");
  var dateParts = parts[0].split("-");
  var timeParts = parts[1].split(":");
  return new Date(
    Number(dateParts[0]),
    Number(dateParts[1]) - 1,
    Number(dateParts[2]),
    Number(timeParts[0]),
    Number(timeParts[1]),
    Number(timeParts[2] || 0)
  );
}

function formatAppointmentLabel_(isoLocal) {
  var date = parseLocalDateTime_(isoLocal);
  return Utilities.formatDate(date, CONFIG.TIMEZONE, "EEEE, MMM d, yyyy h:mm a");
}

function formatMoneyLabel_(amount) {
  var value = Number(amount) || 0;
  if (value === 0) {
    return "Custom / TBD";
  }
  return "$" + value.toFixed(0);
}

function sendOwnerSms_(orderId, customerName, appointmentStart) {
  if (!CONFIG.TWILIO_ACCOUNT_SID || !CONFIG.TWILIO_AUTH_TOKEN || !CONFIG.TWILIO_FROM_NUMBER) {
    return;
  }

  var message = "New RHS booking " + orderId + " from " + customerName + ".";
  if (appointmentStart) {
    message += " Appt: " + formatAppointmentLabel_(appointmentStart) + ".";
  }

  var url = "https://api.twilio.com/2010-04-01/Accounts/" + CONFIG.TWILIO_ACCOUNT_SID + "/Messages.json";
  var payload = {
    To: CONFIG.OWNER_PHONE,
    From: CONFIG.TWILIO_FROM_NUMBER,
    Body: message
  };

  UrlFetchApp.fetch(url, {
    method: "post",
    payload: payload,
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(CONFIG.TWILIO_ACCOUNT_SID + ":" + CONFIG.TWILIO_AUTH_TOKEN)
    },
    muteHttpExceptions: true
  });
}
