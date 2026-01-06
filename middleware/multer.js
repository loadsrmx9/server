const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "profile-images",
    allowed_formats: ["jpg", "png", "jpeg"],
    transformation: [
      { width: 400, height: 400, crop: "fill" } // auto optimize
    ]
  }
});

const upload = multer({ storage });

module.exports = upload;
