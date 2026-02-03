const calculateRoute = async (fromLat, fromLng, toLat, toLng) => {
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${fromLat},${fromLng}` +
    `&destinations=${toLat},${toLng}` +
    `&mode=driving` +
    `&units=metric` +
    `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Google Maps API request failed");
  }

  const data = await response.json();
  const element = data.rows?.[0]?.elements?.[0];

  if (!element || element.status !== "OK") {
    throw new Error("Invalid Google Maps distance response");
  }

  return {
    distanceText: element.distance.text,           // "569 km"
    durationText: element.duration.text,           // "9 hours 40 mins"
  };
}

const calculateCurrentFromLocation = async ({ originLat, originLng, destinations }) => {

  const destinationsStr = destinations
    .map((d) => `${d.lat},${d.lng}`)
    .join("|");

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${originLat},${originLng}` +
    `&destinations=${destinationsStr}` +
    `&mode=driving&units=metric` +
    `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const resp = await fetch(url);
  const data = await resp.json();
  return data;
};
module.exports = { calculateRoute, calculateCurrentFromLocation };
