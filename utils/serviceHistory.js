const SERVICE_HISTORY_DAYS = 45;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const Client = require("../models/Client");

function toDateKey(value) {
  // test() stringifies, so a single-element array param would otherwise pass
  if (typeof value !== "string" || !DATE_KEY.test(value)) return null;
  // the regex admits impossible dates (2026-02-29, 2026-13-99); the round-trip
  // rejects them before Mongoose casts them to Invalid Date and throws a 500
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
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

async function clearServiceHistory(clientIds, userId, date) {
  const key = toDateKey(date);

  if (clientIds.length == 0 || key == null) return;

  return await Client.updateMany(
    { _id: { $in: clientIds }, userId },
    { $pull: { serviceHistory: key } },
  );
}

module.exports = {
  toDateKey,
  recordServiceHistory,
  readServiceHistory,
  clearServiceHistory,
};
