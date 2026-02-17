const { PublishLoad } = require('../../modals/loadSchema');
const { LoadBooking } = require('../../modals/bookingSchema');
const { UserData } = require('../../modals/userSchema');
const { ValidateLoadInput, ResponseModify, mapLoadListItem, mapSearchLoadItem, formatINR } = require('../../utils/utils');
const { RequiredFields, StatusCodes, CommonMessages } = require('../../constants/common.constants');
const { calculateRoute, calculateCurrentFromLocation } = require('../../utils/distance');
const LoadConstants = require('../../constants/load.constants');
const logger = require('../../utils/logger');
const { CANCELLED_BY_OWNER } = require('../../constants/booking.constants');
const BookingConstants = require('../../constants/booking.constants');
const { BOOKING_CANCELLED } = require('../../constants/sockets.constants');
const { emitToUser } = require('../../config/socket');
const { sendPushToUser } = require('../../utils/sendFcm');
const SocketConstants = require('../../constants/sockets.constants');

const searchLoad = async (req, res) => {
  try {
    const { scheduleDate, bodyType, wheelers, page = 1 } = req.body;

    const fromLng = Number(req.body.fromLng);
    const fromLat = Number(req.body.fromLat);
    const toLng = Number(req.body.toLng);
    const toLat = Number(req.body.toLat);
    const driverLat = Number(req.body.driverLat);
    const driverLng = Number(req.body.driverLng);

    const { errors } = await ValidateLoadInput(req.body, RequiredFields.SEARCH_LOAD);

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        errors,
      });
    }

    const limit = LoadConstants.LOADS_LIMIT;
    const pageNo = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNo - 1) * limit;

    // day start/end filter
    const selectedDate = new Date(scheduleDate); // scheduleDate = "YYYY-MM-DD"
    const start = new Date(Date.UTC(
      selectedDate.getUTCFullYear(),
      selectedDate.getUTCMonth(),
      selectedDate.getUTCDate(),
      0, 0, 0, 0
    ));
    const end = new Date(Date.UTC(
      selectedDate.getUTCFullYear(),
      selectedDate.getUTCMonth(),
      selectedDate.getUTCDate(),
      23, 59, 59, 999
    ));

    const vehicleFilters = {};

    if (bodyType) vehicleFilters.bodyType = bodyType
    if (wheelers) vehicleFilters.wheelers = wheelers;

    const bookedLoadIds = await LoadBooking.distinct("loadId", {
      bookedBy: req.id
    });

    // get nearby loads
    const loads = await PublishLoad.aggregate([
      // from location nearby
      {
        $geoNear: {
          near: { type: "Point", coordinates: [fromLng, fromLat] },
          key: "from.location",
          distanceField: "airDistance",
          maxDistance: LoadConstants.FROM_RADIUS,
          spherical: true,
        },
      },

      // only active + scheduled date
      {
        $match: {
          scheduleDateTime: { $gte: start, $lte: end },
          status: LoadConstants.LOAD_STATUS_ACTIVE,
          _id: { $nin: bookedLoadIds },
          ...vehicleFilters
        },
      },

      // to location nearby
      {
        $match: {
          "to.location": {
            $geoWithin: {
              $centerSphere: [
                [toLng, toLat],
                LoadConstants.TO_RADIUS / LoadConstants.EARTH_RADIUS,
              ],
            },
          },
        },
      },

      { $sort: { airDistance: 1 } },

      // pagination
      { $skip: skip },
      { $limit: limit + 1 }, // fetch 1 extra to check next page

      // cleanup
      { $project: { airDistance: 0 } },
    ]);

    // nothing found
    if (!loads.length) {
      return res.status(StatusCodes.OK).json({
        status: CommonMessages.TRUE,
        message: LoadConstants.NO_LOADS,
        data: [],
        meta: {
          page: pageNo,
          limit,
          hasNextPage: false,
          nextPage: null,
        },
      });
    }

    // check next page
    const hasNextPage = loads.length > limit;
    const slicedLoads = hasNextPage ? loads.slice(0, limit) : loads;

    // build destinations list for google
    const destinations = slicedLoads.map((l) => ({
      lat: l.from.location.coordinates[1],
      lng: l.from.location.coordinates[0],
    }));

    // google distance for these 20 loads
    let matrix = null;
    try {
      matrix = await calculateCurrentFromLocation({
        originLat: driverLat,
        originLng: driverLng,
        destinations,
      });
    } catch (err) {
      logger.error(err, LoadConstants.GOOGLE_DISTANCE);
    }

    const elements = matrix?.rows?.[0]?.elements || [];

    // attach distance + duration to each load
    const enrichedLoads = slicedLoads.map((load, index) => {
      const el = elements[index];

      return {
        ...load,
        distanceText: el?.distance?.text || null,
        durationText: el?.duration?.text || null,
      };
    });

    const data = enrichedLoads.map(mapSearchLoadItem);

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadConstants.LOADS_SUCCESS,
      data,
      meta: {
        page: pageNo,
        limit,
        hasNextPage,
        nextPage: hasNextPage ? pageNo + 1 : null,
      },
    });
  } catch (err) {
    logger.error(err, LoadConstants.SEARCHLOAD_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR,
    });
  }
};

