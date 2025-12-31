const { PublishLoad } = require('../../modals/loadSchema');
const { LoadBooking } = require('../../modals/bookingSchema');
const { UserData } = require('../../modals/userSchema');
const { ValidateLoadInput } = require('../../utils/utils');
const { RequiredFields, StatusCodes, CommonMessages, LoadMessages } = require('../../constants/constants');
const {getGoogleDistance} = require('../../utils/distance');


const searchLoad = async (req, res) => {
  try {
    const { scheduleDate, fromCoords, toCoords } = req.body;

    const { errors } = await ValidateLoadInput(
      req.body,
      RequiredFields.SEARCH_LOAD
    );

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        errors
      });
    }

    const selectedDate = new Date(scheduleDate);
    const start = new Date(selectedDate.setHours(0, 0, 0, 0));
    const end = new Date(selectedDate.setHours(23, 59, 59, 999));

    const results = await PublishLoad.aggregate([
      // 1️⃣ Geo search
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: fromCoords
          },
          key: "from.location",
          distanceField: "airDistance",
          maxDistance: CommonMessages.FROM_RADIUS,
          spherical: true
        }
      },

      // 2️⃣ Convert meters → km
      {
        $addFields: {
          airKm: { $divide: ["$airDistance", 1000] }
        }
      },

      // 3️⃣ Dynamic multiplier
      {
        $addFields: {
          distanceMultiplier: {
            $cond: [
              { $lte: ["$airKm", 10] },
              1.3,
              {
                $cond: [
                  { $lte: ["$airKm", 40] },
                  1.2,
                  1.15
                ]
              }
            ]
          }
        }
      },

      // 4️⃣ Estimated road distance
      {
        $addFields: {
          estimatedRoadKm: {
            $round: [
              { $multiply: ["$airKm", "$distanceMultiplier"] },
              1
            ]
          }
        }
      },

      // 5️⃣ Average speed
      {
        $addFields: {
          avgSpeed: {
            $cond: [
              { $lte: ["$airKm", 10] },
              25,
              {
                $cond: [
                  { $lte: ["$airKm", 40] },
                  40,
                  60
                ]
              }
            ]
          }
        }
      },

      // 6️⃣ ETA calculation
      {
        $addFields: {
          etaMinutes: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$estimatedRoadKm", "$avgSpeed"] },
                  60
                ]
              },
              0
            ]
          }
        }
      },

      // 7️⃣ Filters
      {
        $match: {
          scheduleDate: { $gte: start, $lte: end },
          status: "active"
        }
      },

      {
        $match: {
          "to.location": {
            $geoWithin: {
              $centerSphere: [
                toCoords,
                CommonMessages.TO_RADIUS / CommonMessages.EARTH_RADIUS
              ]
            }
          }
        }
      },

      // 8️⃣ Sort nearest first
      { $sort: { airDistance: 1 } },

      // 9️⃣ Clean response
      {
        $project: {
          airDistance: 0,
          airKm: 0,
          avgSpeed: 0,
          distanceMultiplier: 0
        }
      }
    ]);

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadMessages.LOADS_FETCH,
      data: results
    });

  } catch (error) {
    console.error(CommonMessages.SEARCH_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      error: CommonMessages.SERVER_ERROR
    });
  }
}

