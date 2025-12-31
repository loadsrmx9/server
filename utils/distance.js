const getGoogleDistance=async(fromLat, fromLng, toLat, toLng)=> {
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

module.exports = {getGoogleDistance};
