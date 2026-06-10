const BOOKING_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied"
};

const ACTIVE_BOOKING_STATUSES = [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED];

function activeStatusSql(column) {
  return column + " IN ('pending', 'approved')";
}

module.exports = {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
  activeStatusSql
};