const myLoads = async (req, res) => {
  try {
    const { type } = req.query;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = LoadConstants.LOADS_LIMIT; //fixed for infinite scroll
    const skip = (page - 1) * limit;

    let data = [];
    let totalDocs = 0;

    // ================= POSTED =================
    if (type === LoadConstants.POSTED) {
      const query = { userId: req.id };

      totalDocs = await PublishLoad.countDocuments(query);

      const loads = await PublishLoad.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const loadIds = loads.map((l) => l._id);

      const bookings = await LoadBooking.find({
        loadId: { $in: loadIds },
      })
        .select("loadId status")
        .lean();

      const bookingStatusMap = {};
      const pendingCountMap = {};
      bookings.forEach((b) => {

        const loadId = String(b.loadId);
        if (LoadConstants.APPROVED_FLOW.includes(b.status)) {
          bookingStatusMap[loadId] = b.status;
          return;
        }

        if (b.status === LoadConstants.PENDING_STATUS) {
          pendingCountMap[loadId] = (pendingCountMap[loadId] || 0) + 1;

          if (!bookingStatusMap[loadId]) {
            bookingStatusMap[loadId] = LoadConstants.NEW_BOOKING_REQUEST;
          }
        }

      });

      data = loads.map((load) => ({
        ...mapLoadListItem(load),
        bookingStatus: bookingStatusMap[String(load._id)] || LoadConstants.LOAD_STATUS_ACTIVE,
        pendingCount:pendingCountMap[load._id]
      }));
    }

    // ================= REQUESTED =================
    else if (type === LoadConstants.REQUESTED) {
      const query = { bookedBy: req.id };

      totalDocs = await LoadBooking.countDocuments(query);

      const bookings = await LoadBooking.find(query)
        .populate("loadId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      data = bookings
        .filter((b) => b.loadId)
        .map((b) => ({
          ...mapLoadListItem(b.loadId),
          bookingStatus: b.status,
        }));
    }

    else {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: LoadConstants.INVALID_TAB,
      });
    }

    const totalPages = Math.ceil(totalDocs / limit);

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadConstants.LOADS_SUCCESS,
      data,
      meta: {
        page,
        limit,
        totalDocs,
        totalPages,
        hasNextPage: page < totalPages,
        nextPage: page < totalPages ? page + 1 : null,
      },
    });
  } catch (err) {
    logger.error(err, LoadConstants.MYLOADS_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR,
    });
  }
};

