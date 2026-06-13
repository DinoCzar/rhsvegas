const express = require("express");
const db = require("../db");
const { authRequired, adminRequired } = require("../middleware/auth");
const { asyncHandler } = require("../async-handler");

const router = express.Router();

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

router.use(express.json({ limit: "5mb" }));

function imageResponse(row, req) {
  return {
    id: row.id,
    caption: row.caption,
    sortOrder: row.sort_order,
    mimeType: row.mime_type,
    imageUrl: "/api/gallery/" + row.id + "/image",
    createdAt: row.created_at
  };
}

function parseUploadBody(body) {
  const caption = String((body && body.caption) || "").trim();
  const mimeType = String((body && body.mimeType) || "").trim().toLowerCase();
  const dataBase64 = String((body && body.dataBase64) || "").trim();

  if (!mimeType || ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error("INVALID_MIME");
  }
  if (!dataBase64) {
    throw new Error("MISSING_IMAGE");
  }

  const buffer = Buffer.from(dataBase64, "base64");
  if (!buffer.length) {
    throw new Error("INVALID_IMAGE");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  return { caption: caption, mimeType: mimeType, imageData: buffer.toString("base64") };
}

router.get(
  "/",
  asyncHandler(async function (req, res) {
    const rows = await db.all(
      "SELECT id, caption, mime_type, sort_order, created_at FROM gallery_images ORDER BY sort_order ASC, id ASC"
    );
    res.json({
      ok: true,
      images: rows.map(function (row) {
        return imageResponse(row, req);
      })
    });
  })
);

router.get(
  "/manage/list",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const rows = await db.all(
      "SELECT id, caption, mime_type, sort_order, created_at FROM gallery_images ORDER BY sort_order ASC, id ASC"
    );
    res.json({
      ok: true,
      images: rows.map(function (row) {
        return imageResponse(row, req);
      })
    });
  })
);

router.get(
  "/:id/image",
  asyncHandler(async function (req, res) {
    const row = await db.get(
      "SELECT id, mime_type, image_data FROM gallery_images WHERE id = ?",
      [Number(req.params.id)]
    );
    if (!row) {
      return res.status(404).json({ ok: false, error: "Image not found." });
    }

    const buffer = Buffer.from(row.image_data, "base64");
    res.set("Cache-Control", "public, max-age=3600");
    res.type(row.mime_type);
    res.send(buffer);
  })
);

router.post(
  "/",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    let upload;
    try {
      upload = parseUploadBody(req.body);
    } catch (err) {
      if (err.message === "INVALID_MIME") {
        return res.status(400).json({ ok: false, error: "Upload a JPG, PNG, WebP, or GIF image." });
      }
      if (err.message === "MISSING_IMAGE" || err.message === "INVALID_IMAGE") {
        return res.status(400).json({ ok: false, error: "Image data is required." });
      }
      if (err.message === "IMAGE_TOO_LARGE") {
        return res.status(400).json({ ok: false, error: "Image must be 3 MB or smaller." });
      }
      throw err;
    }

    const maxRow = await db.get("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM gallery_images");
    const nextOrder = maxRow ? maxRow.max_order + 1 : 0;

    const result = await db.run(
      "INSERT INTO gallery_images (caption, mime_type, image_data, sort_order) VALUES (?, ?, ?, ?)",
      [upload.caption, upload.mimeType, upload.imageData, nextOrder]
    );

    const row = await db.get(
      "SELECT id, caption, mime_type, sort_order, created_at FROM gallery_images WHERE id = ?",
      [result.lastInsertRowid]
    );

    res.status(201).json({
      ok: true,
      image: imageResponse(row, req)
    });
  })
);

router.put(
  "/reorder",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const order = (req.body && req.body.order) || [];
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ ok: false, error: "Order array is required." });
    }

    await db.transaction(async function (tx) {
      for (var i = 0; i < order.length; i += 1) {
        await tx.run("UPDATE gallery_images SET sort_order = ? WHERE id = ?", [i, Number(order[i])]);
      }
    });

    const rows = await db.all(
      "SELECT id, caption, mime_type, sort_order, created_at FROM gallery_images ORDER BY sort_order ASC, id ASC"
    );

    res.json({
      ok: true,
      images: rows.map(function (row) {
        return imageResponse(row, req);
      })
    });
  })
);

router.put(
  "/:id",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const imageId = Number(req.params.id);
    const caption = String((req.body && req.body.caption) || "").trim();
    const existing = await db.get("SELECT id FROM gallery_images WHERE id = ?", [imageId]);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Image not found." });
    }

    await db.run("UPDATE gallery_images SET caption = ? WHERE id = ?", [caption, imageId]);

    const row = await db.get(
      "SELECT id, caption, mime_type, sort_order, created_at FROM gallery_images WHERE id = ?",
      [imageId]
    );

    res.json({
      ok: true,
      image: imageResponse(row, req)
    });
  })
);

router.delete(
  "/:id",
  authRequired,
  adminRequired,
  asyncHandler(async function (req, res) {
    const imageId = Number(req.params.id);
    const result = await db.run("DELETE FROM gallery_images WHERE id = ?", [imageId]);
    if (!result.changes) {
      return res.status(404).json({ ok: false, error: "Image not found." });
    }
    res.json({ ok: true });
  })
);

module.exports = router;
