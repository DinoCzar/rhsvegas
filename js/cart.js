(function () {
  var LEGACY_CART_KEY = "rhs_cart";
  var COOKIE_NAME = "rhs_cart_token";
  var COOKIE_MAX_AGE_DAYS = 30;
  var OTHER_TASKS_NAME = "Other Tasks Not Listed";
  var MAX_TASK_DESCRIPTION = 500;
  var pendingOtherTask = null;
  var taskModal = null;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCartToken(token) {
    var maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    var host = window.location.hostname;
    var domain = "";
    if (host === "rhsvegas.com" || host.slice(-12) === ".rhsvegas.com") {
      domain = "; Domain=.rhsvegas.com";
    }
    var secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      COOKIE_NAME +
      "=" +
      encodeURIComponent(token) +
      domain +
      "; Path=/; Max-Age=" +
      maxAge +
      "; SameSite=Lax" +
      secure;
  }

  function createCartToken() {
    return "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function getCartToken() {
    var token = getCookie(COOKIE_NAME);
    if (!token) {
      token = createCartToken();
      setCartToken(token);
    }
    return token;
  }

  function cartStorageKey() {
    return "rhs_cart_" + getCartToken();
  }

  function migrateLegacyCart() {
    try {
      var legacy = localStorage.getItem(LEGACY_CART_KEY);
      if (!legacy) {
        return;
      }
      var items = JSON.parse(legacy);
      if (Array.isArray(items) && items.length && !localStorage.getItem(cartStorageKey())) {
        localStorage.setItem(cartStorageKey(), JSON.stringify(items));
      }
      localStorage.removeItem(LEGACY_CART_KEY);
    } catch (e) {
      localStorage.removeItem(LEGACY_CART_KEY);
    }
  }

  function readCart() {
    migrateLegacyCart();
    try {
      var items = JSON.parse(localStorage.getItem(cartStorageKey())) || [];
      return items.map(normalizeItem);
    } catch (e) {
      return [];
    }
  }

  function normalizeItem(item) {
    var normalized = {
      name: item.name,
      price: Number(item.price) || 0,
      priceLabel: item.priceLabel || formatPrice(item.price),
      quantity: Math.max(1, Number(item.quantity) || 1)
    };
    if (isOtherTasksItem(item.name) && item.taskDescription) {
      normalized.taskDescription = String(item.taskDescription).trim();
    }
    return normalized;
  }

  function isOtherTasksItem(name) {
    return String(name || "").trim().toLowerCase() === OTHER_TASKS_NAME.toLowerCase();
  }

  function isHourlyRateItem(item) {
    if (isOtherTasksItem(item && item.name)) {
      return true;
    }
    return String((item && item.priceLabel) || "").toLowerCase().indexOf("/hr") !== -1;
  }

  function getFixedTotal(items) {
    items = items || readCart();
    return items.reduce(function (sum, item) {
      if (isHourlyRateItem(item)) {
        return sum;
      }
      return sum + (Number(item.price) || 0) * (item.quantity || 1);
    }, 0);
  }

  function hasHourlyRateItems(items) {
    items = items || readCart();
    return items.some(isHourlyRateItem);
  }

  function formatEstimatedTotal(items) {
    items = items || readCart();
    var fixedTotal = getFixedTotal(items);
    var hasHourly = hasHourlyRateItems(items);

    if (hasHourly && fixedTotal > 0) {
      return formatPrice(fixedTotal) + " + TBD";
    }
    if (hasHourly) {
      return "TBD";
    }
    if (fixedTotal === 0 && items.length) {
      var onlyCustom = items.every(function (item) {
        return (Number(item.price) || 0) === 0;
      });
      if (onlyCustom) {
        return "TBD";
      }
    }
    return formatPrice(fixedTotal);
  }

  function formatLinePrice(item) {
    var qty = item.quantity || 1;
    var label = item.priceLabel || formatPrice(item.price);
    if (isHourlyRateItem(item)) {
      if (qty > 1) {
        return label + " × " + qty + " = TBD";
      }
      return label;
    }
    var lineTotal = (Number(item.price) || 0) * qty;
    if (qty > 1) {
      return label + " × " + qty + " = " + formatPrice(lineTotal);
    }
    return label;
  }

  function itemKey(name, price, taskDescription) {
    var base = String(name).trim().toLowerCase() + "|" + String(Number(price) || 0);
    if (isOtherTasksItem(name)) {
      return base + "|" + String(taskDescription || "").trim().toLowerCase();
    }
    return base;
  }

  function findItemIndex(items, name, price, taskDescription) {
    var key = itemKey(name, price, taskDescription);
    for (var i = 0; i < items.length; i += 1) {
      if (itemKey(items[i].name, items[i].price, items[i].taskDescription) === key) {
        return i;
      }
    }
    return -1;
  }

  function expandItemsForCheckout(items) {
    var expanded = [];
    items.forEach(function (item) {
      var qty = item.quantity || 1;
      for (var i = 0; i < qty; i += 1) {
        expanded.push({
          name: item.name,
          price: item.price,
          priceLabel: item.priceLabel,
          taskDescription: item.taskDescription
        });
      }
    });
    return expanded;
  }

  function writeCart(items) {
    localStorage.setItem(cartStorageKey(), JSON.stringify(items));
    updateCartBadge();
  }

  function formatPrice(amount) {
    if (amount === 0 || amount === "0") {
      return "Custom";
    }
    if (typeof amount === "string" && amount.indexOf("/") !== -1) {
      return "$" + amount;
    }
    return "$" + Number(amount).toFixed(0);
  }

  function getCartUrl() {
    return (window.RHS_CONFIG && window.RHS_CONFIG.cartUrl) || "/cart";
  }

  function getToastHost() {
    var host = document.getElementById("cart-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "cart-toast-host";
      host.className = "cart-toast-host";
      host.setAttribute("aria-live", "polite");
      host.setAttribute("aria-atomic", "true");
      document.body.appendChild(host);
    }
    return host;
  }

  function showCartToast(name, priceLabel) {
    var host = getToastHost();
    var toast = document.createElement("div");
    toast.className = "cart-toast";
    toast.setAttribute("role", "status");

    var cartUrl = getCartUrl();
    toast.innerHTML =
      '<span class="cart-toast-icon" aria-hidden="true">✓</span>' +
      '<div class="cart-toast-body">' +
      '<p class="cart-toast-title">Added to cart</p>' +
      '<p class="cart-toast-meta">' + escapeHtml(name) + " · " + escapeHtml(priceLabel) + "</p>" +
      '<a class="cart-toast-link" href="' + escapeHtml(cartUrl) + '">View cart</a>' +
      "</div>";

    host.appendChild(toast);

    window.setTimeout(function () {
      toast.classList.add("is-leaving");
      window.setTimeout(function () {
        toast.remove();
        if (!host.childElementCount) {
          host.remove();
        }
      }, 220);
    }, 3500);
  }

  function ensureTaskModal() {
    if (taskModal) {
      return taskModal;
    }

    taskModal = document.createElement("div");
    taskModal.className = "cart-task-modal";
    taskModal.hidden = true;
    taskModal.setAttribute("role", "dialog");
    taskModal.setAttribute("aria-modal", "true");
    taskModal.setAttribute("aria-labelledby", "cart-task-modal-title");
    taskModal.innerHTML =
      '<div class="cart-task-modal-backdrop" data-cart-task-close></div>' +
      '<div class="cart-task-modal-card">' +
      '<h2 id="cart-task-modal-title">Describe your task</h2>' +
      "<p>Tell us what you need help with for <strong>Other Tasks Not Listed</strong>.</p>" +
      '<label for="cart-task-description">Task description *</label>' +
      '<textarea id="cart-task-description" maxlength="' +
      MAX_TASK_DESCRIPTION +
      '" rows="4" placeholder="e.g. Hang blinds in two bedrooms and patch small drywall holes"></textarea>' +
      '<div class="cart-task-modal-actions">' +
      '<button type="button" class="btn btn-primary" id="cart-task-submit">Add to cart</button>' +
      '<button type="button" class="btn-secondary" id="cart-task-cancel">Cancel</button>' +
      "</div>" +
      '<p class="status error" id="cart-task-error" hidden></p>' +
      "</div>";

    document.body.appendChild(taskModal);

    var textarea = taskModal.querySelector("#cart-task-description");
    var errorEl = taskModal.querySelector("#cart-task-error");

    taskModal.querySelector("#cart-task-submit").addEventListener("click", function () {
      var description = textarea.value.trim();
      if (!description) {
        errorEl.textContent = "Please describe the task you need completed.";
        errorEl.hidden = false;
        textarea.focus();
        return;
      }
      if (!pendingOtherTask) {
        closeTaskModal();
        return;
      }
      completeAddToCart(
        pendingOtherTask.name,
        pendingOtherTask.price,
        pendingOtherTask.priceLabel,
        description
      );
      closeTaskModal();
    });

    taskModal.querySelector("#cart-task-cancel").addEventListener("click", closeTaskModal);
    taskModal.querySelector("[data-cart-task-close]").addEventListener("click", closeTaskModal);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && taskModal && !taskModal.hidden) {
        closeTaskModal();
      }
    });

    return taskModal;
  }

  function openTaskModal(name, price, priceLabel) {
    pendingOtherTask = { name: name, price: price, priceLabel: priceLabel };
    var modal = ensureTaskModal();
    var textarea = modal.querySelector("#cart-task-description");
    var errorEl = modal.querySelector("#cart-task-error");
    textarea.value = "";
    errorEl.hidden = true;
    errorEl.textContent = "";
    modal.hidden = false;
    document.body.classList.add("cart-task-modal-open");
    window.setTimeout(function () {
      textarea.focus();
    }, 0);
  }

  function closeTaskModal() {
    pendingOtherTask = null;
    if (!taskModal) {
      return;
    }
    taskModal.hidden = true;
    document.body.classList.remove("cart-task-modal-open");
  }

  function completeAddToCart(name, price, priceLabel, taskDescription) {
    var quantity = RHSCart.addItem(name, price, priceLabel, {
      taskDescription: taskDescription
    });
    var label = priceLabel || RHSCart.formatPrice(price);
    var qtyLabel = quantity > 1 ? " (×" + quantity + ")" : "";
    showCartToast(name + qtyLabel, label);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateCartBadge() {
    var count = readCart().reduce(function (sum, item) {
      return sum + (item.quantity || 1);
    }, 0);
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
    });
    document.querySelectorAll("[data-cart-link]").forEach(function (el) {
      el.setAttribute("href", getCartUrl());
    });
  }

  function startNewCartSession() {
    var oldKey = cartStorageKey();
    localStorage.removeItem(oldKey);
    setCartToken(createCartToken());
    writeCart([]);
  }

  window.RHSCart = {
    getItems: readCart,

    getCheckoutItems: function () {
      return expandItemsForCheckout(readCart());
    },

    addItem: function (name, price, priceLabel, options) {
      options = options || {};
      var items = readCart();
      var normalizedPrice = Number(price) || 0;
      var label = priceLabel || formatPrice(price);
      var taskDescription = isOtherTasksItem(name)
        ? String(options.taskDescription || "").trim()
        : "";
      var index = findItemIndex(items, name, normalizedPrice, taskDescription);

      if (index === -1) {
        var entry = {
          name: name,
          price: normalizedPrice,
          priceLabel: label,
          quantity: 1
        };
        if (taskDescription) {
          entry.taskDescription = taskDescription;
        }
        items.push(entry);
      } else {
        items[index].quantity += 1;
      }

      writeCart(items);
      return items[index === -1 ? items.length - 1 : index].quantity;
    },

    removeItem: function (index) {
      var items = readCart();
      items.splice(index, 1);
      writeCart(items);
      return items;
    },

    clear: function () {
      startNewCartSession();
    },

    getCount: function () {
      return readCart().reduce(function (sum, item) {
        return sum + (item.quantity || 1);
      }, 0);
    },

    getTotal: function () {
      return getFixedTotal();
    },

    getFixedTotal: getFixedTotal,

    hasHourlyRateItems: hasHourlyRateItems,

    formatEstimatedTotal: formatEstimatedTotal,

    formatLinePrice: formatLinePrice,

    isHourlyRateItem: isHourlyRateItem,

    formatPrice: formatPrice,

    updateBadge: updateCartBadge,

    startNewCartSession: startNewCartSession
  };

  window.addToCart = function (name, price, priceLabel) {
    if (isOtherTasksItem(name)) {
      openTaskModal(name, price, priceLabel);
      return;
    }
    completeAddToCart(name, price, priceLabel);
  };

  window.toggleCategory = function (button) {
    button.classList.toggle("active");
    var content = button.nextElementSibling;
    if (content.style.display === "block") {
      content.style.display = "none";
    } else {
      content.style.display = "block";
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateCartBadge);
  } else {
    updateCartBadge();
  }
})();
