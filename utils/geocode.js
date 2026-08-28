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
    throw new Error(`No geocoding results found for: ${address}`);
  }

  const { lat, lng } = results[0].geometry.location;
  return { lat, lng };
}

module.exports = { geocodeAddress };
