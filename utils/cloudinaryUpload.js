const cloudinary = require("../config/cloudinary");

const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ width: 1400, height: 1400, crop: "limit" }],
      },
      (err, result) => {
        if (err) return reject(err);

        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    stream.end(buffer);
  });
};

module.exports = { uploadBufferToCloudinary };
