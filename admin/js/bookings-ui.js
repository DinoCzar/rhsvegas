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
              "<div class=\"slot-meta\">Estimated total: " + escapeHtml(formatMoney(booking.estimatedTotal)) + "</div>" +
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
