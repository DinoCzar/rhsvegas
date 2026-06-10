const catalog = require("../services-catalog");

const MAX_ITEMS = 50;
const lookup = new Map();

catalog.forEach(function (entry) {
  lookup.set(normalizeKey(entry.name), entry);
  if (entry.cartName) {
    lookup.set(normalizeKey(entry.cartName), entry);
  }
});

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function formatPrice(entry) {
  if (entry.priceLabel) {
    return entry.priceLabel;
  }
  if (entry.price === 0) {
    return "Custom";
  }
  return "$" + entry.price;
}

function validateOrderItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error("INVALID_ITEMS");
  }
  if (items.length > MAX_ITEMS) {
    throw new Error("TOO_MANY_ITEMS");
  }

  var normalized = [];
  var estimatedTotal = 0;

  items.forEach(function (item) {
    var name = String(item && item.name ? item.name : "").trim();
    if (!name || name.length > 200) {
      throw new Error("INVALID_ITEM");
    }

    var entry = lookup.get(normalizeKey(name));
    if (!entry) {
      throw new Error("UNKNOWN_ITEM");
    }

    var clientPrice = Number(item.price) || 0;
    var serverPrice = Number(entry.price) || 0;

    if (serverPrice === 0) {
      if (clientPrice !== 0) {
        throw new Error("INVALID_PRICE");
      }
    } else if (clientPrice !== serverPrice) {
      throw new Error("INVALID_PRICE");
    }

    estimatedTotal += serverPrice;
    normalized.push({
      name: entry.cartName || entry.name,
      price: serverPrice,
      priceLabel: entry.priceLabel || formatPrice(entry)
    });
  });

  return { items: normalized, estimatedTotal: estimatedTotal };
}

module.exports = { validateOrderItems };
