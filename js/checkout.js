(function () {
  function getApiUrl() {
    if (!window.RHS_CONFIG || !window.RHS_CONFIG.apiUrl) {
      throw new Error("Missing RHS_CONFIG.apiUrl. See SETUP.md.");
    }
    return window.RHS_CONFIG.apiUrl.replace(/\/$/, "");
  }

  function apiGet(path) {
    return fetch(getApiUrl() + path, { method: "GET" }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          throw new Error(data.error || "Request failed.");
        }
        return data;
      });
    });
  }

  function apiPost(path, payload) {
    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 45000);

    return fetch(getApiUrl() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeout);
        return res.json().catch(function () {
          throw new Error("Unexpected server response. Please try again.");
        }).then(function (data) {
          if (!res.ok) {
            throw new Error(data.error || "Request failed.");
          }
          return data;
        });
      })
      .catch(function (err) {
        clearTimeout(timeout);
        if (err.name === "AbortError") {
          throw new Error("Request timed out. If you reached the confirmation page, your booking may still have gone through.");
        }
        if (err.message === "Failed to fetch") {
          throw new Error("Could not reach the booking server. Check your connection and try again.");
        }
        throw err;
      });
  }

  window.RHSCheckout = {
    getAvailableDates: function () {
      return apiGet("/availability/dates");
    },

    getAvailability: function (date) {
      return apiGet("/availability?date=" + encodeURIComponent(date));
    },

    submitOrder: function (order, honeypot) {
      return apiPost("/checkout", { order: order, _hp: honeypot || "" });
    }
  };
})();
