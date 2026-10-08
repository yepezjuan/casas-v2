const axios = require("axios");
const Client = require("../models/Client");

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const DEPOT = { lat: 34.1161821, lng: -118.0145946 };
const SERVICE_MINUTES = 40;
// Routes API rejects more than 25 intermediates
const MAX_STOPS = 25;
// Google Maps URLs drop waypoints past 9
const MAX_LINK_STOPS = 9;

// bad input rather than a Google failure, so the controller can answer 400
function inputError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// the one place that decides where a user's route starts and ends. everyone
// shares DEPOT for now; once users can save a starting address on their
// profile, read its coordinates off `user` here and fall back to DEPOT
function resolveOrigin(user) {
  return DEPOT;
}

const waypoint = (p) => ({
  location: { latLng: { latitude: p.lat, longitude: p.lng } },
});

// Routes API returns durations as strings like "1234s"
const secs = (d) => parseInt(d, 10);

function buildDeepLink(depot, orderedClients) {
  if (orderedClients.length > MAX_LINK_STOPS) return null;
  const coord = (p) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin: coord(depot),
    destination: coord(depot),
    waypoints: orderedClients.map(coord).join("|"),
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

async function makeRoute(clients, depot) {
  // Compute at call time — TRAFFIC_AWARE requires a future departure time
  const departureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const body = {
    origin: waypoint(depot),
    destination: waypoint(depot),
    intermediates: clients.map(waypoint),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    optimizeWaypointOrder: true,
    departureTime,
  };

  let data;
  try {
    ({ data } = await axios.post(ROUTES_URL, body, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.MAPS_API_KEY,
        "X-Goog-FieldMask": [
          "routes.optimizedIntermediateWaypointIndex",
          "routes.distanceMeters",
          "routes.duration",
          "routes.legs.distanceMeters",
          "routes.legs.duration",
        ].join(","),
      },
    }));
  } catch (err) {
    const g = err.response && err.response.data && err.response.data.error;
    throw new Error(g ? `${g.status}: ${g.message}` : err.message);
  }

  const route = data.routes && data.routes[0];
  if (!route) throw new Error("Routes API returned no routes.");

  const rawOrder = route.optimizedIntermediateWaypointIndex;
  const order =
    rawOrder &&
    rawOrder.length === clients.length &&
    rawOrder.every((i) => i >= 0 && i < clients.length)
      ? rawOrder
      : clients.map((_, i) => i);
  const orderedClients = order.map((i) => clients[i]);

  const totalDistanceMeters = route.distanceMeters;
  const totalDurationSeconds = secs(route.duration);

  const schedule = [];
  let cursor = Date.now();
  for (let k = 0; k < orderedClients.length; k++) {
    cursor += secs(route.legs[k].duration) * 1000;
    const arrive = new Date(cursor);
    cursor += SERVICE_MINUTES * 60 * 1000;
    const depart = new Date(cursor);
    schedule.push({ name: orderedClients[k].name, arrive, depart });
  }

  const deepLink = buildDeepLink(depot, orderedClients);

  return {
    orderedClients,
    totalDistanceMeters,
    totalDurationSeconds,
    schedule,
    deepLink,
  };
}

async function getRouteForClientIds(clientIds, userId, origin = DEPOT) {
  const docs = await Client.find({ userId, _id: { $in: clientIds } });

  if (!docs.length) throw inputError("This list has no clients.");
  if (docs.length > MAX_STOPS) {
    throw inputError(`A route can have at most ${MAX_STOPS} stops.`);
  }

  // id rides along so the caller can save the optimized order
  const clients = docs.map((c) => ({
    id: c._id,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
  }));

  if (clients.some((c) => c.lat == null || c.lng == null)) {
    throw inputError("One or more clients are missing geocoded coordinates.");
  }

  return makeRoute(clients, origin);
}

module.exports = {
  makeRoute,
  getRouteForClientIds,
  resolveOrigin,
  buildDeepLink,
};
