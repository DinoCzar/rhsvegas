const db = require("./db");
const schedule = require("./services/availability-schedule");

async function ensureAvailabilitySynced() {
  const weeklyRow = await db.get("SELECT COUNT(*) AS count FROM weekly_availability");
  const weeklyCount = weeklyRow ? weeklyRow.count : 0;
  if (!weeklyCount) {
    return;
  }

  const userCount = await schedule.syncAllActiveUsers();
  if (!userCount) {
    return;
  }

  console.log(
    "[availability] Regenerated booking slots for " + userCount + " active staff member(s)."
  );
}

module.exports = { ensureAvailabilitySynced };
