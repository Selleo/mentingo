import { loadEsm } from "load-esm";
import { lookup } from "mime-types";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const resolveScormContentType = async (buffer: Buffer, filename: string) => {
  const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>("file-type");
  const detectedType = await fileTypeFromBuffer(buffer);
  const mimeTypeFromFilename = lookup(filename);

  return detectedType?.mime ?? (mimeTypeFromFilename || DEFAULT_CONTENT_TYPE);
};
