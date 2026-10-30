import crypto from "crypto";
import { createReadStream } from "node:fs";

const getChecksum = async (file: Express.Multer.File) => {
  const hash = crypto.createHash("sha256");
  if (file.path) {
    for await (const chunk of createReadStream(file.path)) hash.update(chunk);
  } else {
    hash.update(file.buffer);
  }
  return hash.update(file.originalname).digest("hex");
};

export default getChecksum;
