
const { LoadBooking } = require('../../modals/bookingSchema');
const { PublishLoad } = require('../../modals/loadSchema')
const { emitToUser } = require('../../config/socket');
const { calculateRoute } = require('../../utils/distance');
const { haversineDistanceKm } = require('../../utils/haversine')
const { CommonMessages, StatusCodes, } = require('../../constants/common.constants');
const { sendPushToUser } = require('../../utils/sendFcm');
const { formatDate } = require('../../utils/utils');
const BookingConstants = require('../../constants/booking.constants');
const logger = require('../../utils/logger');
const PushConstants = require('../../constants/push.constants');
const SocketConstants = require('../../constants/sockets.constants');
const { applyCancellationPenalty } = require("../../utils/ratingPenalty");
const LoadConstants = require('../../constants/load.constants');

// =====  Book Load ====== //
const bookLoad = async (req, res) => {
  try {
    const { loadId } = req.params;
    const { fromLat, fromLng } = req.body;

    const load = await PublishLoad.findOne({
      _id: loadId,
      status: BookingConstants.ACTIVE_STATUS
    });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.LOAD_NOT_FOUND
      });
    }

    if (String(load.userId) === req.id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.OWN_LOAD
      });
    }

    const existing = await LoadBooking.findOne({
      loadId,
      bookedBy: req.id
    });

    if (existing) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOKED_LOAD
      });
    }

    // Block driver from booking new load if already active
    const activeBooking = await LoadBooking.findOne({
      bookedBy: req.id,
      status: { $in: BookingConstants.BLOCK_DRIVER }
    });

    if (activeBooking) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.ACTIVE_BOOKING
      });
    }

    const pendingExpiresAt = new Date(Date.now() + BookingConstants.PENDING_BOOK_EXPIRES);

    let distance = null

    try {
      distance = await calculateRoute(
        fromLat,
        fromLng,
        load.from.location.coordinates[1],
        load.from.location.coordinates[0]
      );
    } catch (err) {
      logger.error(err, LoadConstants.GOOGLE_DISTANCE);
    }
    const booking = await LoadBooking.create({
      loadId,
      bookedBy: req.id,
      ownerId: load.userId,
      distanceText: distance?.distanceText,
      durationText: distance?.durationText,
      status: BookingConstants.PENDING_STATUS,
      pendingExpiresAt
    });

    const pendingCount = await LoadBooking.countDocuments({
      loadId,
      status: BookingConstants.PENDING_STATUS
    });
    
    // after booking created
    emitToUser(load.userId, SocketConstants.BOOKING_CREATED, {
      bookingId: booking._id,
      loadId: load._id,
      status: `${SocketConstants.BOOKING_MSG}(${pendingCount})`
    });

    sendPushToUser(
      load.userId,
      PushConstants.BOOK_TITLE,
      PushConstants.BOOK_MSG(load),
      {
        bookingId: booking._id,
        loadId: load._id,
        type: SocketConstants.BOOKING_CREATED,
      }
    ).catch((err) =>
      logger.error(err, "Push Error:")
    );

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: BookingConstants.BOOK_SUCCESS,
      data: booking
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOKED_LOAD
      });
    }
    logger.error(err, BookingConstants.BOOK_LOAD_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}

