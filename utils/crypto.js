const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const SECRET = process.env.CRYPTO_SECRET_KEY;
const IV_LENGTH = 16;

// encrypt sensitive values before saving to DB
const encrypt = (text) => {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
};

// decrypt when admin wants to view
const decrypt = (text) => {
  if (!text) return null;

  const parts = text.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = parts.join(":");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(SECRET),
    iv
  );

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

// used for duplicate detection
const hash = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");

module.exports = {
  encrypt,
  decrypt,
  hash,
};
