import path from "node:path";

import { MAX_IMAGE_FILE_SIZE_BYTES } from "@repo/shared";
import sharp from "sharp";

import { detectFileType } from "./detectFileType";
import {
  MAX_UPLOAD_IMAGE_PIXELS,
  MIN_SVG_RASTER_EDGE_PX,
  SVG_DEFAULT_DENSITY,
  TEXT_UPLOAD_MIME_TYPES_BY_EXTENSION,
  UPLOAD_CONTENT_SOURCE,
  UPLOAD_IMAGE_TIMEOUT_SECONDS,
} from "./upload-validation.constants";

import type { DeclaredUpload, VerifiedUpload } from "./upload-validation.types";

const verifiedUploads = new WeakMap<Express.Multer.File, VerifiedUpload>();
const declaredUploads = new WeakMap<Express.Multer.File, DeclaredUpload>();

const DISALLOWED_TEXT_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000E-\u001F\u007F]/;

const getExtension = (filename: string) => path.extname(filename).slice(1).toLowerCase();

const detectTextEncoding = (buffer: Buffer) => {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return "utf-16le";
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return "utf-16be";
  return "utf-8";
};

const verifyTextUpload = (buffer: Buffer, extension: string): VerifiedUpload => {
  const mime = TEXT_UPLOAD_MIME_TYPES_BY_EXTENSION[extension];
  if (!mime) throw new Error("Unrecognized file content");

  const text = new TextDecoder(detectTextEncoding(buffer), { fatal: true }).decode(buffer);
  if (!text.trim() || DISALLOWED_TEXT_CONTROL_CHARACTERS.test(text)) {
    throw new Error("Expected text content");
  }

  return {
    sourceMime: mime,
    source: UPLOAD_CONTENT_SOURCE.TEXT,
    mime,
    extension,
    buffer: Buffer.from(text, "utf-8"),
  };
};

const getSvgDensity = async (buffer: Buffer) => {
  const { format, width, height } = await sharp(buffer, {
    limitInputPixels: MAX_UPLOAD_IMAGE_PIXELS,
  }).metadata();

  if (format !== "svg" || !width || !height) throw new Error("Invalid SVG");

  const longestEdge = Math.max(width, height);
  if (longestEdge >= MIN_SVG_RASTER_EDGE_PX) return SVG_DEFAULT_DENSITY;

  const maxScale = Math.sqrt(MAX_UPLOAD_IMAGE_PIXELS / (width * height));
  return SVG_DEFAULT_DENSITY * Math.min(MIN_SVG_RASTER_EDGE_PX / longestEdge, maxScale);
};

// SVG can carry scripts, so it is never stored as-is; it is rasterized to WebP instead.
const convertSvgToWebp = async (buffer: Buffer): Promise<VerifiedUpload> => {
  if (buffer.length > MAX_IMAGE_FILE_SIZE_BYTES) throw new Error("SVG is too large");

  const webp = await sharp(buffer, {
    density: await getSvgDensity(buffer),
    failOn: "warning",
    limitInputPixels: MAX_UPLOAD_IMAGE_PIXELS,
  })
    .timeout({ seconds: UPLOAD_IMAGE_TIMEOUT_SECONDS })
    .webp()
    .toBuffer();

  return {
    sourceMime: "image/svg+xml",
    source: UPLOAD_CONTENT_SOURCE.SVG,
    mime: "image/webp",
    extension: "webp",
    buffer: webp,
  };
};

const verifyUploadContent = async (file: Express.Multer.File): Promise<VerifiedUpload> => {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0 || !file.originalname) {
    throw new Error("Empty file");
  }

  const extension = getExtension(file.originalname);

  // UTF-16 BOMs can resemble binary signatures, so recognized text extensions are decoded first.
  if (
    TEXT_UPLOAD_MIME_TYPES_BY_EXTENSION[extension] &&
    detectTextEncoding(file.buffer) !== "utf-8"
  ) {
    return verifyTextUpload(file.buffer, extension);
  }

  const detected = await detectFileType(file.buffer);

  const isSvgCandidate =
    detected?.mime === "application/xml" ||
    (!detected && (extension === "svg" || file.mimetype === "image/svg+xml"));

  if (isSvgCandidate) return convertSvgToWebp(file.buffer);

  if (detected) {
    return {
      sourceMime: detected.mime,
      source: UPLOAD_CONTENT_SOURCE.BINARY,
      mime: detected.mime,
      extension: detected.ext,
      buffer: file.buffer,
    };
  }

  return verifyTextUpload(file.buffer, extension);
};

const replaceExtension = (filename: string, extension: string) => {
  const basename = path.basename(filename.replace(/\\/g, "/"), path.extname(filename));
  return `${basename}.${extension}`;
};

/** Metadata the client sent, before content verification rewrote the file. */
export const getDeclaredUpload = (file: Express.Multer.File): DeclaredUpload =>
  declaredUploads.get(file) ?? {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  };

/**
 * Verifies the upload by its bytes and rewrites it in place so storage uses the verified type:
 * the client-declared MIME type is replaced and converted content (SVG, re-encoded text) is stored.
 */
export async function normalizeUploadedFile(file: Express.Multer.File): Promise<VerifiedUpload> {
  const cached = verifiedUploads.get(file);
  if (cached && cached.buffer === file.buffer) return cached;

  const declared = getDeclaredUpload(file);
  const verified = await verifyUploadContent(file);

  declaredUploads.set(file, declared);
  verifiedUploads.set(file, verified);

  file.buffer = verified.buffer;
  file.size = verified.buffer.length;
  file.mimetype = verified.mime;
  if (verified.mime !== verified.sourceMime) {
    file.originalname = replaceExtension(file.originalname, verified.extension);
  }

  return verified;
}
