
const { LoadBooking } = require('../../modals/bookingSchema');
const { PublishLoad } = require('../../modals/loadSchema')
const { emitToUser } = require('../../config/socket');
const { calculateRoute } = require('../../utils/distance');
const { haversineDistanceKm } = require('../../utils/haversine')
const { CommonMessages, LoadMessages, StatusCodes, LoadSocketMessages } = require('../../constants/constants');

const { sendPushToUser } = require('../../utils/sendFcm');
const { formatDate } = require('../../utils/utils');
// =====  Book Load ====== //
const bookLoad = async (req, res) => {
  try {
    const { loadId } = req.params;
    const { fromLat, fromLng } = req.body;

    const load = await PublishLoad.findOne({ _id: loadId, status: "active" });
    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({ status: CommonMessages.FALSE, message: LoadMessages.BOOK_LOAD_NOT_FOUND });
    }

    if (String(load.userId) === req.id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ status: CommonMessages.FALSE, message: LoadMessages.BOOK_OWN_LOAD });
    }

    const existing = await LoadBooking.findOne({
      loadId,
      bookedBy: req.id
    });

    if (existing) {
      return res.status(StatusCodes.BAD_REQUEST).json({ status: CommonMessages.FALSE, message: LoadMessages.ALREADY_BOOKED_LOAD });
    }

    // Block driver from booking new load if already active
    const activeBooking = await LoadBooking.findOne({
      bookedBy: req.id,
      status: { $in: ["scheduled", "picked_up", "in_transit"] }
    });

    if (activeBooking) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: "You already have an active booking. Complete it before booking another."
      });
    }

    const distance = await calculateRoute(
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
    emitToUser(load.userId, LoadSocketMessages.BOOKING_CREATED, {
      bookingId: booking._id,
      loadId: load._id,
      message: LoadSocketMessages.BOOKING_REQUESTS
    });

    await sendPushToUser(
      load.userId,
      "New Booking Request 🚚",
      `From : ${load.from.city}\nTo : ${load.to.city}\nScheduled at : ${formatDate(load.scheduleDate)}`,
      {
        bookingId: booking._id,
        loadId: load._id,
        type: "BOOKING_CREATED",
      }
    );

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadMessages.BOOK_LOAD_SUCCESS,
      data: booking
    });

  } catch (error) {
    console.error(CommonMessages.BOOK_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
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
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: LoadMessages.BOOKING_NOT_FOUND
      });
    }

    // Check if load already approved
    const alreadyApproved = await LoadBooking.findOne({
      loadId: booking.loadId._id,
      status: "approved"
    });

    if (alreadyApproved) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: LoadMessages.BOOKING_APPROVED_OTHER_USER
      });
    }

    // Approve this booking
    booking.status = "approved";
    await booking.save();

    console.log("booked", booking.bookedBy);

    //real time update
    emitToUser(booking.bookedBy._id, LoadSocketMessages.BOOKING_APPROVED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      message: LoadSocketMessages.BOOKING_APPROVED_SUCCESS
    });

    emitToUser(booking.ownerId, LoadSocketMessages.BOOKING_APPROVED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      message: LoadSocketMessages.BOOKING_APPROVED_SUCCESS
    });

    //push notification
    await sendPushToUser(
      booking.bookedBy._id,
      "New Booking Request",
      "You received a new booking request for your load",
      { bookingId: booking.bookedBy._id, loadId: booking.loadId._id, type: "BOOKING_CREATED" }
    );

    await sendPushToUser(
      booking.ownerId,
      "New Booking Request",
      "You received a new booking request for your load",
      { bookingId: booking._id, loadId: booking.loadId._id, type: "BOOKING_CREATED" }
    );

    // Mark load as completed
    await PublishLoad.updateOne(
      { _id: booking.loadId._id },
      { $set: { status: "booked" } }
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
      emitToUser(b.bookedBy._id, LoadSocketMessages.BOOKING_REJECTED, {
        bookingId: b._id,
        loadId: booking.loadId._id,
        message: LoadSocketMessages.BOOKING_REJECTED_MESSAGE
      });
    });

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadSocketMessages.BOOKING_SUCCESS,
      // approvedUser: {
      //   id: booking.bookedBy._id,
      //   name: booking.bookedBy.name,
      //   email: booking.bookedBy.email,
      //   phone: booking.bookedBy.phone
      // }
    });

  } catch (error) {
    console.error(CommonMessages.APPROVE_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
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
      return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: LoadMessages.BOOKING_NOT_FOUND });
    }

    if (
      String(booking.bookedBy) !== req.id &&
      String(booking.ownerId) !== req.id
    ) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ status: false, message: CommonMessages.UNAUTHORIZED });
    }

    booking.status = "cancelled";
    booking.cancelledBy =
      String(booking.bookedBy) === req.id ? "booker" : "owner";

    await booking.save();

    //notify user
    emitToUser(booking.bookedBy, LoadSocketMessages.BOOKING_CANCELLED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      message: LoadSocketMessages.BOOKING_CANCELLED_MESSAGE
    });

    //notify owner
    //  emitToUser(booking.ownerId, LoadSocketMessages.BOOKING_CANCELLED, {
    //   bookingId: booking._id,
    //   loadId: booking.loadId._id,
    //   message: LoadSocketMessages.BOOKING_CANCELLED_MESSAGE
    // });

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadSocketMessages.BOOKING_CANCELLED_MESSAGE
    });

  } catch (error) {
    console.error(CommonMessages.CANCEL_BOOKING_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
  }
}


