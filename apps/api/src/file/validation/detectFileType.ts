import { loadEsm } from "load-esm";

export const detectFileType = async (buffer: Buffer) => {
  // Resolve the API dependency through an explicit export supported by Node and Jest.
  const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>(
    require.resolve("file-type/node"),
  );

  return fileTypeFromBuffer(buffer);
};