// =====  Approve Load ====== //
const approveLoad = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find booking (only pending + owner)
    const booking = await LoadBooking.findOne({
      _id: bookingId,
      ownerId: req.id,
      status: BookingConstants.PENDING_STATUS
    }).populate("loadId");

    if (!booking) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOKING_NOT_FOUND
      });
    }

    // Prevent approving if already assigned
    const alreadyApproved = await LoadBooking.findOne({
      loadId: booking.loadId._id,
      status: BookingConstants.APPROVED_STATUS
    });

    if (alreadyApproved) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.APPROVED_OTHER_USER
      });
    }

    // Atomic approval
    const updatedBooking = await LoadBooking.findOneAndUpdate(
      {
        _id: bookingId,
        ownerId: req.id,
        status: BookingConstants.PENDING_STATUS
      },
      {
        $set: {
          status: BookingConstants.APPROVED_STATUS,
        }
      },
      { new: true }
    )
      .populate("bookedBy")
      .populate("loadId");

    if (!updatedBooking) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOKING_NOT_FOUND
      });
    }

    // Update load status
    await PublishLoad.updateOne(
      { _id: updatedBooking.loadId._id },
      { $set: { status: BookingConstants.BOOKED_STATUS } }
    );

    // Reject other pending bookings
    const rejectedBookings = await LoadBooking.find({
      loadId: updatedBooking.loadId._id,
      status: BookingConstants.PENDING_STATUS,
      _id: { $ne: updatedBooking._id }
    }).populate("bookedBy", "_id");

    await LoadBooking.updateMany(
      { _id: { $in: rejectedBookings.map(b => b._id) } },
      {
        $set: {
          status: BookingConstants.CANCELLED_STATUS,
          cancelledBy: BookingConstants.CANCELLED_BY_OWNER
        }
      }
    );

    /*
     REAL-TIME EVENTS
    */
    emitToUser(updatedBooking.bookedBy._id, SocketConstants.BOOKING_APPROVED, {
      bookingId: updatedBooking._id,
      loadId: updatedBooking.loadId._id,
      status: SocketConstants.BOOK_APPROVED_MSG
    });

    emitToUser(updatedBooking.ownerId, SocketConstants.BOOKING_APPROVED, {
      bookingId: updatedBooking._id,
      loadId: updatedBooking.loadId._id,
      status: SocketConstants.BOOK_APPROVED_MSG
    });

    rejectedBookings.forEach(b => {
      emitToUser(b.bookedBy._id, SocketConstants.BOOKING_REJECTED, {
        bookingId: b._id,
        loadId: updatedBooking.loadId._id,
        status: SocketConstants.BOOK_REJ_MSG
      });
    });

    /*
     PUSH NOTIFICATIONS (NON-BLOCKING)
    */

    sendPushToUser(
      updatedBooking.bookedBy._id,
      PushConstants.APPROVE_TITLE,
      PushConstants.APPROVE_MSG(updatedBooking),
      {
        bookingId: updatedBooking._id.toString(),
        loadId: updatedBooking.loadId._id.toString(),
        type: SocketConstants.BOOKING_APPROVED
      }
    ).catch(err => logger.error(err, "Push Error"));

    Promise.all(
      rejectedBookings.map(b =>
        sendPushToUser(
          b.bookedBy._id,
          PushConstants.REJECT_TITLE,
          PushConstants.REJECT_MSG(updatedBooking),
          {
            bookingId: b._id.toString(),
            loadId: updatedBooking.loadId._id.toString(),
            type: SocketConstants.BOOKING_REJECTED
          }
        )
      )
    ).catch((err) => logger.error(err, "push Error"));

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: BookingConstants.APPROVE_SUCCESS
    });

  } catch (err) {
    logger.error(err, BookingConstants.APPROVE_LOAD_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};


// =====  Reject Load ====== //
const rejectLoad = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await LoadBooking.findOneAndUpdate(
      {
        _id: bookingId,
        ownerId: req.id,
        status: BookingConstants.PENDING_STATUS
      },
      {
        $set: {
          status: BookingConstants.CANCELLED_STATUS,
          cancelledBy: BookingConstants.CANCELLED_BY_OWNER
        }
      },
      { new: true }
    ).populate("loadId");

    if (!booking) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOKING_NOT_FOUND
      });
    }

    // check if any pending bookings remain
    const remainingPending = await LoadBooking.countDocuments({
      loadId: booking.loadId._id,
      status: BookingConstants.PENDING_STATUS
    });

    /*
      REAL-TIME EVENT
    */
    emitToUser(booking.bookedBy, SocketConstants.BOOKING_REJECTED, {
      bookingId: booking._id,
      loadId: booking.loadId._id,
      message: SocketConstants.BOOK_REJ_MSG
    });

    /*
      PUSH (NON-BLOCKING)
    */
    sendPushToUser(
      booking.bookedBy,
      PushConstants.REJECT_TITLE,
      PushConstants.REJECT_MSG(booking),
      {
        bookingId: booking._id.toString(),
        loadId: booking.loadId._id.toString(),
        type: SocketConstants.BOOKING_REJECTED
      }
    ).catch(err => logger.error(err, "Push Error"));


    if (remainingPending === 0) {
      emitToUser(booking.ownerId, SocketConstants.BOOKING_ACTIVE, {
        loadId: booking.loadId._id,
        status: SocketConstants.BOOK_ACTIVE_MSG
      });
    }


    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: BookingConstants.REJECT_SUCCESS
    });

  } catch (err) {
    logger.error(err, BookingConstants.REJECT_LOAD_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};


// ===== Cancel Booking ===== //
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await LoadBooking.findById(bookingId).populate("loadId");

    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOKING_NOT_FOUND
      });
    }

    const isBooker = String(booking.bookedBy) === req.id;
    const isOwner = String(booking.ownerId) === req.id;

    if (!isBooker && !isOwner) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: CommonMessages.UNAUTHORIZED
      });
    }

    if (booking.status === BookingConstants.CANCELLED_STATUS) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOKING_CANCELLED
      });
    }

    if (!BookingConstants.ALLOWED_CANCEL.includes(booking.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.INVALID_STATUS_FLOW
      });
    }

    // penalty logic
    if (booking.status === BookingConstants.APPROVED_STATUS) {
      if (isBooker) {
        await applyCancellationPenalty(booking.bookedBy, "TruckOwner");
      } else {
        await applyCancellationPenalty(booking.ownerId, "Transporter");
      }
    }

    // atomic cancel update
    const updatedBooking = await LoadBooking.findOneAndUpdate(
      {
        _id: bookingId,
        status: { $in: BookingConstants.ALLOWED_CANCEL }
      },
      {
        $set: {
          status: BookingConstants.CANCELLED_STATUS,
          cancelledBy: isBooker
            ? BookingConstants.CANCEL_BY_USER
            : BookingConstants.CANCELLED_BY_OWNER
        }
      },
      { new: true }
    ).populate("loadId");

    if (
      isBooker &&
      updatedBooking.loadId?.status === BookingConstants.BOOKED_STATUS
    ) {
      await PublishLoad.updateOne(
        {
          _id: updatedBooking.loadId._id,
          status: BookingConstants.BOOKED_STATUS
        },
        {
          $set: { status: BookingConstants.ACTIVE_STATUS }
        }
      );
    }
    /*
      REAL-TIME EVENTS
    */
    if (isBooker) {

      emitToUser(updatedBooking.bookedBy, SocketConstants.BOOKING_CANCELLED, {
        bookingId: updatedBooking._id,
        loadId: updatedBooking.loadId._id,
        message: SocketConstants.BOOK_CANCEL_MSG
      });

      emitToUser(updatedBooking.ownerId, SocketConstants.BOOKING_ACTIVE, {
        bookingId: updatedBooking._id,
        loadId: updatedBooking.loadId._id,
        message: SocketConstants.BOOK_ACTIVE_MSG
      });

    } else {

      emitToUser(updatedBooking.bookedBy, SocketConstants.BOOKING_CANCELLED, {
        bookingId: updatedBooking._id,
        loadId: updatedBooking.loadId._id,
        message: SocketConstants.BOOK_CANCEL_MSG
      });

      emitToUser(updatedBooking.ownerId, SocketConstants.BOOKING_CANCELLED, {
        bookingId: updatedBooking._id,
        loadId: updatedBooking.loadId._id,
        message: SocketConstants.BOOK_CANCEL_MSG
      });
    }


    /*
      PUSH (NON-BLOCKING)
    */
    if (isBooker) {
      sendPushToUser(
        updatedBooking.ownerId,
        PushConstants.CANCEL_TITLE,
        PushConstants.CANCEL_OWNER_MSG(updatedBooking),
        {
          bookingId: updatedBooking._id.toString(),
          loadId: updatedBooking.loadId._id.toString(),
          type: SocketConstants.BOOKING_CANCELLED
        }
      ).catch(logger.error);
    } else {
      sendPushToUser(
        updatedBooking.bookedBy,
        PushConstants.CANCEL_TITLE,
        PushConstants.CANCEL_USER_MSG(updatedBooking),
        {
          bookingId: updatedBooking._id.toString(),
          loadId: updatedBooking.loadId._id.toString(),
          type: SocketConstants.BOOKING_CANCELLED
        }
      ).catch(logger.error);
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: BookingConstants.CANCEL_SUCCESS
    });

  } catch (err) {
    logger.error(err, BookingConstants.CANCEL_LOAD_LOG);
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
        message: BookingConstants.BOOKING_NOT_FOUND
      });
    }

    if (booking.status === BookingConstants.PENDING_STATUS) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.BOOK_NOT_APPROVED
      });
    }

    const allowedFlow = {
      [BookingConstants.APPROVED_STATUS]: [BookingConstants.START_TRIP],
      [BookingConstants.START_TRIP]: [BookingConstants.REACHED_PICKUP],
      [BookingConstants.REACHED_PICKUP]: [BookingConstants.PICKED_UP],
      [BookingConstants.IN_TRANSIT]: [BookingConstants.DELIVERED],
    };

    if (!allowedFlow[booking.status]?.includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: BookingConstants.INVALID_STATUS_FLOW
      });
    }

    const pickupLat = booking.loadId?.from?.location?.coordinates?.[1];
    const pickupLng = booking.loadId?.from?.location?.coordinates?.[0];
    const dropLat = booking.loadId?.to?.location?.coordinates?.[1];
    const dropLng = booking.loadId?.to?.location?.coordinates?.[0];

    if (BookingConstants.ALLOWED_STATUS.includes(status)) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: CommonMessages.FALSE,
          message: BookingConstants.COORD_REQUIRED
        });
      }

      if (status === BookingConstants.START_TRIP) {
        booking.startedTripAt = new Date();

        const otherBookings = await LoadBooking.find({
          bookedBy: booking.bookedBy,
          _id: { $ne: booking._id },
          status: {
            $in: [
              BookingConstants.PENDING_STATUS,
              BookingConstants.APPROVED_STATUS
            ]
          }
        }).populate("loadId");

        for (const other of otherBookings) {
          const wasApproved =
            other.status === BookingConstants.APPROVED_STATUS;

          // cancel booking
          other.status = BookingConstants.CANCELLED_STATUS;
          other.cancelledAt = new Date();
          await other.save();

          /*
            ONLY APPROVED → transporter notifications
          */
          if (wasApproved) {
            await PublishLoad.updateOne(
              { _id: other.loadId._id },
              { $set: { status: LoadConstants.LOAD_STATUS_ACTIVE } }
            );

            emitToUser(other.ownerId, SocketConstants.BOOKING_ACTIVE, {
              loadId: other.loadId._id,
              status: SocketConstants.BOOK_ACTIVE_MSG
            });

            sendPushToUser(
              other.ownerId,
              "Truck unavailable",
              "Truck owner started another trip. Load is active again.",
              {
                loadId: other.loadId._id.toString(),
                type: LoadConstants.LOAD_STATUS_ACTIVE
              }
            ).catch(logger.error);
          }
        }
      }

      if (status === BookingConstants.REACHED_PICKUP) {
        const distance = haversineDistanceKm(lat, lng, pickupLat, pickupLng);
        if (distance > 1) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            status: CommonMessages.FALSE,
            message: BookingConstants.PICKUP_KM_MSG
          });
        }
        booking.reachedPickupAt = new Date();
        booking.reachedPickupProof = { lat, lng, at: new Date() };
      }

      if (status === BookingConstants.PICKED_UP) {
        const distance = haversineDistanceKm(lat, lng, pickupLat, pickupLng);
        if (distance > 1) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            status: CommonMessages.FALSE,
            message: BookingConstants.PICKUP_KM_MSG
          });
        }

        booking.pickedUpAt = new Date();
        booking.pickupProof = { lat, lng, at: new Date() };
        booking.inTransitAt = new Date();
      }

      if (status === BookingConstants.DELIVERED) {
        const distance = haversineDistanceKm(lat, lng, dropLat, dropLng);
        if (distance > 1) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            status: CommonMessages.FALSE,
            message: BookingConstants.DELIVERD_KM_MSG
          });
        }

        booking.deliveredAt = new Date();
        booking.deliveryProof = { lat, lng, at: new Date() };
        booking.completedAt = new Date();
      }
    }

    // STATUS AUTOMATION
    if (status === BookingConstants.PICKED_UP) {
      booking.status = BookingConstants.IN_TRANSIT;
    } else if (status === BookingConstants.DELIVERED) {
      booking.status = BookingConstants.COMPLETED;
    } else {
      booking.status = status;
    }

    // ATOMIC SAVE
    const updatedBooking = await LoadBooking.findOneAndUpdate(
      { _id: bookingId },
      booking.toObject(),
      { new: true }
    );

    const finalStatus =
      status === BookingConstants.PICKED_UP
        ? BookingConstants.IN_TRANSIT
        : status === BookingConstants.DELIVERED
          ? BookingConstants.COMPLETED
          : status;

    emitToUser(updatedBooking.bookedBy, SocketConstants.BOOKING_STATUS, {
      bookingId: updatedBooking._id,
      loadId: booking.loadId._id,
      status: finalStatus
    });

    emitToUser(updatedBooking.ownerId, SocketConstants.BOOKING_STATUS, {
      bookingId: updatedBooking._id,
      loadId: booking.loadId._id,
      status: finalStatus
    });

    if (
      status === BookingConstants.START_TRIP ||
      updatedBooking.status === BookingConstants.IN_TRANSIT
    ) {
      emitToUser(updatedBooking.ownerId, SocketConstants.TRACKING_START, {
        bookingId: updatedBooking._id
      });

      emitToUser(updatedBooking.bookedBy, SocketConstants.TRACKING_START, {
        bookingId: updatedBooking._id
      });
    }

    if (
      status === BookingConstants.REACHED_PICKUP ||
      status === BookingConstants.DELIVERED
    ) {
      emitToUser(updatedBooking.ownerId, SocketConstants.TRACKING_STOP, {
        bookingId: updatedBooking._id
      });

      emitToUser(updatedBooking.bookedBy, SocketConstants.TRACKING_STOP, {
        bookingId: updatedBooking._id
      });

      if (status === BookingConstants.DELIVERED) {
        await PublishLoad.updateOne(
          { _id: booking.loadId._id },
          { $set: { status: BookingConstants.COMPLETED } }
        );
      }
    }

    const routeText = `${booking.loadId.from.city} - ${booking.loadId.to.city}`;

    const pushMap = {

      [BookingConstants.START_TRIP]: {
        title: PushConstants.START_TRIP_TITLE,
        msg: PushConstants.START_TRIP_MSG(routeText),
        type: SocketConstants.TRIP_STARTED,
        receiver: updatedBooking.ownerId,
      },
      [BookingConstants.REACHED_PICKUP]: {
        title: PushConstants.REACHED_PICKUP_TITLE,
        msg: PushConstants.REACHED_PICKUP_MSG(routeText),
        type: SocketConstants.REACHED_PICKUP,
        receiver: updatedBooking.ownerId,
      },
      [BookingConstants.PICKED_UP]: {
        title: PushConstants.PICK_TITLE,
        msg: PushConstants.PICK_MSG(routeText),
        type: SocketConstants.LOAD_PICKED_UP,
        receiver: updatedBooking.ownerId,
      },
      [BookingConstants.DELIVERED]: {
        title: PushConstants.DEL_TITLE,
        msg: PushConstants.DEL_MSG(routeText),
        type: SocketConstants.LOAD_DELIVERED,
        receiver: updatedBooking.ownerId,
      },
    };

    if (pushMap[status]) {
      sendPushToUser(
        pushMap[status].receiver,
        pushMap[status].title,
        pushMap[status].msg,
        {
          bookingId: updatedBooking._id.toString(),
          loadId: booking.loadId._id.toString(),
          type: pushMap[status].type,
          status: finalStatus,
        }
      ).catch(logger.error);
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: BookingConstants.BOOKING_STATUS_SUCCESS,
      data: updatedBooking
    });

  } catch (err) {
    logger.error(err, BookingConstants.UPDATE_STATUS_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};


// =====  Boooked Requests ====== //
const bookingRequests = async (req, res) => {
  try {
    const { loadId } = req.params;

    const requests = await LoadBooking.find({
      ownerId: req.id,
      loadId,
      status: BookingConstants.PENDING_STATUS
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
      expiresAt: r.pendingExpiresAt,
      createdAt: r.createdAt
    }));

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: BookingConstants.BOOK_REQ_SUCCESS,
      data: response
    });

  } catch (err) {
    logger.error(err, BookingConstants.BOOK_REQ_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};





module.exports = { bookLoad, approveLoad, rejectLoad, bookingRequests, cancelBooking, updateBookingStatus }