(function () {
  var CART_KEY = "rhs_cart";

  function readCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
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
    var count = readCart().length;
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
    });
    document.querySelectorAll("[data-cart-link]").forEach(function (el) {
      el.setAttribute("href", getCartUrl());
    });
  }

  window.RHSCart = {
    getItems: readCart,

    addItem: function (name, price, priceLabel) {
      var items = readCart();
      items.push({
        name: name,
        price: Number(price) || 0,
        priceLabel: priceLabel || formatPrice(price)
      });
      writeCart(items);
      return items.length;
    },

    removeItem: function (index) {
      var items = readCart();
      items.splice(index, 1);
      writeCart(items);
      return items;
    },

    clear: function () {
      writeCart([]);
    },

    getCount: function () {
      return readCart().length;
    },

    getTotal: function () {
      return readCart().reduce(function (sum, item) {
        return sum + (Number(item.price) || 0);
      }, 0);
    },

    formatPrice: formatPrice,

    updateBadge: updateCartBadge
  };

  window.addToCart = function (name, price, priceLabel) {
    RHSCart.addItem(name, price, priceLabel);
    var label = priceLabel || RHSCart.formatPrice(price);
    showCartToast(name, label);
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
