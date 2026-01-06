
const { LoadBooking } = require('../../modals/bookingSchema');
const { PublishLoad } = require('../../modals/loadSchema')
const { emitToUser } = require('../../config/socket');
const {getGoogleDistance} = require('../../utils/distance');
const { CommonMessages, LoadMessages, StatusCodes, LoadSocketMessages } = require('../../constants/constants');


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
    emitToUser(load.userId, LoadSocketMessages.BOOKING_CREATED, {
      bookingId: booking._id,
      loadId: load._id,
      message: LoadSocketMessages.BOOKING_REQUESTS
    });

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

    //real time update
    emitToUser(booking.bookedBy, LoadSocketMessages.BOOKING_APPROVED, {
      bookingId: booking._id,
      loadId: booking.loadId,
      message: LoadSocketMessages.BOOKING_APPROVED_SUCCESS
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
      emitToUser(b.bookedBy, LoadSocketMessages.BOOKING_REJECTED, {
        bookingId: b._id,
        loadId: booking.loadId,
        message: LoadSocketMessages.BOOKING_REJECTED_MESSAGE
      });
    });

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadSocketMessages.BOOKING_SUCCESS,
      approvedUser: {
        id: booking.bookedBy._id,
        name: booking.bookedBy.name,
        email: booking.bookedBy.email,
        phone: booking.bookedBy.phone
      }
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

    const notifyUser =
      String(booking.bookedBy) === req.id
        ? booking.ownerId
        : booking.bookedBy;

    emitToUser(notifyUser, LoadSocketMessages.BOOKING_CANCELLED, {
      bookingId: booking._id,
      loadId: booking.loadId,
      message: LoadSocketMessages.BOOKING_CANCELLED_MESSAGE
    });

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
      .populate("bookedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const response = requests.map(r => ({
      bookingId: r._id,
      name: r.bookedBy?.name || "Anonymous user",
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




module.exports = { bookLoad, approveLoad, rejectLoad, bookingRequests }