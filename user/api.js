const express = require('express');
const router = express.Router();

const { PublishLoad, UserData } = require('../mongoschema/globalSchema');
const jwtAuth = require('../middleware/jwtToken');
const upload = require('../middleware/multer')
const { ValidateLoadInput } = require('../utils/utils');
const { RequiredFields, StatusCodes, CommonMessages, LoadMessages } = require('../constants/constants');

// =====================
// GET USER PROFILE
// =====================
router.get('/profile', jwtAuth, async (req, res) => {
    try {
        const profile = await UserData.findById(req.id).lean();
        const cancelled = await PublishLoad.countDocuments({ userId: req.id, status: "cancelled" });
        const completed = await PublishLoad.countDocuments({ userId: req.id, status: "completed" });
        return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: CommonMessages.USER_DETAILS, data: { ...profile, cancelled, completed } });
    } catch (error) {
        console.error(CommonMessages.PROFILE_API, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
    }
});

// ======================
// USER PROFILE UPDATE
// ======================
router.patch('/updateProfile', jwtAuth, upload.single("profileImage"), async (req, res) => {
    try {
        const { name, email } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (email) updateData.email = email;

        if (req.file) {
            updateData.profileImage = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        const updated = await UserData.findByIdAndUpdate(
            req.id,
            { $set: updateData },
            { new: true }
        ).lean();

        res.status(StatusCodes.OK).json({ status: true, message: CommonMessages.PROFILE_UPDATED, data: updated });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, error: CommonMessages.SERVER_ERROR });
    }
});


// =======================
// POST PUBLISH LOAD
// =======================
router.post("/publishLoad", jwtAuth, async (req, res) => {
    try {

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
                address: fromAddress,
                location: {
                    type: "Point",
                    coordinates: [fromLng, fromLat]
                }
            },

            to: {
                address: toAddress,
                location: {
                    type: "Point",
                    coordinates: [toLng, toLat]
                }
            },

            amount: req.body.amount,
            loadType: req.body.loadType,
            capacity: req.body.capacity,
            truckType: req.body.truckType,
            company: req.body.company,
            phoneNo: req.body.phoneNo,
            alternativeNo: req.body.alternativeNo,

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
});


// ==================
// UPDATE LOAD
// ==================
router.put('/updateLoad/:id', jwtAuth, async (req, res) => {
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


        // Apply updates
        Object.assign(load, req.body);

        // ensure scheduleUTC applied if updated
        if (req.body.scheduleDate) {
            load.scheduleDate = scheduleUTC;
        }


        await load.save();

        return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.UPDATED, data: load });

    } catch (error) {
        console.error(CommonMessages.UPDATE_LOAD_API, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
    }
});

// ====================
// GET USER'S LOADS
// ====================
router.get('/loads', jwtAuth, async (req, res) => {
    try {
        const loads = await PublishLoad.find({ userId: req.id })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.USER_LOAD_DETAILS, data: loads });
    } catch (error) {
        console.error(CommonMessages.USER_LOAD_API, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
    }
});

// =====================
// CANCEL THE LOAD
// =====================
router.delete('/cancelLoad/:id', jwtAuth, async (req, res) => {
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
});

// ==================================
// DELETE THE LOADS ONLY CANCELLED
// ==================================
router.delete('/deleteLoad/:id', jwtAuth, async (req, res) => {
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
});

module.exports = router;
