import { lookup } from "mime-types";

import { detectFileType } from "../file/validation/detectFileType";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const resolveScormContentType = async (buffer: Buffer, filename: string) => {
  const detectedType = await detectFileType(buffer);
  const mimeTypeFromFilename = lookup(filename);

  return detectedType?.mime ?? (mimeTypeFromFilename || DEFAULT_CONTENT_TYPE);
};

export const resolveScormContentTypeFromFilename = (
  filename: string,
  fallback = DEFAULT_CONTENT_TYPE,
) => lookup(filename) || fallback;
