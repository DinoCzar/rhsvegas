const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function validateImageBuffer(buffer, claimedMime) {
  const detected = detectImageMime(buffer);
  if (!detected || ALLOWED_IMAGE_MIMES.indexOf(detected) === -1) {
    return { ok: false, error: "INVALID_IMAGE" };
  }

  const normalizedClaim = String(claimedMime || "")
    .trim()
    .toLowerCase();
  if (normalizedClaim && normalizedClaim !== detected) {
    return { ok: false, error: "MIME_MISMATCH" };
  }

  return { ok: true, mimeType: detected };
}

module.exports = { detectImageMime, validateImageBuffer, ALLOWED_IMAGE_MIMES };
