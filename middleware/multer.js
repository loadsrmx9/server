const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(), // ✅ no local, no cloudinary here
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed"), false);
    }
    cb(null, true);
  },
});

module.exports = upload;