const loadDetails = async (req, res) => {
  try {
    const { id } = req.params;

    //  Fetch load
    let loadDetails = await PublishLoad.findById(id).lean();
    if (!loadDetails) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({
          status: CommonMessages.FALSE,
          message: LoadConstants.LOAD_NOT_FOUND
        });
    }

    // Only non-owner increments view
    if (String(loadDetails.userId) !== req.id) {
      loadDetails = await PublishLoad.findOneAndUpdate(
        { _id: id },
        { $addToSet: { viewedBy: req.id } },
        { new: true }
      );
    }

    const viewCount = loadDetails.viewedBy.length;

    let contactDetails = null;

    // OWNER should always see own contact
    const [ownerUser, approvedBooking] = await Promise.all([
      UserData.findById(loadDetails.userId)
        .select("name phone userImage")
        .lean(),

      LoadBooking.findOne({
        loadId: id,
        status: { $in: LoadConstants.CONTACT_VISIBLE_STATUS }
      })
        .populate("bookedBy", "name userImage phone")
        .populate("ownerId", "name userImage phone")
        .lean()
    ]);

    if (String(loadDetails.userId) === req.id && ownerUser) {
      contactDetails = {
        role: LoadConstants.OWNER_ROLE,
        name: ownerUser.name,
        phone: ownerUser.phone,
        userImage: ownerUser.userImage,
        receiverName: loadDetails.receiverName,
        receiverNo: loadDetails.receiverNo
      };
    }

    // Contact visibility logic
    if (approvedBooking) {
      // OWNER sees approved user
      if (String(loadDetails.userId) === req.id) {
        contactDetails = {
          role: LoadConstants.USER_ROLE,
          name: approvedBooking.bookedBy.name,
          phone: approvedBooking.bookedBy.phone,
          userImage: approvedBooking.bookedBy.userImage
        };
      }

      // APPROVED USER sees owner
      else if (String(approvedBooking.bookedBy._id) === req.id) {
        contactDetails = {
          role: LoadConstants.OWNER_ROLE,
          name: approvedBooking.ownerId.name,
          phone: approvedBooking.ownerId.phone,
          userImage: approvedBooking.ownerId.userImage,
        };
        // receiver visible only after pickup
        if (LoadConstants.RECEIVER_VISIBLE_STATUS.includes(approvedBooking.status)) {
          contactDetails.receiverName = loadDetails.receiverName;
          contactDetails.receiverNo = loadDetails.receiverNo;
        }
      }
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadConstants.LOAD_DETAILS_SUCCESS,
      data: {
        ...ResponseModify(loadDetails),
        viewCount,
        contactDetails // only after approval
      }
    });

  } catch (err) {
    logger.error(err, LoadConstants.LOADDETAILS_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}

const publishLoad = async (req, res) => {
  try {

    const fromLat = Number(req.body.fromLat);
    const fromLng = Number(req.body.fromLng);
    const toLat = Number(req.body.toLat);
    const toLng = Number(req.body.toLng);

    if ([fromLat, fromLng, toLat, toLng].some(Number.isNaN)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: LoadConstants.INVALID_COORDS
      });
    }
    const { errors, scheduleUTC } =
      await ValidateLoadInput(req.body, RequiredFields.PUBLISH_LOAD);

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        errors
      });
    }

    let imageData = null;

    if (req.file) {
      imageData = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }
    let distance = { distanceText: null, durationText: null };

    try {
      distance = await calculateRoute(fromLat, fromLng, toLat, toLng);
    } catch (e) {
      logger.error(e, LoadConstants.GOOGLE_DISTANCE);
    }

    const newLoad = await PublishLoad.create({
      userId: req.id,
      //location details
      from: {
        city: req.body.fromCity,
        address: req.body.fromAddress,
        location: {
          type: "Point",
          coordinates: [fromLng, fromLat]
        }
      },

      to: {
        city: req.body.toCity,
        address: req.body.toAddress,
        location: {
          type: "Point",
          coordinates: [toLng, toLat]
        }
      },
      //load details
      amount: formatINR(req.body.amount),
      loadType: req.body.loadType,
      capacity: req.body.capacity,
      truckType: req.body.truckType,
      bodyType: req.body.bodyType,
      wheelers: req.body.wheelers,
      distanceText: distance.distanceText,
      durationText: distance.durationText,
      scheduleDateTime: scheduleUTC,
      loadImage: imageData,
      //contact details
      receiverNo: req.body.receiverNo,
      receiverName: req.body.receiverName,
    });

    await UserData.updateOne(
      { _id: req.id },
      { $inc: { "totalLoads": 1 } }
    );

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadConstants.PUBLISH_SUCCESS,
      data: ResponseModify(newLoad)
    });

  } catch (err) {
    logger.error(err, LoadConstants.PUBLISHLOAD_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}

const updateLoad = async (req, res) => {
  try {
    const { id } = req.params;

    const fromLat = Number(req.body.fromLat);
    const fromLng = Number(req.body.fromLng);
    const toLat = Number(req.body.toLat);
    const toLng = Number(req.body.toLng);

    const load = await PublishLoad.findOne({
      _id: id,
      userId: req.id,
      status: LoadConstants.LOAD_STATUS_ACTIVE
    });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        message: LoadConstants.LOAD_NOT_FOUND
      });
    }
    const { errors } = await ValidateLoadInput(
      req.body,
      RequiredFields.UPDATE_LOAD
    );

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        errors
      });
    }


    // Update from location
    if (
      req.body.fromLat !== undefined &&
      req.body.fromLng !== undefined &&
      req.body.fromAddress
    ) {
      load.from = {
        city: req.body.fromCity,
        address: req.body.fromAddress,
        location: {
          type: "Point",
          coordinates: [fromLng, fromLat]
        }
      };
    }

    // update to location
    if (
      req.body.toLat !== undefined &&
      req.body.toLng !== undefined &&
      req.body.toAddress
    ) {
      load.to = {
        city: req.body.toCity,
        address: req.body.toAddress,
        location: {
          type: "Point",
          coordinates: [toLng, toLat]
        }
      };
    }


    //update distance
    if (
      (fromLat !== undefined && fromLng !== undefined) ||
      (toLat !== undefined && toLng !== undefined)
    ) {
      try {
        const distance = await calculateRoute(
          load.from.location.coordinates[1],
          load.from.location.coordinates[0],
          load.to.location.coordinates[1],
          load.to.location.coordinates[0]
        );

        load.distanceText = distance.distanceText;
        load.durationText = distance.durationText;
      } catch (e) {
        logger.error(e, LoadConstants.GOOGLE_DISTANCE);
      }
    }

    //update fields
    LoadConstants.UPDATE_FILEDS.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === "amount") {
          load[field] = formatINR(req.body[field]);
        } else {
          load[field] = req.body[field];
        }
      }
    });

    const newLoad = await load.save();

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadConstants.UPDATE_SUCCESS,
      data: ResponseModify(newLoad)
    });

  } catch (err) {
    logger.error(err, LoadConstants.UPDATELOAD_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}

const deleteLoad = async (req, res) => {
  try {
    const { id } = req.params;

    const load = await PublishLoad.findOneAndDelete({
      _id: id,
      userId: req.id,
      status: { $in: LoadConstants.ALLOWED_DELETE_STATUS }
    });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        error: LoadConstants.LOAD_NOT_FOUND
      });
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadConstants.DELETE_SUCCESS
    });

  } catch (err) {
    logger.error(err, LoadConstants.DELETELOAD_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}

const cancelLoad = async (req, res) => {
  try {
    const { id } = req.params;

    // Cancel load
    const load = await PublishLoad.findOneAndUpdate(
      {
        _id: id,
        userId: req.id,
        status: LoadConstants.LOAD_STATUS_ACTIVE
      },
      { $set: { status: LoadConstants.LOAD_STATUS_CANCELLED } },
      { new: true }
    );

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        message: LoadConstants.LOAD_NOT_FOUND
      });
    }

    /*
      FIND ACTIVE + PENDING BOOKINGS
    */
    const bookings = await LoadBooking.find({
      loadId: id,
      status: {
        $in: [
          LoadConstants.LOAD_STATUS_ACTIVE,
          LoadConstants.PENDING_STATUS
        ]
      }
    }).lean();

    /*
      CANCEL BOOKINGS
    */
    if (bookings.length > 0) {
      await LoadBooking.updateMany(
        { _id: { $in: bookings.map(b => b._id) } },
        {
          $set: {
            status: LoadConstants.LOAD_STATUS_CANCELLED,
            cancelledBy: BookingConstants.CANCELLED_BY_OWNER,
            cancelledAt: new Date()
          }
        }
      );
    }

    /*
      SOCKET EVENTS → TRANSPORTERS
    */
    bookings.forEach(b => {
      emitToUser(b.bookedBy, SocketConstants.BOOKING_CANCELLED, {
        bookingId: b.bookedBy,
        loadId: id,
        message: SocketConstants.BOOK_CANCEL_MSG
      });
    });

    /*
      SOCKET EVENT → OWNER
    */
    emitToUser(load.userId, SocketConstants.BOOKING_CANCELLED, {
      loadId: id,
      message: SocketConstants.BOOK_CANCEL_MSG
    });

    /*
      PUSH NOTIFICATIONS → TRANSPORTERS
    */
    Promise.all(
      bookings.map(b =>
        sendPushToUser(
          b.bookedBy,
          "Load Cancelled",
          "The load you booked was cancelled by the owner.",
          {
            loadId: id.toString(),
            type: SocketConstants.BOOKING_CANCELLED
          }
        )
      )
    ).catch(err => logger.error(err, "Push error"));

    /*
      OWNER CANCEL COUNT
    */
    await UserData.updateOne(
      { _id: load.userId },
      { $inc: { cancelled: 1 } }
    );

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: "Load cancelled successfully"
    });

  } catch (err) {
    logger.error(err, "cancelLoad");
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
};


module.exports = { searchLoad, loadDetails, myLoads, publishLoad, updateLoad, deleteLoad, cancelLoad }