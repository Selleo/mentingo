import { BadRequestException } from "@nestjs/common";
import { Jimp } from "jimp";
import { loadEsm } from "load-esm";

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
    const resolvedType = await this.getFileType(file);
    const resolvedMime = this.normalizeMime(resolvedType?.mime ?? file.mimetype);
    const fileMime = this.normalizeMime(file.mimetype);

    if (!file.originalname || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("files.toast.invalidData");
    }

    if (resolvedType?.mime && fileMime && resolvedMime !== fileMime) {
      throw new BadRequestException("files.toast.contentTypeMismatch");
    }

    if (!resolvedMime || !options.allowedTypes.includes(resolvedMime)) {
      throw new BadRequestException(
        `File type ${
          resolvedMime || "unknown"
        } is not allowed. Allowed types are: ${options.allowedTypes.join(", ")}`,
      );
    }

    const isVideo = resolvedType?.mime.startsWith("video/");
    const maxSize = isVideo && options.maxVideoSize ? options.maxVideoSize : options.maxSize;
    const size = this.validateSize(file, maxSize);

    let resolution = null;
    let aspectRatio = null;

    if (options?.maxResolution !== undefined) {
      resolution = await this.validateImageResolution(file, options.maxResolution);
    }

    if (options?.aspectRatio !== undefined) {
      aspectRatio = await this.validateImageAspectRatio(file, options.aspectRatio);
    }

    return {
      type: { mime: resolvedType?.mime, ext: resolvedType?.ext },
      size,
      resolution,
      aspectRatio,
    };
  }

  static async getFileType(file: Express.Multer.File | Buffer) {
    const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>("file-type");

    return fileTypeFromBuffer(file instanceof Buffer ? file : file.buffer);
  }

  private static normalizeMime(mime?: string) {
    if (!mime) return undefined;
    if (mime === "image/jpg") return "image/jpeg";
    return mime;
  }

  static validateSize(file: Express.Multer.File, maxSize: number) {
    if (!file.size || file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds the maximum allowed size of ${maxSize} bytes`,
      );
    }

    return file.size;
  }

  private static async validateImageResolution(
    file: Express.Multer.File,
    maxResolution: {
      width: number;
      height: number;
    },
  ) {
    const {
      bitmap: { width, height },
    } = await Jimp.read(file.buffer);

    if (width > maxResolution.width || height > maxResolution.height) {
      throw new BadRequestException(
        `Image size exceeds the maximum allowed resolution of ${maxResolution.width}x${maxResolution.height}`,
      );
    }

    return { width, height };
  }

  private static async validateImageAspectRatio(file: Express.Multer.File, aspectRatio: number) {
    const {
      bitmap: { width, height },
    } = await Jimp.read(file.buffer);

    if ((width / height).toFixed(2) !== aspectRatio.toFixed(2)) {
      throw new BadRequestException(
        `Image aspect ratio is different than the allowed aspect ratio of ${aspectRatio.toFixed()}/1`,
      );
    }

    return aspectRatio;
  }
}
