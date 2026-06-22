const express = require("express");
const db = require("../db");
const { authRequired, adminRequired } = require("../middleware/auth");
const catalog = require("../services/catalog-service");
const { asyncHandler } = require("../async-handler");
const { authWriteLimiter, publicReadLimiter } = require("../middleware/rate-limit");

const router = express.Router();

const SECTIONS = ["Assembly", "Installation", "Other Services"];

function parseServiceBody(body) {
  const section = String((body && body.section) || "").trim();
  const category = String((body && body.category) || "").trim();
  const name = String((body && body.name) || "").trim();
  const cartName = String((body && body.cartName) || "").trim();
  const priceLabel = String((body && body.priceLabel) || "").trim();
  const price = Number(body && body.price);
  const addToCart = body && body.addToCart === false ? 0 : 1;

  if (!SECTIONS.includes(section)) {
    throw new Error("INVALID_SECTION");
  }
  if (!category || category.length > 120) {
    throw new Error("INVALID_CATEGORY");
  }
  if (!name || name.length > 200) {
    throw new Error("INVALID_NAME");
  }
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    throw new Error("INVALID_PRICE");
  }
  if (cartName.length > 200) {
    throw new Error("INVALID_CART_NAME");
  }
  if (priceLabel.length > 80) {
    throw new Error("INVALID_PRICE_LABEL");
  }

  return {
    section: section,
    category: category,
    name: name,
    cart_name: cartName || null,
    price: price,
    price_label: priceLabel || null,
    add_to_cart: addToCart
  };
}

function serviceErrorResponse(err, res) {
  if (err.message === "INVALID_SECTION") {
    return res.status(400).json({ ok: false, error: "Choose a valid section." });
  }
  if (err.message === "INVALID_CATEGORY") {
    return res.status(400).json({ ok: false, error: "Category is required (max 120 characters)." });
  }
  if (err.message === "INVALID_NAME") {
    return res.status(400).json({ ok: false, error: "Service name is required (max 200 characters)." });
  }
  if (err.message === "INVALID_PRICE") {
    return res.status(400).json({ ok: false, error: "Price must be a number from 0 to 100000." });
  }
  if (err.message === "INVALID_CART_NAME") {
    return res.status(400).json({ ok: false, error: "Cart name is too long." });
  }
  if (err.message === "INVALID_PRICE_LABEL") {
    return res.status(400).json({ ok: false, error: "Price label is too long." });
  }
  return null;
}

router.get(
  "/",
  publicReadLimiter,
  asyncHandler(async function (req, res) {
    const section = String(req.query.section || "").trim();
    let sql = `
      SELECT id, section, category, name, cart_name, price, price_label, add_to_cart, sort_order, active
      FROM services
      WHERE active = 1
    `;
    const params = [];

    if (section) {
      sql += " AND section = ?";
      params.push(section);
    }

    sql += " ORDER BY section ASC, category ASC, sort_order ASC, id ASC";

    const rows = await db.all(sql, params);
    res.json({
      ok: true,
      services: rows.map(catalog.rowToEntry)
    });
  })
);

router.get(
  "/manage/list",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const rows = await db.all(
      `
      SELECT id, section, category, name, cart_name, price, price_label, add_to_cart, sort_order, active
      FROM services
      ORDER BY section ASC, category ASC, sort_order ASC, id ASC
    `
    );
    res.json({
      ok: true,
      services: rows.map(catalog.rowToEntry)
    });
  })
);

router.post(
  "/",
  authRequired,
  adminRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    let parsed;
    try {
      parsed = parseServiceBody(req.body);
    } catch (err) {
      const response = serviceErrorResponse(err, res);
      if (response) {
        return response;
      }
      throw err;
    }

    const maxRow = await db.get(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM services WHERE section = ? AND category = ?",
      [parsed.section, parsed.category]
    );
    const nextOrder = maxRow ? maxRow.max_order + 1 : 0;

    const result = await db.run(
      `
      INSERT INTO services (
        section, category, name, cart_name, price, price_label, add_to_cart, sort_order, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
      [
        parsed.section,
        parsed.category,
        parsed.name,
        parsed.cart_name,
        parsed.price,
        parsed.price_label,
        parsed.add_to_cart,
        nextOrder
      ]
    );

    await catalog.refreshCatalog();

    const row = await db.get(
      `
      SELECT id, section, category, name, cart_name, price, price_label, add_to_cart, sort_order, active
      FROM services WHERE id = ?
    `,
      [result.lastInsertRowid]
    );

    res.status(201).json({ ok: true, service: catalog.rowToEntry(row) });
  })
);

router.put(
  "/:id",
  authRequired,
  adminRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    const serviceId = Number(req.params.id);
    const existing = await db.get("SELECT id FROM services WHERE id = ?", [serviceId]);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Service not found." });
    }

    let parsed;
    try {
      parsed = parseServiceBody(req.body);
    } catch (err) {
      const response = serviceErrorResponse(err, res);
      if (response) {
        return response;
      }
      throw err;
    }

    const active = req.body && req.body.active === false ? 0 : 1;

    await db.run(
      `
      UPDATE services
      SET section = ?, category = ?, name = ?, cart_name = ?, price = ?, price_label = ?, add_to_cart = ?, active = ?
      WHERE id = ?
    `,
      [
        parsed.section,
        parsed.category,
        parsed.name,
        parsed.cart_name,
        parsed.price,
        parsed.price_label,
        parsed.add_to_cart,
        active,
        serviceId
      ]
    );

    await catalog.refreshCatalog();

    const row = await db.get(
      `
      SELECT id, section, category, name, cart_name, price, price_label, add_to_cart, sort_order, active
      FROM services WHERE id = ?
    `,
      [serviceId]
    );

    res.json({ ok: true, service: catalog.rowToEntry(row) });
  })
);

router.delete(
  "/:id",
  authRequired,
  adminRequired,
  authWriteLimiter,
  asyncHandler(async function (req, res) {
    const serviceId = Number(req.params.id);
    const result = await db.run("UPDATE services SET active = 0 WHERE id = ?", [serviceId]);
    if (!result.changes) {
      return res.status(404).json({ ok: false, error: "Service not found." });
    }

    await catalog.refreshCatalog();
    res.json({ ok: true });
  })
);

module.exports = router;
