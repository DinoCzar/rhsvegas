(function () {
  var TOKEN_KEY = "rhs_staff_token";
  var USER_KEY = "rhs_staff_user";

  function getApiBase() {
    if (window.RHS_ADMIN_CONFIG && window.RHS_ADMIN_CONFIG.apiUrl) {
      return window.RHS_ADMIN_CONFIG.apiUrl.replace(/\/$/, "");
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3001/api";
    }
    return window.location.origin + "/api";
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function api(path, options) {
    options = options || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    var token = getToken();
    if (token) {
      headers.Authorization = "Bearer " + token;
    }
    return fetch(getApiBase() + path, Object.assign({}, options, { headers: headers }))
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            if (res.status === 429) {
              throw new Error("Too many login attempts. Please wait 15 minutes and try again.");
            }
            throw new Error("Could not reach the server. Try refreshing the page.");
          })
          .then(function (data) {
            if (!res.ok) {
              throw new Error(data.error || "Request failed.");
            }
            return data;
          });
      })
      .catch(function (err) {
        if (err.message === "Failed to fetch") {
          throw new Error("Could not reach the server. Check your connection and try again.");
        }
        throw err;
      });
  }

  window.RHSAdmin = {
    getApiBase: getApiBase,
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,
    api: api,

    login: function (email, password) {
      return api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password })
      });
    },

    restoreSession: function () {
      if (!getToken()) {
        return Promise.resolve(null);
      }
      return api("/auth/me")
        .then(function (data) {
          setSession(getToken(), data.user);
          return data.user;
        })
        .catch(function () {
          clearSession();
          return null;
        });
    },

    fetchSlots: function (from, to, userId) {
      var q = "?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
      if (userId) q += "&userId=" + encodeURIComponent(userId);
      return api("/availability/manage" + q);
    },

    fetchWeeklySchedule: function (userId) {
      var q = userId ? "?userId=" + encodeURIComponent(userId) : "";
      return api("/availability/schedule/weekly" + q);
    },

    saveWeeklySchedule: function (enabledSlots, userId) {
      var payload = { enabledSlots: enabledSlots };
      if (userId) payload.userId = Number(userId);
      return api("/availability/schedule/weekly", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },

    fetchDateSchedule: function (date, userId) {
      var q = userId ? "?userId=" + encodeURIComponent(userId) : "";
      return api("/availability/schedule/date/" + encodeURIComponent(date) + q);
    },

    saveDateSchedule: function (date, hours, userId) {
      var payload = { hours: hours };
      if (userId) payload.userId = Number(userId);
      return api("/availability/schedule/date/" + encodeURIComponent(date), {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },

    resetDateSchedule: function (date, userId) {
      var q = userId ? "?userId=" + encodeURIComponent(userId) : "";
      return api("/availability/schedule/date/" + encodeURIComponent(date) + q, {
        method: "DELETE"
      });
    },

    addSlot: function (payload) {
      return api("/availability", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    deleteSlot: function (id) {
      return api("/availability/" + id, { method: "DELETE" });
    },

    listEmployees: function () {
      return api("/auth/users");
    },

    createEmployee: function (payload) {
      return api("/auth/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    fetchBookingRequests: function (status) {
      var q = status ? "?status=" + encodeURIComponent(status) : "";
      return api("/bookings/requests" + q);
    },

    approveBooking: function (id) {
      return api("/bookings/" + encodeURIComponent(id) + "/approve", { method: "POST" });
    },

    denyBooking: function (id) {
      return api("/bookings/" + encodeURIComponent(id) + "/deny", { method: "POST" });
    },

    listGalleryImages: function () {
      return api("/gallery/manage/list");
    },

    uploadGalleryImage: function (caption, mimeType, dataBase64) {
      return api("/gallery", {
        method: "POST",
        body: JSON.stringify({ caption: caption, mimeType: mimeType, dataBase64: dataBase64 })
      });
    },

    reorderGalleryImages: function (order) {
      return api("/gallery/reorder", {
        method: "PUT",
        body: JSON.stringify({ order: order })
      });
    },

    updateGalleryCaption: function (id, caption) {
      return api("/gallery/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify({ caption: caption })
      });
    },

    deleteGalleryImage: function (id) {
      return api("/gallery/" + encodeURIComponent(id), { method: "DELETE" });
    },

    listServicesManage: function () {
      return api("/services/manage/list");
    },

    createService: function (payload) {
      return api("/services", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    updateService: function (id, payload) {
      return api("/services/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },

    deleteService: function (id) {
      return api("/services/" + encodeURIComponent(id), { method: "DELETE" });
    },

    galleryImageUrl: function (imagePath) {
      var base = getApiBase();
      if (imagePath.indexOf("/api/") === 0) {
        return base.replace(/\/api$/, "") + imagePath;
      }
      if (imagePath.indexOf("/") === 0) {
        return base + imagePath;
      }
      return base + "/" + imagePath;
    }
  };
})();
