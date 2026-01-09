import crypto from "crypto";

const getChecksum = (file: Express.Multer.File) =>
  crypto.createHash("sha256").update(file.buffer).update(file.originalname).digest("hex");

export default getChecksum;
