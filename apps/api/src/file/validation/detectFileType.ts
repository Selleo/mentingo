import { loadEsm } from "load-esm";

type DetectedFileType = { ext: string; mime: string };

type FileTypeModule = {
  fileTypeFromBuffer: (buffer: Uint8Array) => Promise<DetectedFileType | undefined>;
};

export const detectFileType = async (buffer: Buffer) => {
  const { fileTypeFromBuffer } = await loadEsm<FileTypeModule>(require.resolve("file-type"));

  return fileTypeFromBuffer(buffer);
};
