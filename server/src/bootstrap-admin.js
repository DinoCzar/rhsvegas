const bcrypt = require("bcryptjs");
const db = require("./db");

async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Admin";

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
    const needsUpdate = !passwordMatches || !existing.active || existing.role !== "admin";

    if (needsUpdate) {
      const hash = bcrypt.hashSync(password, 10);
      await db.run(
        "UPDATE users SET password_hash = ?, name = ?, role = 'admin', active = 1 WHERE id = ?",
        [hash, name, existing.id]
      );
      console.log("Synced admin account from environment:", email);
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
