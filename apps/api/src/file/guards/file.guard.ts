import { BadRequestException } from "@nestjs/common";
import { Jimp } from "jimp";
import { loadEsm } from "load-esm";

export type FileValidationOptions = {
  allowedTypes: readonly string[];
  maxSize: number;
  maxResolution?: {
    width: number;
    height: number;
  };
  aspectRatio?: number;
};

export class FileGuard {
  static async validateFile(file: Express.Multer.File, options: FileValidationOptions) {
    const type = await this.validateType(file, options.allowedTypes);

    const size = this.validateSize(file, options.maxSize);
    let resolution = null;
    let aspectRatio = null;

    if (options?.maxResolution !== undefined) {
      resolution = await this.validateImageResolution(file, options.maxResolution);
    }

    if (options?.aspectRatio !== undefined) {
      aspectRatio = await this.validateImageAspectRatio(file, options.aspectRatio);
    }

    return { type, size, resolution, aspectRatio };
  }

  static async getFileType(file: Express.Multer.File) {
    const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>("file-type");

    return fileTypeFromBuffer(file.buffer);
  }

  static async validateType(file: Express.Multer.File, allowedTypes: readonly string[]) {
    const type = await this.getFileType(file);

    if (!type?.mime || !allowedTypes.includes(type?.mime)) {
      throw new BadRequestException(
        `File type ${
          type?.mime || "unknown"
        } is not allowed. Allowed types are: ${allowedTypes.join(", ")}`,
      );
    }

    return { mime: type?.mime, ext: type?.ext };
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
