(function () {
  var card = document.getElementById("booking-requests-card");
  var listEl = document.getElementById("booking-requests-list");
  var statusEl = document.getElementById("booking-requests-status");

  if (!card || !listEl) {
    return;
  }

  function escapeHtml(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(value) {
    return "$" + Number(value || 0).toFixed(0);
  }

  function formatEstimatedTotal(items, fixedTotal) {
    var hasHourly = (items || []).some(function (item) {
      var name = String(item && item.name ? item.name : "").toLowerCase();
      if (name === "other tasks not listed") {
        return true;
      }
      return String(item && item.priceLabel ? item.priceLabel : "")
        .toLowerCase()
        .indexOf("/hr") !== -1;
    });
    var fixed = Number(fixedTotal) || 0;
    if (hasHourly && fixed > 0) {
      return formatMoney(fixed) + " + TBD";
    }
    if (hasHourly) {
      return "TBD";
    }
    return formatMoney(fixed);
  }

  function formatServiceLines(items) {
    return (items || [])
      .map(function (item) {
        var line = item.name + " — " + (item.priceLabel || formatMoney(item.price));
        if (item.taskDescription) {
          line += " (" + item.taskDescription + ")";
        }
        return line;
      })
      .join("\n");
  }

  function getFirstName(fullName) {
    var parts = String(fullName || "").trim().split(/\s+/);
    return parts[0] || "";
  }

  function formatBookingDateLine(iso) {
    var match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (!match) {
      return "";
    }
    var y = Number(match[1]);
    var mo = Number(match[2]);
    var d = Number(match[3]);
    var weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC"
    }).format(Date.UTC(y, mo - 1, d, 12, 0, 0));
    var datePart = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(Date.UTC(y, mo - 1, d, 12, 0, 0));
    return weekday + ", " + datePart;
  }

  function buildApprovalCopyText(booking) {
    return [
      getFirstName(booking.customerName),
      formatBookingDateLine(booking.appointmentStart),
      "Arrival: " + (booking.appointmentTime || ""),
      "Client Total: " + formatEstimatedTotal(booking.items, booking.estimatedTotal),
      "Est hrs:",
      "",
      booking.customerAddress || "",
      "",
      formatServiceLines(booking.items)
    ].join("\n");
  }

  var approvalModal = null;

  function ensureApprovalModal() {
    if (approvalModal) {
      return approvalModal;
    }

    approvalModal = document.createElement("div");
    approvalModal.className = "admin-approval-modal";
    approvalModal.hidden = true;
    approvalModal.setAttribute("role", "dialog");
    approvalModal.setAttribute("aria-modal", "true");
    approvalModal.setAttribute("aria-labelledby", "admin-approval-modal-title");
    approvalModal.innerHTML =
      '<div class="admin-approval-modal-backdrop" data-approval-modal-close></div>' +
      '<div class="admin-approval-modal-card">' +
      '<h2 id="admin-approval-modal-title">Booking confirmed</h2>' +
      "<p>Copy this summary for your records or scheduling tools.</p>" +
      '<textarea id="admin-approval-copy-text" class="admin-approval-copy-text" readonly rows="12"></textarea>' +
      '<div class="admin-approval-modal-actions">' +
      '<button type="button" class="btn-primary" id="admin-approval-copy-btn">Copy to clipboard</button>' +
      '<button type="button" class="btn-secondary" id="admin-approval-close-btn">Close</button>' +
      "</div>" +
      '<p class="status" id="admin-approval-copy-status" hidden></p>' +
      "</div>";

    document.body.appendChild(approvalModal);

    approvalModal.querySelector("#admin-approval-close-btn").addEventListener("click", closeApprovalModal);
    approvalModal.querySelector("[data-approval-modal-close]").addEventListener("click", closeApprovalModal);
    approvalModal.querySelector("#admin-approval-copy-btn").addEventListener("click", function () {
      var textarea = approvalModal.querySelector("#admin-approval-copy-text");
      var statusEl = approvalModal.querySelector("#admin-approval-copy-status");
      var text = textarea.value;

      function showCopied() {
        statusEl.textContent = "Copied to clipboard.";
        statusEl.className = "status success";
        statusEl.hidden = false;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopied).catch(function () {
          textarea.focus();
          textarea.select();
          try {
            document.execCommand("copy");
            showCopied();
          } catch (err) {
            statusEl.textContent = "Select the text and copy manually.";
            statusEl.className = "status error";
            statusEl.hidden = false;
          }
        });
        return;
      }

      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        showCopied();
      } catch (err) {
        statusEl.textContent = "Select the text and copy manually.";
        statusEl.className = "status error";
        statusEl.hidden = false;
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && approvalModal && !approvalModal.hidden) {
        closeApprovalModal();
      }
    });

    return approvalModal;
  }

  function showApprovalCopyModal(booking) {
    var modal = ensureApprovalModal();
    var textarea = modal.querySelector("#admin-approval-copy-text");
    var statusEl = modal.querySelector("#admin-approval-copy-status");
    textarea.value = buildApprovalCopyText(booking);
    statusEl.hidden = true;
    statusEl.textContent = "";
    modal.hidden = false;
    document.body.classList.add("admin-approval-modal-open");
    textarea.focus();
    textarea.select();
  }

  function closeApprovalModal() {
    if (!approvalModal) {
      return;
    }
    approvalModal.hidden = true;
    document.body.classList.remove("admin-approval-modal-open");
  }

  function renderItems(items) {
    if (!items || !items.length) {
      return "<p class=\"slot-meta\">No services listed.</p>";
    }
    return (
      "<ul class=\"booking-items\">" +
      items
        .map(function (item) {
          var label = item.priceLabel || formatMoney(item.price);
          return "<li>" + escapeHtml(item.name) + " — " + escapeHtml(label) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function loadBookingRequests() {
    var user = RHSAdmin.getUser();
    if (!user || user.role !== "admin") {
      card.classList.add("hidden");
      return;
    }

    card.classList.remove("hidden");
    statusEl.textContent = "Loading…";
    statusEl.className = "status";
    listEl.innerHTML = "";

    RHSAdmin.fetchBookingRequests("pending")
      .then(function (res) {
        if (!res.bookings.length) {
          statusEl.textContent = "No pending booking requests.";
          return;
        }

        statusEl.textContent = res.bookings.length + " pending request(s).";
        listEl.innerHTML = res.bookings
          .map(function (booking) {
            return (
              '<li class="booking-card">' +
              "<div class=\"booking-card-main\">" +
              "<strong>" + escapeHtml(booking.customerName) + "</strong>" +
              "<div class=\"slot-meta\">" + escapeHtml(booking.orderId) + " · " + escapeHtml(booking.appointmentLabel) + "</div>" +
              "<div class=\"slot-meta\">" + escapeHtml(booking.customerEmail) + " · " + escapeHtml(booking.customerPhone) + "</div>" +
              "<div class=\"slot-meta\">" + escapeHtml(booking.customerAddress) + "</div>" +
              renderItems(booking.items) +
              "<div class=\"slot-meta\">Estimated total: " + escapeHtml(formatEstimatedTotal(booking.items, booking.estimatedTotal)) + "</div>" +
              "</div>" +
              "<div class=\"booking-card-actions\">" +
              '<button type="button" class="btn-primary" data-approve="' + booking.id + '">Approve</button>' +
              '<button type="button" class="btn-danger" data-deny="' + booking.id + '">Deny</button>' +
              "</div>" +
              "</li>"
            );
          })
          .join("");
      })
      .catch(function (err) {
        statusEl.textContent = err.message;
        statusEl.className = "status error";
      });
  }

  listEl.addEventListener("click", function (e) {
    var approveBtn = e.target.closest("[data-approve]");
    var denyBtn = e.target.closest("[data-deny]");

    if (approveBtn) {
      var approveId = approveBtn.getAttribute("data-approve");
      statusEl.textContent = "Approving…";
      RHSAdmin.approveBooking(approveId)
        .then(function (res) {
          if (res && res.booking) {
            showApprovalCopyModal(res.booking);
          }
          loadBookingRequests();
          if (window.RHSReloadAvailability) {
            window.RHSReloadAvailability();
          }
        })
        .catch(function (err) {
          statusEl.textContent = err.message;
          statusEl.className = "status error";
        });
      return;
    }

    if (denyBtn) {
      var denyId = denyBtn.getAttribute("data-deny");
      if (!confirm("Deny this booking request? The time slot will become available again.")) {
        return;
      }
      statusEl.textContent = "Denying…";
      RHSAdmin.denyBooking(denyId)
        .then(function () {
          loadBookingRequests();
          if (window.RHSReloadAvailability) {
            window.RHSReloadAvailability();
          }
        })
        .catch(function (err) {
          statusEl.textContent = err.message;
          statusEl.className = "status error";
        });
    }
  });

  window.RHSReloadBookingRequests = loadBookingRequests;

  document.addEventListener("rhs-admin-ready", loadBookingRequests);
})();
