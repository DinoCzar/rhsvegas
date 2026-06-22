(function () {
  var LEGACY_CART_KEY = "rhs_cart";
  var COOKIE_NAME = "rhs_cart_token";
  var COOKIE_MAX_AGE_DAYS = 30;

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
    return {
      name: item.name,
      price: Number(item.price) || 0,
      priceLabel: item.priceLabel || formatPrice(item.price),
      quantity: Math.max(1, Number(item.quantity) || 1)
    };
  }

  function itemKey(name, price) {
    return String(name).trim().toLowerCase() + "|" + String(Number(price) || 0);
  }

  function findItemIndex(items, name, price) {
    var key = itemKey(name, price);
    for (var i = 0; i < items.length; i += 1) {
      if (itemKey(items[i].name, items[i].price) === key) {
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
          priceLabel: item.priceLabel
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

    addItem: function (name, price, priceLabel) {
      var items = readCart();
      var normalizedPrice = Number(price) || 0;
      var label = priceLabel || formatPrice(price);
      var index = findItemIndex(items, name, normalizedPrice);

      if (index === -1) {
        items.push({
          name: name,
          price: normalizedPrice,
          priceLabel: label,
          quantity: 1
        });
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
      return readCart().reduce(function (sum, item) {
        return sum + (Number(item.price) || 0) * (item.quantity || 1);
      }, 0);
    },

    formatPrice: formatPrice,

    updateBadge: updateCartBadge,

    startNewCartSession: startNewCartSession
  };

  window.addToCart = function (name, price, priceLabel) {
    var quantity = RHSCart.addItem(name, price, priceLabel);
    var label = priceLabel || RHSCart.formatPrice(price);
    var qtyLabel = quantity > 1 ? " (×" + quantity + ")" : "";
    showCartToast(name + qtyLabel, label);
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
