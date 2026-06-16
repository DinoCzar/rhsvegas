const bcrypt = require("bcryptjs");
const db = require("./db");

async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Admin";
  const isProduction = process.env.NODE_ENV === "production";
  const allowPasswordSync = process.env.ADMIN_SYNC_PASSWORD === "true";

  if (!email || !password) {
    console.warn(
      "ADMIN_EMAIL and ADMIN_PASSWORD not set — admin login will not work until they are configured."
    );
    return;
  }

  if (password.length < 8) {
    console.warn(
      "ADMIN_PASSWORD must be at least 8 characters — admin login will not work until it is updated."
    );
    return;
  }

  const existing = await db.get("SELECT id, password_hash, active, role FROM users WHERE email = ?", [
    email
  ]);

  if (existing) {
    const passwordMatches = bcrypt.compareSync(password, existing.password_hash);
    const needsRoleFix = !existing.active || existing.role !== "admin";

    if (!passwordMatches && allowPasswordSync) {
      const hash = bcrypt.hashSync(password, 10);
      await db.run(
        "UPDATE users SET password_hash = ?, name = ?, role = 'admin', active = 1 WHERE id = ?",
        [hash, name, existing.id]
      );
      console.log("Synced admin password from environment:", email);
      return;
    }

    if (needsRoleFix) {
      await db.run("UPDATE users SET name = ?, role = 'admin', active = 1 WHERE id = ?", [
        name,
        existing.id
      ]);
      console.log("Restored admin account role/active state:", email);
      return;
    }

    if (!passwordMatches && isProduction) {
      console.warn(
        "ADMIN_PASSWORD does not match the stored admin hash. Set ADMIN_SYNC_PASSWORD=true to overwrite on startup."
      );
    }
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  await db.run(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
    [email, hash, name]
  );

  console.log("Created admin user:", email);
}

module.exports = { ensureAdminUser };
