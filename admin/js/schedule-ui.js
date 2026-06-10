(function () {
  var SCHEDULE_WEEKS = 12;
  var START_HOURS = [9, 10, 11, 12];
  var DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var loginView = document.getElementById("login-view");
  var appView = document.getElementById("app-view");
  var userLabel = document.getElementById("user-label");
  var slotList = document.getElementById("slot-list");
  var listStatus = document.getElementById("list-status");
  var employeeWrap = document.getElementById("employee-select-wrap");
  var employeeSelect = document.getElementById("employee-select");
  var adminCard = document.getElementById("admin-employees-card");
  var weeklyGridBody = document.getElementById("weekly-grid-body");
  var weeklyStatus = document.getElementById("weekly-status");
  var dateStatus = document.getElementById("date-status");
  var overrideDateInput = document.getElementById("override-date");
  var dateOverrideTimes = document.getElementById("date-override-times");
  var dateSelectedLabel = document.getElementById("date-selected-label");

  var weeklyDraft = {};
  var dateDraft = [];

  function hourLabel(hour) {
    var h = Number(hour);
    if (h === 12) return "12pm";
    if (h < 12) return h + "am";
    return h - 12 + "pm";
  }

  function normalizeHourEntry(entry, fallback) {
    if (!entry) {
      return fallback;
    }
    var startHour = Number(entry.startHour != null ? entry.startHour : entry.start_hour);
    if (!startHour || START_HOURS.indexOf(startHour) === -1) {
      return fallback;
    }
    return {
      startHour: startHour,
      label: (entry && entry.label) || hourLabel(startHour),
      enabled: entry && entry.enabled != null ? Boolean(entry.enabled) : fallback.enabled,
      weeklyDefault:
        entry && entry.weeklyDefault != null
          ? Boolean(entry.weeklyDefault)
          : entry && entry.weekly_default != null
            ? Boolean(entry.weekly_default)
            : fallback.weeklyDefault,
      hasOverride:
        entry && entry.hasOverride != null
          ? Boolean(entry.hasOverride)
          : entry && entry.has_override != null
            ? Boolean(entry.has_override)
            : fallback.hasOverride
    };
  }

  function buildDateDraft(hours, dateStr) {
    var weeklyFallback = buildDateDraftFromWeekly(dateStr);
    var byHour = {};

    (hours || []).forEach(function (entry) {
      var startHour = Number(entry.startHour != null ? entry.startHour : entry.start_hour);
      if (START_HOURS.indexOf(startHour) !== -1) {
        byHour[startHour] = entry;
      }
    });

    return START_HOURS.map(function (startHour) {
      var fallback = weeklyFallback.find(function (item) {
        return item.startHour === startHour;
      });
      return normalizeHourEntry(byHour[startHour], fallback);
    });
  }

  function formatDisplayDate(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function dayOfWeekForDate(dateStr) {
    var parts = dateStr.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  }

  function weeklyDefaultForDate(dateStr) {
    return weeklyDraft[dayOfWeekForDate(dateStr)] || [];
  }

  function buildDateDraftFromWeekly(dateStr) {
    var weeklyHours = weeklyDefaultForDate(dateStr);
    return START_HOURS.map(function (startHour) {
      return {
        startHour: startHour,
        label: hourLabel(startHour),
        enabled: weeklyHours.indexOf(startHour) !== -1,
        weeklyDefault: weeklyHours.indexOf(startHour) !== -1,
        hasOverride: false
      };
    });
  }

  function formatDateInput(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function dateRange() {
    var from = new Date();
    from.setDate(from.getDate() + 1);
    var to = new Date();
    to.setDate(to.getDate() + SCHEDULE_WEEKS * 7);
    return {
      from: formatDateInput(from),
      to: formatDateInput(to)
    };
  }

  function setHorizonOnDateInput(input) {
    var range = dateRange();
    input.min = range.from;
    input.max = range.to;
    if (!input.value || input.value < range.from || input.value > range.to) {
      input.value = range.from;
    }
  }

  function selectedUserId() {
    var user = RHSAdmin.getUser();
    if (user.role === "admin" && employeeSelect.value) {
      return employeeSelect.value;
    }
    return null;
  }

  function formatAppointmentTimeFromIso(iso) {
    var match = String(iso).match(/T(\d{2}):(\d{2})/);
    if (!match) return iso;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    var h12 = hour % 12 || 12;
    var ampm = hour < 12 ? "AM" : "PM";
    return h12 + ":" + String(minute).padStart(2, "0") + " " + ampm;
  }

  function formatDisplayDateFromIso(iso) {
    var parts = String(iso).slice(0, 10).split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }

  function formatRange(start, end) {
    return formatDisplayDateFromIso(start) + " at " + formatAppointmentTimeFromIso(start);
  }

  function escapeHtml(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function isWeeklyChecked(day, hour) {
    var list = weeklyDraft[day] || [];
    return list.indexOf(hour) !== -1;
  }

  function renderWeeklyGrid() {
    weeklyGridBody.innerHTML = DAY_LABELS.map(function (label, day) {
      var cells = START_HOURS.map(function (hour) {
        var checked = isWeeklyChecked(day, hour) ? " checked" : "";
        return (
          '<td><label class="slot-toggle">' +
          '<input type="checkbox" data-weekly-day="' + day + '" data-weekly-hour="' + hour + '"' + checked + ">" +
          "<span></span></label></td>"
        );
      }).join("");
      return "<tr><th>" + label + "</th>" + cells + "</tr>";
    }).join("");
  }

  function collectWeeklyDraft() {
    var enabled = [];
    DAY_LABELS.forEach(function (_, day) {
      START_HOURS.forEach(function (hour) {
        if (isWeeklyChecked(day, hour)) {
          enabled.push({ dayOfWeek: day, startHour: hour });
        }
      });
    });
    return enabled;
  }

  function loadWeeklySchedule() {
    weeklyStatus.textContent = "Loading…";
    weeklyStatus.className = "status";
    RHSAdmin.fetchWeeklySchedule(selectedUserId())
      .then(function (res) {
        weeklyDraft = res.schedule.grid || {};
        renderWeeklyGrid();
        weeklyStatus.textContent = "";
        loadDateSchedule();
      })
      .catch(function (err) {
        weeklyStatus.textContent = err.message;
        weeklyStatus.className = "status error";
      });
  }

  function renderDateOverrides(hours) {
    if (!overrideDateInput.value) return;
    dateDraft = buildDateDraft(hours, overrideDateInput.value);
    paintDateTimePicker();
  }

  function paintDateTimePicker() {
    if (!overrideDateInput.value) {
      dateSelectedLabel.textContent = "";
      dateOverrideTimes.innerHTML = "";
      return;
    }

    dateSelectedLabel.textContent = formatDisplayDate(overrideDateInput.value);

    dateOverrideTimes.innerHTML = dateDraft
      .map(function (entry) {
        var selectedClass = entry.enabled ? " selected" : "";
        var overrideClass = entry.hasOverride ? " custom" : "";
        var weeklyHint = entry.weeklyDefault ? "Usually on" : "Usually off";
        return (
          '<button type="button" class="date-time-btn' + selectedClass + overrideClass + '" data-date-hour="' + entry.startHour + '" aria-pressed="' + entry.enabled + '">' +
          "<strong>" + escapeHtml(entry.label) + "</strong>" +
          '<span class="date-time-meta">' + escapeHtml(weeklyHint) + (entry.hasOverride ? " · custom" : "") + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function showDateTimesFromWeeklyDraft() {
    if (!overrideDateInput.value) return;
    dateDraft = buildDateDraftFromWeekly(overrideDateInput.value);
    paintDateTimePicker();
    dateStatus.textContent = "Choose which start times are available on this date.";
    dateStatus.className = "status";
  }

  function loadDateSchedule() {
    if (!overrideDateInput.value) {
      showDateTimesFromWeeklyDraft();
      return;
    }

    showDateTimesFromWeeklyDraft();
    dateStatus.textContent = "Loading times for " + formatDisplayDate(overrideDateInput.value) + "…";
    dateStatus.className = "status";

    RHSAdmin.fetchDateSchedule(overrideDateInput.value, selectedUserId())
      .then(function (res) {
        renderDateOverrides(res.day.hours);
        dateStatus.textContent = "Tap a time to turn it on or off, then save.";
        dateStatus.className = "status";
      })
      .catch(function (err) {
        dateStatus.textContent = err.message;
        dateStatus.className = "status error";
      });
  }

  function loadSlots() {
    var range = dateRange();
    var userId = selectedUserId();

    listStatus.textContent = "Loading…";
    listStatus.className = "status";
    slotList.innerHTML = "";

    RHSAdmin.fetchSlots(range.from, range.to, userId)
      .then(function (res) {
        listStatus.textContent = "";
        if (!res.slots.length) {
          listStatus.textContent = "No upcoming availability. Set your weekly schedule above.";
          return;
        }

        res.slots.forEach(function (slot) {
          var li = document.createElement("li");
          var badge = "";
          if (slot.booking_id) {
            if (slot.booking_status === "pending") {
              badge = '<span class="badge-pending">Pending ' + escapeHtml(slot.order_id || "") + "</span>";
            } else {
              badge = '<span class="badge-booked">Booked ' + escapeHtml(slot.order_id || "") + "</span>";
            }
          }
          li.innerHTML =
            "<div><strong>" + formatRange(slot.start_at, slot.end_at) + "</strong>" +
            (slot.employee_name ? '<div class="slot-meta">' + escapeHtml(slot.employee_name) + "</div>" : "") +
            "</div><div>" + badge + "</div>";
          slotList.appendChild(li);
        });
      })
      .catch(function (err) {
        listStatus.textContent = err.message;
        listStatus.className = "status error";
      });
  }

  function loadEmployees() {
    return RHSAdmin.listEmployees()
      .then(function (res) {
        employeeSelect.innerHTML = res.users
          .filter(function (u) { return u.active; })
          .map(function (u) {
            return '<option value="' + u.id + '">' + escapeHtml(u.name) + "</option>";
          })
          .join("");

        document.getElementById("employee-table-body").innerHTML = res.users
          .map(function (u) {
            return "<tr><td>" + escapeHtml(u.name) + "</td><td>" + escapeHtml(u.email) +
              "</td><td>" + escapeHtml(u.role) + "</td></tr>";
          })
          .join("");
      })
      .catch(function (err) {
        document.getElementById("employee-status").textContent = err.message;
      });
  }

  function reloadAll() {
    loadWeeklySchedule();
    loadDateSchedule();
    loadSlots();
  }

  function showApp() {
    var user = RHSAdmin.getUser();
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    userLabel.textContent = user.name + " (" + user.role + ")";

    setHorizonOnDateInput(overrideDateInput);
    showDateTimesFromWeeklyDraft();

    if (user.role === "admin") {
      employeeWrap.classList.remove("hidden");
      adminCard.classList.remove("hidden");
      loadEmployees().then(function () {
        reloadAll();
        document.dispatchEvent(new Event("rhs-admin-ready"));
      });
    } else {
      employeeWrap.classList.add("hidden");
      adminCard.classList.add("hidden");
      reloadAll();
      document.dispatchEvent(new Event("rhs-admin-ready"));
    }
  }

  window.RHSReloadAvailability = reloadAll;

  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var status = document.getElementById("login-status");
    status.textContent = "";
    RHSAdmin.login(document.getElementById("email").value, document.getElementById("password").value)
      .then(function (res) {
        RHSAdmin.setSession(res.token, res.user);
        showApp();
      })
      .catch(function (err) {
        status.textContent = err.message;
      });
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    RHSAdmin.clearSession();
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
  });

  weeklyGridBody.addEventListener("change", function (e) {
    var input = e.target.closest("[data-weekly-day]");
    if (!input) return;
    var day = Number(input.getAttribute("data-weekly-day"));
    var hour = Number(input.getAttribute("data-weekly-hour"));
    if (!weeklyDraft[day]) weeklyDraft[day] = [];
    if (input.checked) {
      if (weeklyDraft[day].indexOf(hour) === -1) weeklyDraft[day].push(hour);
    } else {
      weeklyDraft[day] = weeklyDraft[day].filter(function (h) { return h !== hour; });
    }
  });

  document.getElementById("save-weekly-btn").addEventListener("click", function () {
    weeklyStatus.textContent = "Saving…";
    weeklyStatus.className = "status";
    RHSAdmin.saveWeeklySchedule(collectWeeklyDraft(), selectedUserId())
      .then(function () {
        weeklyStatus.textContent = "Weekly schedule saved for the next " + SCHEDULE_WEEKS + " weeks.";
        weeklyStatus.className = "status success";
        loadDateSchedule();
        loadSlots();
      })
      .catch(function (err) {
        weeklyStatus.textContent = err.message;
        weeklyStatus.className = "status error";
      });
  });

  overrideDateInput.addEventListener("change", loadDateSchedule);

  dateOverrideTimes.addEventListener("click", function (e) {
    var button = e.target.closest("[data-date-hour]");
    if (!button) return;
    var hour = Number(button.getAttribute("data-date-hour"));
    dateDraft = dateDraft.map(function (entry) {
      if (entry.startHour === hour) {
        entry.enabled = !entry.enabled;
        entry.hasOverride = entry.enabled !== entry.weeklyDefault;
      }
      return entry;
    });
    paintDateTimePicker();
  });

  document.getElementById("save-date-btn").addEventListener("click", function () {
    dateStatus.textContent = "Saving…";
    dateStatus.className = "status";
    var payload = dateDraft.map(function (entry) {
      return { startHour: entry.startHour, enabled: entry.enabled };
    });
    RHSAdmin.saveDateSchedule(overrideDateInput.value, payload, selectedUserId())
      .then(function (res) {
        renderDateOverrides(res.day.hours);
        dateStatus.textContent = "Date updated.";
        dateStatus.className = "status success";
        loadSlots();
      })
      .catch(function (err) {
        dateStatus.textContent = err.message;
        dateStatus.className = "status error";
      });
  });

  document.getElementById("reset-date-btn").addEventListener("click", function () {
    dateStatus.textContent = "Resetting…";
    dateStatus.className = "status";
    RHSAdmin.resetDateSchedule(overrideDateInput.value, selectedUserId())
      .then(function (res) {
        renderDateOverrides(res.day.hours);
        dateStatus.textContent = "Date reset to weekly schedule.";
        dateStatus.className = "status success";
        loadSlots();
      })
      .catch(function (err) {
        dateStatus.textContent = err.message;
        dateStatus.className = "status error";
      });
  });

  if (employeeSelect) {
    employeeSelect.addEventListener("change", reloadAll);
  }

  document.getElementById("add-employee-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var status = document.getElementById("employee-status");
    status.textContent = "Creating…";
    RHSAdmin.createEmployee({
      name: document.getElementById("new-name").value,
      email: document.getElementById("new-email").value,
      password: document.getElementById("new-password").value,
      role: "employee"
    })
      .then(function () {
        status.textContent = "Employee created.";
        status.className = "status success";
        document.getElementById("add-employee-form").reset();
        loadEmployees();
      })
      .catch(function (err) {
        status.textContent = err.message;
        status.className = "status error";
      });
  });

  if (RHSAdmin.getToken() && RHSAdmin.getUser()) {
    showApp();
  }
})();
