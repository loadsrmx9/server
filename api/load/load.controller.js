const { PublishLoad } = require('../../modals/loadSchema');
const { LoadBooking } = require('../../modals/bookingSchema');
const { UserData } = require('../../modals/userSchema');
const { ValidateLoadInput, ResponseModify, mapLoadListItem, mapSearchLoadItem, formatINR } = require('../../utils/utils');
const { RequiredFields, StatusCodes, CommonMessages, LoadMessages } = require('../../constants/constants');
const { calculateRoute ,calculateCurrentFromLocation} = require('../../utils/distance');
const { translateMulti } = require('../../utils/multiLingual');


const searchLoad = async (req, res) => {
  try {
    const {
      scheduleDate,
      fromLng,
      fromLat,
      toLat,
      toLng,
      driverLat,
      driverLng,
      page = 1
    } = req.body;

    const { errors } = await ValidateLoadInput(req.body, RequiredFields.SEARCH_LOAD);

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        errors,
      });
    }

    const limit = 20;
    const pageNo = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNo - 1) * limit;

    // day start/end filter
    const selectedDate = new Date(scheduleDate);
    const start = new Date(new Date(selectedDate).setHours(0, 0, 0, 0));
    const end = new Date(new Date(selectedDate).setHours(23, 59, 59, 999));

    // get nearby loads
    const loads = await PublishLoad.aggregate([
      // from location nearby
      {
        $geoNear: {
          near: { type: "Point", coordinates: [fromLng, fromLat] },
          key: "from.location",
          distanceField: "airDistance",
          maxDistance: CommonMessages.FROM_RADIUS,
          spherical: true,
        },
      },

      // only active + scheduled date
      {
        $match: {
          scheduleDate: { $gte: start, $lte: end },
          status: "active",
        },
      },

      // to location nearby
      {
        $match: {
          "to.location": {
            $geoWithin: {
              $centerSphere: [
                [toLng, toLat],
                CommonMessages.TO_RADIUS / CommonMessages.EARTH_RADIUS,
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
        message: LoadMessages.LOADS_FETCH,
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
    } catch (e) {
      console.log("GOOGLE_MATRIX_ERROR", e);
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
      message: LoadMessages.LOADS_FETCH,
      data,
      meta: {
        page: pageNo,
        limit,
        hasNextPage,
        nextPage: hasNextPage ? pageNo + 1 : null,
      },
    });
  } catch (error) {
    console.error(CommonMessages.SEARCH_LOAD_API, error);
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
    const limit = 20; //fixed for infinite scroll
    const skip = (page - 1) * limit;

    let data = [];
    let totalDocs = 0;

    // ================= POSTED =================
    if (type === "posted") {
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

      const approvedFlowStatuses = [
        "approved",
        "scheduled",
        "picked_up",
        "in_transit",
        "delivered",
        "completed",
      ];

      const bookingStatusMap = {};

      bookings.forEach((b) => {
        const loadId = String(b.loadId);

        if (approvedFlowStatuses.includes(b.status)) {
          bookingStatusMap[loadId] = b.status;
          return;
        }

        if (b.status === "pending" && !bookingStatusMap[loadId]) {
          bookingStatusMap[loadId] = "pending";
        }
      });

      data = loads.map((load) => ({
        ...mapLoadListItem(load),
        bookingStatus: bookingStatusMap[String(load._id)] || null,
      }));
    }

    // ================= REQUESTED =================
    else if (type === "requested") {
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
      return res.status(400).json({
        status: false,
        message: "Invalid type",
      });
    }

    const totalPages = Math.ceil(totalDocs / limit);

    return res.status(200).json({
      status: true,
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
  } catch (error) {
    console.error("MYLOAD_API", error);
    return res.status(500).json({
      status: false,
      error: "Server error",
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
        .json({ message: LoadMessages.NOT_FOUND });
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

    const ownerUser = await UserData.findById(loadDetails.userId)
      .select("name phone userImage")
      .lean();
    // OWNER should always see own contact
    if (String(loadDetails.userId) === req.id && ownerUser) {
      contactDetails = {
        role: "Load Owner",
        name: ownerUser.name,
        phone: ownerUser.phone,
        userImage: ownerUser.userImage,
      };
    }

    // Get APPROVED booking only
    const approvedBooking = await LoadBooking.findOne({
      loadId: id,
      status: "approved"
    })
      .populate("bookedBy", "name userImage phone")
      .populate("ownerId", "name userImage phone")
      .lean();

    // Contact visibility logic

    if (approvedBooking) {
      // OWNER sees approved user
      if (String(loadDetails.userId) === req.id) {
        contactDetails = {
          role: "Approved User",
          name: approvedBooking.bookedBy.name,
          phone: approvedBooking.bookedBy.phone,
          userImage: approvedBooking.bookedBy.userImage
        };
      }

      // APPROVED USER sees owner
      else if (String(approvedBooking.bookedBy._id) === req.id) {
        contactDetails = {
          role: "Load Owner",
          name: approvedBooking.ownerId.name,
          phone: approvedBooking.ownerId.phone,
          userImage: approvedBooking.ownerId.userImage
        };
      }
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadMessages.LOAD_DETAILS,
      data: {
        ...ResponseModify(loadDetails),
        viewCount,
        contactDetails // only after approval
      }
    });

  } catch (error) {
    console.error(CommonMessages.LOAD_DETAILS_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}


const publishLoad = async (req, res) => {
  try {

    const { fromLat, fromLng, toLat, toLng } = req.body;

    const distance = await calculateRoute(
      fromLat,
      fromLng,
      toLat,
      toLng
    );
    const { errors, scheduleUTC } =
      await ValidateLoadInput(req.body, RequiredFields.PUBLISH_LOAD);

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        errors
      });
    }

    // const [
    //   fromAddressI18n,
    //   toAddressI18n,
    //   loadTypeI18n,
    //   truckTypeI18n,
    //   distanceText1,
    //   durationText1
    // ] = await Promise.all([
    //   translateMulti(req.body.fromAddress),
    //   translateMulti(req.body.toAddress),
    //   translateMulti(req.body.loadType),
    //   translateMulti(req.body.truckType),
    //   translateMulti(distance.distanceText),
    //   translateMulti(distance.durationText),
    // ]);

    const newLoad = await PublishLoad.create({
      userId: req.id,
      //location details
      from: {
        city:req.body.fromCity,
        address: req.body.fromAddress,
        location: {
          type: "Point",
          coordinates: [req.body.fromLng, req.body.fromLat]
        }
      },

      to: {
        city:req.body.toCity,
        address: req.body.toAddress,
        location: {
          type: "Point",
          coordinates: [req.body.toLng, req.body.toLat]
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
      createdAt: Date.now(),
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
      message: LoadMessages.CREATED,
      data: ResponseModify(newLoad)
    });

  } catch (error) {
    console.error(CommonMessages.PUBLISH_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}

const updateLoad = async (req, res) => {
  try {
    const { id } = req.params;

    const load = await PublishLoad.findOne({ _id: id, userId: req.id, status: "active" });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({ status: CommonMessages.FALSE, message: LoadMessages.NOT_FOUND });
    }
    const { errors } = await ValidateLoadInput({ ...load.toObject(), ...req.body }, RequiredFields.PUBLISH_LOAD);

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ status: CommonMessages.FALSE, errors });
    }


    //Update from location
    if (req.body.fromLat && req.body.fromLng && req.body.fromAddress) {
      load.from = {
        city:req.body.fromCity,
        address: req.body.fromAddress,
        location: {
          type: "Point",
          coordinates: [req.body.fromLng, req.body.fromLat]
        }
      };
    }

    //update to location
    if (req.body.toLat && req.body.toLng && req.body.toAddress) {
      load.to = {
        city:req.body.toCity,
        address: req.body.toAddress,
        location: {
          type: "Point",
          coordinates: [req.body.toLng, req.body.toLat]
        }
      };
    }

    //update distance
    if (
      (req.body.fromLat && req.body.fromLng) ||
      (req.body.toLat && req.body.toLng)
    ) {
      const distance = await calculateRoute(
        load.from.location.coordinates[1],
        load.from.location.coordinates[0],
        load.to.location.coordinates[1],
        load.to.location.coordinates[0]
      );

      load.distanceText = distance.distanceText;
      load.durationText = distance.durationText;
    }

    //update date
    if (req.body.scheduleDateTime) {
      return res.status(403).json({ status: false, message: "Loading Date is not allowed to update" })
    }

    //update fields
    const updatableFields = [
      "amount",
      "loadType",
      "capacity",
      "truckType",
      "receiverName",
      "receiverNo"
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === "amount") {
          load[field] = formatINR(req.body[field]);
        } else {
          load[field] = req.body[field];
        }
      }
    });

    const newLoad = await load.save();

    return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.UPDATED, data: ResponseModify(newLoad) });

  } catch (error) {
    console.error(CommonMessages.UPDATE_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
  }
}

const deleteLoad = async (req, res) => {
  try {
    const { id } = req.params;

    const load = await PublishLoad.findOne({ _id: id, userId: req.id, status: { $ne: "active" } });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({ status: CommonMessages.FALSE, error: LoadMessages.NOT_FOUND });
    }

    await load.deleteOne()

    return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.DELETED });

  } catch (error) {
    console.error(CommonMessages.DELETE_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
  }
}

const cancelLoad = async (req, res) => {
  try {
    const { id } = req.params;

    const load = await PublishLoad.findOne({ _id: id, userId: req.id, status: "active" });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({ status: CommonMessages.FALSE, error: LoadMessages.NOT_FOUND });
    }

    await PublishLoad.updateOne(
      { _id: id, userId: req.id },
      { $set: { status: "cancelled" } }
    );

    await UserData.updateOne(
      { _id: load.userId },
      { $inc: { "cancelled": 1 } }
    );

    return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.CANCELLED });

  } catch (error) {
    console.error(CommonMessages.CANCEL_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
  }
}

module.exports = { searchLoad, loadDetails, myLoads, publishLoad, updateLoad, deleteLoad, cancelLoad }