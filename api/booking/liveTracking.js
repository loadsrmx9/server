const { LoadBooking } = require("../../modals/bookingSchema");
const SocketConstants  = require("../../constants/sockets.constants");
const logger = require('../../utils/logger')

const ONE_HOUR_MS = 60 * 60 * 1000;

const isValidNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isValidLatLng = (lat, lng) =>
  isValidNumber(lat) &&
  isValidNumber(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

const liveTracking = (socket, emitToUser) => {

  socket.on(
    SocketConstants.DRIVER_LOCATION_UPDATE,
    async ({ bookingId, lat, lng }) => {
      try {
        if (!bookingId || !isValidLatLng(lat, lng)) return;

        const booking = await LoadBooking.findById(bookingId);
        if (!booking) return;

        // only in transit
        if (!["StartedTrip", "InTransit"].includes(booking.status)) return;

        // only driver/booker can send
        if (String(booking.bookedBy) !== String(socket.userId)) return;

        // realtime emit to owner
        emitToUser(booking.ownerId, SocketConstants.DRIVER_LOCATION_LIVE, {
          bookingId,
          lat,
          lng,
          updatedAt: Date.now(),
        });

        // DB save once per hour
        const last = booking.driverLocationUpdatedAt
          ? new Date(booking.driverLocationUpdatedAt).getTime()
          : 0;

        const now = Date.now();
        if (now - last < ONE_HOUR_MS) return;

        booking.driverLocation = { type: "Point", coordinates: [lng, lat] };
        booking.driverLocationUpdatedAt = new Date();
        await booking.save();

        logger.info("Saved last driver location");
      } catch (err) {
        logger.error(err, SocketConstants.DRIVER_LOC_LOG);
      }
    }
  );
};

module.exports = { liveTracking };
