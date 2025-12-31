
const { LoadBooking } = require('../../modals/bookingSchema');
const { PublishLoad } = require('../../modals/loadSchema')
const { emitToUser } = require('../../config/socket');
const {getGoogleDistance} = require('../../utils/distance');


// =====  Book Load ====== //
const bookLoad = async (req, res) => {
  try {
    const { loadId } = req.params;
    const { fromLat, fromLng } = req.body;

    const load = await PublishLoad.findOne({ _id: loadId, status: "active" });
    if (!load) {
      return res.status(404).json({ status: false, message: "Load not found or inactive" });
    }

    if (String(load.userId) === req.id) {
      return res.status(400).json({ status: false, message: "You cannot book your own load" });
    }

    const existing = await LoadBooking.findOne({
      loadId,
      bookedBy: req.id
    });

    if (existing) {
      return res.status(400).json({ status: false, message: "Already booked this load" });
    }

    const distance = await getGoogleDistance(
      fromLat,
      fromLng,
      load.from.location.coordinates[1],
      load.from.location.coordinates[0]
    );
    const booking = await LoadBooking.create({
      loadId,
      bookedBy: req.id,
      ownerId: load.userId,
      distanceText: distance.distanceText,
      durationText: distance.durationText,
    });

    // after booking created
    emitToUser(load.userId, "BOOKING_CREATED", {
      bookingId: booking._id,
      loadId: load._id,
      message: "New booking request received"
    });

    return res.status(200).json({
      status: true,
      message: "Load booked successfully",
      data: booking
    });

  } catch (error) {
    console.error("BOOK_LOAD_API", error);
    return res.status(500).json({ status: false, error: "Server error" });
  }
}

// =====  Approve Load ====== //
const approveLoad = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find booking + user details
    const booking = await LoadBooking.findOne({
      _id: bookingId,
      ownerId: req.id,
      status: "pending"
    })
      .populate("bookedBy", "name email phone")
      .populate("loadId");

    if (!booking) {
      return res.status(404).json({
        status: false,
        message: "Booking not found or already processed"
      });
    }

    // Check if load already approved
    const alreadyApproved = await LoadBooking.findOne({
      loadId: booking.loadId._id,
      status: "approved"
    });

    if (alreadyApproved) {
      return res.status(400).json({
        status: false,
        message: "Load already approved for another user"
      });
    }

    // Approve this booking
    booking.status = "approved";
    await booking.save();

    //real time update
    emitToUser(booking.bookedBy, "BOOKING_APPROVED", {
      bookingId: booking._id,
      loadId: booking.loadId,
      message: "Your booking has been approved"
    });

    // Mark load as completed
    await PublishLoad.updateOne(
      { _id: booking.loadId._id },
      { $set: { status: "completed" } }
    );

    // Cancel all other pending bookings automatically
    const rejectedBookings = await LoadBooking.find({
      loadId: booking.loadId,
      status: "pending",
      _id: { $ne: booking._id }
    });

    await LoadBooking.updateMany(
      { _id: { $in: rejectedBookings.map(b => b._id) } },
      { $set: { status: "cancelled", cancelledBy: "owner" } }
    );

    rejectedBookings.forEach(b => {
      emitToUser(b.bookedBy, "BOOKING_REJECTED", {
        bookingId: b._id,
        loadId: booking.loadId,
        message: "Booking rejected (another user approved)"
      });
    });

    return res.status(200).json({
      status: true,
      message: "Booking approved successfully",
      approvedUser: {
        id: booking.bookedBy._id,
        name: booking.bookedBy.name,
        email: booking.bookedBy.email,
        phone: booking.bookedBy.phone
      }
    });

  } catch (error) {
    console.error("APPROVE_BOOKING_API", error);
    return res.status(500).json({
      status: false,
      error: "Server error"
    });
  }
}


// =====  Reject Load ====== //
const rejectLoad = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await LoadBooking.findOne({
      _id: bookingId,
      status: "pending"
    });

    if (!booking) {
      return res.status(404).json({ status: false, message: "Booking not found or already processed" });
    }

    if (
      String(booking.bookedBy) !== req.id &&
      String(booking.ownerId) !== req.id
    ) {
      return res.status(403).json({ status: false, message: "Unauthorized" });
    }

    booking.status = "cancelled";
    booking.cancelledBy =
      String(booking.bookedBy) === req.id ? "booker" : "owner";

    await booking.save();

    const notifyUser =
      String(booking.bookedBy) === req.id
        ? booking.ownerId
        : booking.bookedBy;

    emitToUser(notifyUser, "BOOKING_CANCELLED", {
      bookingId: booking._id,
      loadId: booking.loadId,
      message: "Booking has been cancelled"
    });

    return res.status(200).json({
      status: true,
      message: "Booking cancelled successfully"
    });

  } catch (error) {
    console.error("CANCEL_BOOKING_API", error);
    return res.status(500).json({ status: false, error: "Server error" });
  }
}


// =====  Boooked Requests ====== //
const bookingRequests = async (req, res) => {
  try {
    const requests = await LoadBooking.find({
      ownerId: req.id,
      status: "pending"
    })
      .populate("bookedBy", "name email")
      .populate("loadId", "loadType")
      .sort({ createdAt: -1 })
      .lean();

      // modified response
    const response = requests.map(r => ({
      bookingId: r._id,
      name: r.bookedBy?.name || "Anonymous user",
      distanceText: r.distanceText || null,
      durationText: r.durationText || null
    }));
    return res.status(200).json({
      status: true,
      message: "Pending booking requests",
      data: response
    });

  } catch (error) {
    console.error("BOOKING_REQUESTS_API", error);
    return res.status(500).json({
      status: false,
      error: "Server error"
    });
  }
}


module.exports = { bookLoad, approveLoad, rejectLoad, bookingRequests }