import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

import {
  UPLOAD_ERROR_KEYS,
  fileTooLargeException,
  imageAspectRatioMismatchException,
  imageResolutionTooLargeException,
} from "../utils/uploadErrors";
import { detectFileType } from "../validation/detectFileType";
import { getDeclaredUpload, normalizeUploadedFile } from "../validation/normalizeUploadedFile";
import { UPLOAD_CONTENT_SOURCE } from "../validation/upload-validation.constants";

export type FileValidationOptions = {
  allowedTypes: readonly string[];
  maxSize: number;
  maxVideoSize?: number;
  maxResolution?: {
    width: number;
    height: number;
  };
  aspectRatio?: number;
};

export class FileGuard {
  static async validateFile(file: Express.Multer.File, options: FileValidationOptions) {
    if (!file.originalname || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("files.toast.invalidData");
    }

    this.validateSize(file, Math.max(options.maxSize, options.maxVideoSize ?? 0));

    const verified = await normalizeUploadedFile(file).catch(() => {
      throw new BadRequestException(UPLOAD_ERROR_KEYS.INVALID_TYPE);
    });

    const declaredMime = this.normalizeMime(getDeclaredUpload(file).mimetype);

    if (
      verified.source === UPLOAD_CONTENT_SOURCE.BINARY &&
      declaredMime &&
      declaredMime !== verified.sourceMime
    ) {
      throw new BadRequestException("files.toast.contentTypeMismatch");
    }

    if (!options.allowedTypes.includes(verified.sourceMime)) {
      throw new BadRequestException(UPLOAD_ERROR_KEYS.INVALID_TYPE);
    }

    const isVideo = verified.sourceMime.startsWith("video/");
    const maxSize = isVideo && options.maxVideoSize ? options.maxVideoSize : options.maxSize;
    const size = this.validateSize(file, maxSize);
    const { resolution, aspectRatio } = await this.validateImageConstraints(file, options);

    return {
      type: { mime: verified.mime, ext: verified.extension },
      size,
      resolution,
      aspectRatio,
    };
  }

  static async getFileType(file: Express.Multer.File | Buffer) {
    return detectFileType(file instanceof Buffer ? file : file.buffer);
  }

  static validateSize(file: Express.Multer.File, maxSize: number) {
    if (!file.size) throw new BadRequestException(UPLOAD_ERROR_KEYS.EMPTY);
    if (file.size > maxSize) throw fileTooLargeException(maxSize);

    return file.size;
  }

  static async validateImageConstraints(
    file: Express.Multer.File,
    { maxResolution, aspectRatio }: Pick<FileValidationOptions, "maxResolution" | "aspectRatio">,
  ) {
    if (!maxResolution && aspectRatio === undefined) {
      return { resolution: null, aspectRatio: null };
    }

    const { width, height } = await this.getImageDimensions(file);

    if (maxResolution && (width > maxResolution.width || height > maxResolution.height)) {
      throw imageResolutionTooLargeException(maxResolution);
    }

    if (aspectRatio !== undefined && (width / height).toFixed(2) !== aspectRatio.toFixed(2)) {
      throw imageAspectRatioMismatchException(aspectRatio);
    }

    return {
      resolution: maxResolution ? { width, height } : null,
      aspectRatio: aspectRatio ?? null,
    };
  }

  private static normalizeMime(mime?: string) {
    if (!mime) return undefined;
    if (mime === "image/jpg") return "image/jpeg";
    return mime;
  }

  private static async getImageDimensions(file: Express.Multer.File) {
    const { width, height } = await sharp(file.buffer)
      .metadata()
      .catch(() => ({ width: undefined, height: undefined }));

    if (!width || !height) throw new BadRequestException(UPLOAD_ERROR_KEYS.INVALID_TYPE);

    return { width, height };
  }
}
