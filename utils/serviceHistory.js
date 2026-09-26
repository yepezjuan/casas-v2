const SERVICE_HISTORY_DAYS = 45;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const Client = require("../models/Client");

function toDateKey(value) {
  return DATE_KEY.test(value) ? value : null;
}

function daysAgoKey(n) {
  const now = Date.now();

  return new Date(now - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function recordServiceHistory(clientIds, userId, date) {
  const key = toDateKey(date);

  if (clientIds.length == 0 || key == null) return;

  return await Client.updateMany(
    { _id: { $in: clientIds }, userId },
    { $addToSet: { serviceHistory: key } },
  );
}

function readServiceHistory(history = []) {
  const today = daysAgoKey(0);
  const cutoff = daysAgoKey(SERVICE_HISTORY_DAYS);

  return history
    .filter((date) => date >= cutoff && date < today)
    .sort((a, b) => b.localeCompare(a));
}

module.exports = { recordServiceHistory, readServiceHistory };
