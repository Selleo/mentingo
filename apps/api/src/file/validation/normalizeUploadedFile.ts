import { BadRequestException } from "@nestjs/common";
import { loadEsm } from "load-esm";
import sharp from "sharp";

const BINARY_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
  "application/zip",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
]);
const TEXT_MIMES: Record<string, string> = {
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  xmd: "text/markdown",
};
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
};
const verified = new WeakMap<Express.Multer.File, NormalizedFile & { extension: string }>();
export type NormalizedFile = {
  sourceMime: string;
  buffer: Buffer;
  mime: string;
  extension: string;
};
const invalid = () => new BadRequestException("files.toast.invalidFileType");

function decodeText(buffer: Buffer, extension: string): Buffer {
  const little = buffer[0] === 0xff && buffer[1] === 0xfe;
  const big = buffer[0] === 0xfe && buffer[1] === 0xff;
  let text: string;
  try {
    text = new TextDecoder(little ? "utf-16le" : big ? "utf-16be" : "utf-8", {
      fatal: true,
    }).decode(buffer);
  } catch {
    if (extension !== "csv" || little || big) throw invalid();
    text = new TextDecoder("windows-1250", { fatal: true }).decode(buffer);
  }
  if (!text.trim() || /[\x00-\x08\x0b\x0e-\x1f\x7f]/.test(text)) throw invalid();
  return Buffer.from(text, "utf-8");
}

async function rasterizeSvg(buffer: Buffer): Promise<Buffer> {
  if (buffer.length > 20 * 1024 * 1024) throw invalid();
  const options = { failOn: "warning" as const, unlimited: false, limitInputPixels: 16_777_216 };
  try {
    const metadata = await sharp(buffer, { ...options, density: 72 })
      .timeout({ seconds: 5 })
      .metadata();
    if (metadata.format !== "svg" || !metadata.width) throw invalid();
    const density = Math.min(2400, Math.max(72, Math.ceil((72 * 1920) / metadata.width)));
    return await sharp(buffer, { ...options, density })
      .timeout({ seconds: 5 })
      .webp()
      .toBuffer();
  } catch {
    throw invalid();
  }
}

export async function normalizeUploadedFile(file: Express.Multer.File): Promise<NormalizedFile> {
  if (!file?.originalname || !Buffer.isBuffer(file.buffer) || !file.buffer.length) throw invalid();
  const basename = file.originalname.replace(/\\/g, "/").split("/").pop() ?? "";
  const extension = basename.split(".").pop()?.toLowerCase() ?? "";
  const cached = verified.get(file);
  if (
    cached &&
    cached.buffer === file.buffer &&
    cached.mime === file.mimetype &&
    cached.extension === extension
  )
    return cached;

  const bom =
    (file.buffer[0] === 0xff && file.buffer[1] === 0xfe) ||
    (file.buffer[0] === 0xfe && file.buffer[1] === 0xff);
  const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>("file-type");
  const detected = !bom && (await fileTypeFromBuffer(file.buffer));
  let sourceMime: string;
  let buffer = file.buffer;
  let mime: string;
  let finalExtension: string;
  if (detected) {
    if (!BINARY_MIMES.has(detected.mime)) throw invalid();
    sourceMime = mime = detected.mime;
    finalExtension = EXTENSIONS[mime] ?? detected.ext;
  } else if (
    extension === "svg" &&
    /^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(buffer.toString("utf8", 0, 512))
  ) {
    sourceMime = "image/svg+xml";
    buffer = await rasterizeSvg(buffer);
    mime = "image/webp";
    finalExtension = "webp";
  } else if (TEXT_MIMES[extension]) {
    sourceMime = mime = TEXT_MIMES[extension];
    buffer = decodeText(buffer, extension);
    finalExtension = extension;
  } else {
    throw invalid();
  }
  const normalized = { sourceMime, buffer, mime, extension: finalExtension };
  file.buffer = buffer;
  file.size = buffer.length;
  file.mimetype = mime;
  file.originalname = `${basename.replace(/\.[^.]+$/, "")}.${finalExtension}`;
  verified.set(file, normalized);
  return normalized;
}
