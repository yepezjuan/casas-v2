const { Client } = require("@googlemaps/google-maps-services-js");

const client = new Client({});

async function geocodeAddress(address) {
  const response = await client.geocode({
    params: {
      address,
      key: process.env.MAPS_API_KEY,
    },
  });

  const results = response.data.results;

  if (!results || results.length === 0) {
    // the address stays out of the message: callers log it
    const err = new Error("No geocoding results found.");
    err.code = "NO_RESULTS";
    throw err;
  }

  const { lat, lng } = results[0].geometry.location;
  return { lat, lng, formattedAddress: results[0].formatted_address };
}

module.exports = { geocodeAddress };
