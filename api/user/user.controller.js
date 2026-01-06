
const { PublishLoad } = require('../../modals/loadSchema');
const { UserData } = require('../../modals/userSchema');
const { StatusCodes, CommonMessages } = require('../../constants/constants');




const getProfile = async (req, res) => {
    try {
        const profile = await UserData.findById(req.id).lean();
        return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: CommonMessages.USER_DETAILS, data: profile });
    } catch (error) {
        console.error(CommonMessages.PROFILE_API, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.SERVER_ERROR });
    }
}


const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (email) updateData.email = email;

        if (req.file) {
            updateData.profileImage = req.file.path; // ✅ Cloudinary URL
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
}

module.exports = { getProfile, updateProfile }