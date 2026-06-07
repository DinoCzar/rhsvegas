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
    return fetch(getApiUrl() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          throw new Error(data.error || "Request failed.");
        }
        return data;
      });
    });
  }

  window.RHSCheckout = {
    getAvailability: function (date) {
      return apiGet("/availability?date=" + encodeURIComponent(date));
    },

    submitOrder: function (order) {
      return apiPost("/checkout", { order: order });
    }
  };
})();