// =====  Boooked Requests ====== //
const bookingRequests = async (req, res) => {
  try {
    const { loadId } = req.params;

    const requests = await LoadBooking.find({
      ownerId: req.id,
      loadId,
      status: "pending"
    })
      .populate("bookedBy", "name userImage")
      .sort({ createdAt: -1 })
      .lean();

    const response = requests.map(r => ({
      bookingId: r._id,
      name: r.bookedBy?.name,
      userImage: r.bookedBy.userImage,
      distanceText: r.distanceText || null,
      durationText: r.durationText || null,
      createdAt: r.createdAt
    }));

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadMessages.PENDING_REQUESTS,
      data: response
    });

  } catch (error) {
    console.error(CommonMessages.BOOKING_REQUESTS_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};


//===== cancel pending and approved requests by booked user ======= //

// ===== Cancel Booking (Booker only) ===== //
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await LoadBooking.findById(bookingId);

    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        message: LoadMessages.BOOKING_NOT_FOUND
      });
    }

    // Only booker can cancel
    if (String(booking.bookedBy) !== req.id) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: CommonMessages.UNAUTHORIZED
      });
    }

    // Already cancelled
    if (booking.status === "cancelled") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: LoadMessages.BOOKING_ALREADY_CANCELLED
      });
    }

    // Allowed statuses: pending OR approved
    if (!["pending", "approved"].includes(booking.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: LoadMessages.INVALID_BOOKING_STATUS
      });
    }

    booking.status = "cancelled";
    booking.cancelledBy = "booker";
    await booking.save();

    // Notify both sides
    emitToUser(booking.bookedBy, LoadSocketMessages.BOOKING_CANCELLED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      message: LoadSocketMessages.BOOKING_CANCELLED_MESSAGE
    });

    emitToUser(booking.ownerId, LoadSocketMessages.BOOKING_CANCELLED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      message: LoadSocketMessages.BOOKING_CANCELLED_MESSAGE
    });

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadSocketMessages.BOOKING_CANCELLED_MESSAGE
    });

  } catch (error) {
    console.error(CommonMessages.CANCEL_BOOKING_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};


//============ update status ================//

const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, lat, lng } = req.body;

    const booking = await LoadBooking.findById(bookingId).populate("loadId");

    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        message: LoadMessages.BOOKING_NOT_FOUND
      });
    }

    // ✅ update flow starts only after approve
    if (booking.status === "pending") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: "Booking not approved yet"
      });
    }

    const isOwner = String(booking.ownerId) === req.id;
    const isBooker = String(booking.bookedBy) === req.id;

    /**
     * FLOW:
     * approved -> confirmed
     * confirmed -> picked_up (AUTO becomes in_transit)
     * in_transit -> delivered (AUTO becomes completed)
     */
    const allowedFlow = {
      approved: ["confirm"],
      confirm: ["picked_up"],
      in_transit: ["delivered"]
    };

    // ✅ validate transition
    if (!allowedFlow[booking.status]?.includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: "Invalid status transition"
      });
    }

    // ✅ role access
    if (status === "confirm" && !isOwner) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: "Only owner can do this action"
      });
    }

    if (["picked_up", "delivered"].includes(status) && !isBooker) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: "Only driver/booker can do this action"
      });
    }

    // ✅ pickup/delivery 1KM validation
    if (["picked_up", "delivered"].includes(status)) {
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: CommonMessages.FALSE,
          message: "lat and lng required"
        });
      }

      const pickupLat = booking.loadId.from.location.coordinates[1];
      const pickupLng = booking.loadId.from.location.coordinates[0];

      const dropLat = booking.loadId.to.location.coordinates[1];
      const dropLng = booking.loadId.to.location.coordinates[0];

      // ✅ Validate pickup distance
      if (status === "picked_up") {
        const distance = haversineDistanceKm(lat, lng, pickupLat, pickupLng);

        if (distance > 1) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            status: CommonMessages.FALSE,
            message: `You must be within 1KM of pickup location`
          });
        }

        // ✅ pickup proof
        booking.pickedUpAt = new Date();
        booking.pickupProof = { lat, lng, at: new Date() };

        // ✅ also set transit time because now it directly goes to transit
        booking.inTransitAt = new Date();
      }

      // ✅ Validate delivery distance
      if (status === "delivered") {
        const distance = haversineDistanceKm(lat, lng, dropLat, dropLng);

        if (distance > 1) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            status: CommonMessages.FALSE,
            message: `You must be within 1KM of delivery location`
          });
        }

        booking.deliveredAt = new Date();
        booking.deliveryProof = { lat, lng, at: new Date() };

        // AUTO COMPLETE when delivered
        booking.completedAt = new Date();
      }
    }

    // STATUS SET (AUTOMATION)
    // picked_up -> in_transit
    // delivered -> completed
    if (status === "picked_up") {
      booking.status = "in_transit";
    } else if (status === "delivered") {
      booking.status = "completed";
    } else {
      booking.status = status;
    }

    // // ✅ timestamps for scheduled
    // if (status === "scheduled") booking.scheduledAt = scheduledAt || new Date();

    await booking.save();

    // ✅ final status to emit
    const finalStatus =
      status === "picked_up"
        ? "in_transit"
        : status === "delivered"
          ? "completed"
          : status;

    // ✅ notify both status updated
    emitToUser(booking.bookedBy, LoadSocketMessages.BOOKING_STATUS_UPDATED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      status: finalStatus
    });

    emitToUser(booking.ownerId, LoadSocketMessages.BOOKING_STATUS_UPDATED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      status: finalStatus
    });

    // tracking will start when status is in_transit
    if (booking.status === "in_transit") {
      emitToUser(booking.ownerId, LoadSocketMessages.TRACKING_START, { bookingId: booking._id });
      emitToUser(booking.bookedBy, LoadSocketMessages.TRACKING_START, { bookingId: booking._id });
    }

    // Stop tracking when delivered (because now completed)
    if (status === "delivered") {
      emitToUser(booking.ownerId, LoadSocketMessages.TRACKING_STOP, {
        bookingId: booking._id
      });

      emitToUser(booking.bookedBy, LoadSocketMessages.TRACKING_STOP, {
        bookingId: booking._id
      });

      // ✅ mark load completed too
      await PublishLoad.updateOne(
        { _id: booking.loadId._id },
        { $set: { status: "completed" } }
      );
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: "Booking status updated successfully",
      data: booking
    });

  } catch (error) {
    console.error("updateBookingStatus error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};






module.exports = { bookLoad, approveLoad, rejectLoad, bookingRequests, cancelBooking, updateBookingStatus }