const myLoads = async (req, res) => {
  try {
    const { type } = req.query;
    let data;

    if (type === "posted") {
      data = await PublishLoad.find({
        userId: req.id,
        status: "active"
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    else if (type === "requested") {
      data = await LoadBooking.find({
        bookedBy: req.id
      })
        .populate("loadId")
        .sort({ createdAt: -1 })
        .lean();
    }

    else if (type === "archived") {
      const postedArchived = await PublishLoad.find({
        userId: req.id,
        status: { $ne: "active" }
      }).lean();

      const requestedArchived = await LoadBooking.find({
        bookedBy: req.id,
        status: { $in: ["approved", "cancelled"] }
      })
        .populate("loadId")
        .lean();

      data = {
        posted: postedArchived,
        requested: requestedArchived
      };
    }

    else {
      return res.status(400).json({
        status: false,
        message: "Invalid type"
      });
    }

    return res.status(200).json({
      status: true,
      data
    });

  } catch (error) {
    console.error("MYLOAD_API", error);
    return res.status(500).json({
      status: false,
      error: "Server error"
    });
  }
}

const loadDetails = async (req, res) => {
  try {
    const { id } = req.params;

    //  Fetch load
    const loadDetails = await PublishLoad.findById(id).lean();
    if (!loadDetails) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: LoadMessages.NOT_FOUND });
    }

    // Track views (exclude owner)
    if (
      String(loadDetails.userId) !== req.id &&
      !loadDetails.viewedBy.includes(req.id)
    ) {
      await PublishLoad.updateOne(
        { _id: id },
        { $addToSet: { viewedBy: req.id } }
      );
    }

    const viewCount = loadDetails.viewedBy.length;

    let contactDetails = null;
    // OWNER should always see own contact
    if (String(loadDetails.userId) === req.id) {
      contactDetails = {
        role: "load_owner",
        phone: loadDetails.userPhone,
      };
    }

    // Get APPROVED booking only
    const approvedBooking = await LoadBooking.findOne({
      loadId: id,
      status: "approved"
    })
      .populate("bookedBy", "name email phone")
      .populate("ownerId", "name email phone")
      .lean();

    // Contact visibility logic

    if (approvedBooking) {
      // OWNER sees approved user
      if (String(loadDetails.userId) === req.id) {
        contactDetails = {
          role: "approved_user",
          name: approvedBooking.bookedBy.name,
          email: approvedBooking.bookedBy.email,
          phone: approvedBooking.bookedBy.phone
        };
      }

      // APPROVED USER sees owner
      else if (String(approvedBooking.bookedBy._id) === req.id) {
        contactDetails = {
          role: "load_owner",
          name: approvedBooking.ownerId.name,
          email: approvedBooking.ownerId.email,
          phone: approvedBooking.ownerId.phone
        };
      }
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadMessages.LOAD_DETAILS,
      data: {
        loadDetails,
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

    const distance = await getGoogleDistance(
      fromLat,
      fromLng,
      toLat,
      toLng
    );
    const { errors, scheduleUTC, expireAt } =
      await ValidateLoadInput(req.body, RequiredFields.PUBLISH_LOAD);

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        errors
      });
    }
    const userInfo = await UserData.findById(req.id).lean();

    const newLoad = await PublishLoad.create({
      userId: req.id,
      userPhone: userInfo.phone,

      from: {
        address: req.body.fromAddress,
        location: {
          type: "Point",
          coordinates: [req.body.fromLng, req.body.fromLat]
        }
      },

      to: {
        address: req.body.toAddress,
        location: {
          type: "Point",
          coordinates: [req.body.toLng, req.body.toLat]
        }
      },

      amount: req.body.amount,
      loadType: req.body.loadType,
      capacity: req.body.capacity,
      truckType: req.body.truckType,
      company: req.body.company,
      phoneNo: req.body.phoneNo,
      alternativeNo: req.body.alternativeNo,

      distanceText: distance.distanceText,
      durationText: distance.durationText,

      scheduleDate: scheduleUTC,
      expireAt,
      createdAt: Date.now(),
    });

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: LoadMessages.CREATED,
      data: newLoad
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

    const load = await PublishLoad.findOne({ _id: id, userId: req.id });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({ status: CommonMessages.FALSE, message: LoadMessages.NOT_FOUND });
    }
    const { errors, scheduleUTC } = await ValidateLoadInput({ ...load.toObject(), ...req.body }, RequiredFields.PUBLISH_LOAD);

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ status: CommonMessages.FALSE, errors });
    }


    //Update from location
    if (req.body.fromLat && req.body.fromLng && req.body.fromAddress) {
      load.from = {
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
      const distance = await getGoogleDistance(
        load.from.location.coordinates[1],
        load.from.location.coordinates[0],
        load.to.location.coordinates[1],
        load.to.location.coordinates[0]
      );

      load.distanceText = distance.distanceText;
      load.durationText = distance.durationText;
    }

    //update date
    if (req.body.scheduleDate) {
      load.scheduleDate = scheduleUTC;
    }

    //update fields
    const updatableFields = [
      "amount",
      "loadType",
      "capacity",
      "truckType",
      "company",
      "phoneNo",
      "alternativeNo"
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        load[field] = req.body[field];
      }
    });

    await load.save();

    return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.UPDATED, data: load });

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

    const load = await PublishLoad.findOne({ _id: id, userId: req.id, status: { $ne: "cancelled" } });

    if (!load) {
      return res.status(StatusCodes.NOT_FOUND).json({ status: CommonMessages.FALSE, error: LoadMessages.NOT_FOUND });
    }

    await PublishLoad.updateOne(
      { _id: id, userId: req.id },
      { $set: { status: "cancelled" } }
    );

    return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.CANCELLED });

  } catch (error) {
    console.error(CommonMessages.CANCEL_LOAD_API, error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
  }
}

module.exports = { searchLoad, loadDetails, myLoads, publishLoad, updateLoad, deleteLoad, cancelLoad }