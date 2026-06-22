const db = require("../db");

var catalogCache = [];
var lookupCache = new Map();

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isHourlyRateEntry(entry) {
  if (!entry) {
    return false;
  }
  if (normalizeKey(entry.name) === normalizeKey("Other Tasks Not Listed")) {
    return true;
  }
  return String(entry.priceLabel || "").toLowerCase().indexOf("/hr") !== -1;
}

function isHourlyRateItem(item) {
  if (!item) {
    return false;
  }
  if (normalizeKey(item.name) === normalizeKey("Other Tasks Not Listed")) {
    return true;
  }
  return String(item.priceLabel || "").toLowerCase().indexOf("/hr") !== -1;
}

function formatEstimatedTotalLabel(items, fixedTotal) {
  var hasHourly = items.some(isHourlyRateItem);
  var fixed = Number(fixedTotal) || 0;

  if (hasHourly && fixed > 0) {
    return "$" + fixed.toFixed(0) + " + TBD";
  }
  if (hasHourly) {
    return "TBD";
  }
  return "$" + fixed.toFixed(0);
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

function rowToEntry(row) {
  return {
    id: row.id,
    section: row.section,
    category: row.category,
    name: row.name,
    cartName: row.cart_name || null,
    price: row.price,
    priceLabel: row.price_label || null,
    addToCart: row.add_to_cart === 1,
    sortOrder: row.sort_order,
    active: row.active === 1
  };
}

function rebuildLookup(entries) {
  var lookup = new Map();
  entries.forEach(function (entry) {
    lookup.set(normalizeKey(entry.name), entry);
    if (entry.cartName) {
      lookup.set(normalizeKey(entry.cartName), entry);
    }
  });
  return lookup;
}

async function refreshCatalog() {
  const rows = await db.all(
    `
    SELECT id, section, category, name, cart_name, price, price_label, add_to_cart, sort_order, active
    FROM services
    WHERE active = 1
    ORDER BY section ASC, category ASC, sort_order ASC, id ASC
  `
  );

  catalogCache = rows.map(rowToEntry);
  lookupCache = rebuildLookup(catalogCache);
  return catalogCache;
}

function getCatalogEntries() {
  return catalogCache.slice();
}

function getLookupMap() {
  return lookupCache;
}

function validateOrderItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error("INVALID_ITEMS");
  }
  if (items.length > 50) {
    throw new Error("TOO_MANY_ITEMS");
  }

  var normalized = [];
  var estimatedTotal = 0;

  items.forEach(function (item) {
    var name = String(item && item.name ? item.name : "").trim();
    if (!name || name.length > 200) {
      throw new Error("INVALID_ITEM");
    }

    var entry = lookupCache.get(normalizeKey(name));
    if (!entry) {
      throw new Error("UNKNOWN_ITEM");
    }

    var taskDescription = String((item && item.taskDescription) || "").trim();
    var isOtherTask = normalizeKey(name) === normalizeKey("Other Tasks Not Listed");

    if (isOtherTask) {
      if (!taskDescription || taskDescription.length > 500) {
        throw new Error("INVALID_TASK_DESCRIPTION");
      }
    } else if (taskDescription) {
      throw new Error("INVALID_TASK_DESCRIPTION");
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

    if (!isHourlyRateEntry(entry)) {
      estimatedTotal += serverPrice;
    }
    var normalizedItem = {
      name: entry.cartName || entry.name,
      price: serverPrice,
      priceLabel: entry.priceLabel || formatPrice(entry)
    };
    if (taskDescription) {
      normalizedItem.taskDescription = taskDescription;
    }
    normalized.push(normalizedItem);
  });

  return { items: normalized, estimatedTotal: estimatedTotal };
}

module.exports = {
  refreshCatalog,
  getCatalogEntries,
  getLookupMap,
  validateOrderItems,
  rowToEntry,
  formatPrice,
  isHourlyRateEntry,
  isHourlyRateItem,
  formatEstimatedTotalLabel
};
