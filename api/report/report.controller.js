const { PublishLoad } = require('../../modals/loadSchema');
const { Report } = require('../../modals/reportSchema');
const { UserData } = require('../../modals/userSchema');
const { CommonMessages, StatusCodes } = require('../../constants/common.constants');
const ReportConstants = require('../../constants/report.constants');
const logger = require('../../utils/logger');

const reportLoad = async (req, res) => {
  try {
    const { loadId, reason } = req.body;

    const load = await PublishLoad.findById(loadId);
    if (!load) return res.status(StatusCodes.NOT_FOUND).json({
      status: CommonMessages.FALSE,
      message:ReportConstants.LOAD_NOT_FOUND
    });

    if (load.userId.toString() === req.id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: ReportConstants.REPORT_OWN_LOAD
      });
    }

    const exists = await Report.findOne({ reportedBy: req.id, loadId });
    if (exists) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: ReportConstants.ALREADY_REPORTED
      });
    }

    await Report.create({
      reportedBy: req.id,
      reportType: "load",
      loadId,
      reason
    });

    await PublishLoad.findByIdAndUpdate(loadId, {
      $inc: { reportCount: 1 }
    });

    res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: ReportConstants.REPORT_SUCCESS
    });

  } catch(err) {
    logger.error(err,ReportConstants.REPORT_LOAD_LOG)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      message:CommonMessages.SERVER_ERROR
    });
  }
};



module.exports = { reportLoad }