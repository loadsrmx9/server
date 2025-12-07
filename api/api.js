const express = require('express');
const router = express.Router();
const { PublishLoad, UserData } = require('../mongoschema/globalSchema');
const jwtAuth = require('../middleware/jwtToken');
const { ValidateLoadInput } = require('../utils/utils');
const { RequiredFields, StatusCodes, CommonMessages, LoadMessages } = require('../constants/constants');

// =========================
// SEARCH LOADS
// =========================
router.post('/searchLoad', jwtAuth, async (req, res) => {
    try {
        const { from, to, scheduleDate } = req.body
        const { errors } = await ValidateLoadInput(req.body, RequiredFields.SEARCH_LOAD);

        if (Object.keys(errors).length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: CommonMessages.FALSE, errors });
        }

        const lowerFrom = from.map(v => v.toLowerCase());
        const lowerTo = to.map(v => v.toLowerCase());

        // Convert scheduleDate to Date range (full day)
        const selectedDate = new Date(scheduleDate);
        const start = new Date(selectedDate.setHours(0, 0, 0, 0));
        const end = new Date(selectedDate.setHours(23, 59, 59, 999));

        const results = await PublishLoad.aggregate([
            {
                $match: {
                    from: { $in: lowerFrom },
                    to: { $in: lowerTo },
                    scheduleDate: { $gte: start, $lte: end },
                    status: "active"
                }
            },
            {
                $addFields: {
                    fromOrder: { $indexOfArray: [lowerFrom, "$from"] },
                    toOrder: { $indexOfArray: [lowerTo, "$to"] }
                }
            },
            {
                $sort: {
                    fromOrder: 1,
                    toOrder: 1
                }
            },
            {
                $project: {
                    fromOrder: 0,
                    toOrder: 0
                }
            }
        ]);

        return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.LOADS_FETCH, data: results });

    } catch (error) {
        console.error(CommonMessages.SEARCH_LOAD_API, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
    }
});


// =========================
// GET A SPECIFIC LOAD DETAILS
// =========================
router.get('/loadDetails/:id', jwtAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const loadDetails = await PublishLoad.findById(id);
        if (!loadDetails) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: LoadMessages.NOT_FOUND });
        }
        if (!loadDetails.viewedBy.includes(req.id)) {
            loadDetails.viewedBy.push(req.id);
            await loadDetails.save();
        }

        const viewCount = loadDetails.viewedBy.length;

        return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: LoadMessages.LOAD_DETAILS, data:{loadDetails,viewCount }});
    } catch (error) {
        console.error(CommonMessages.LOAD_DETAILS_API, error)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
    }
});


module.exports = router;