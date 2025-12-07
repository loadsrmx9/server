const jwt = require('jsonwebtoken');
const { StatusCodes, CommonMessages} = require('../constants/constants');

const jwtAuth = (req, res, next) => {
    try {
        const authH = req.headers['authorization'];
        if (!authH) {
            return res.status(StatusCodes.UNAUTHORIZED).json({status:CommonMessages.TRUE, message: CommonMessages.JWT_AUTH_HEAD});
        }
        const tokenParts = authH.split(" ");
        if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
            return res.status(StatusCodes.UNAUTHORIZED).json({status:CommonMessages.FALSE, message: CommonMessages.JWT_INVALID_AUTH });
        }

        const jwtToken = tokenParts[1];
        jwt.verify(jwtToken, process.env.JWT_KEY, (error, payLoad) => {
            if (error) {
                return res.status(StatusCodes.UNAUTHORIZED).json({status:CommonMessages.FALSE, message:CommonMessages.JWT_VERIFY  });
            }
            req.id = payLoad.id;
            next();
        });

    } catch(err){
        console.error(CommonMessages.JWT_SERVER,err)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status:CommonMessages.FALSE,message:CommonMessages.SERVER_ERROR });
    }
};

module.exports = jwtAuth;
