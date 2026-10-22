import { loadEsm } from "load-esm";
import { lookup } from "mime-types";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const resolveScormContentType = async (buffer: Buffer, filename: string) => {
  // Resolve the API dependency through an explicit export supported by Node and Jest.
  const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>(
    require.resolve("file-type/node"),
  );
  const detectedType = await fileTypeFromBuffer(buffer);
  const mimeTypeFromFilename = lookup(filename);

  return detectedType?.mime ?? (mimeTypeFromFilename || DEFAULT_CONTENT_TYPE);
};

export const resolveScormContentTypeFromFilename = (
  filename: string,
  fallback = DEFAULT_CONTENT_TYPE,
) => lookup(filename) || fallback;
