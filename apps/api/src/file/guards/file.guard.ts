import { BadRequestException } from "@nestjs/common";
import { Jimp } from "jimp";

import { EXTENSION_TO_MIME_TYPE_MAP } from "../file.constants";

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
    const type = this.validateType(file, options.allowedTypes);
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

  private static validateType(file: Express.Multer.File, allowedTypes: readonly string[]) {
    let type: string | undefined = file.mimetype;

    // For video files, also check extension if MIME type is generic
    if (type === "application/octet-stream" || !type) {
      const extension = file.originalname.split(".").pop()?.toLowerCase();
      if (extension) {
        type = EXTENSION_TO_MIME_TYPE_MAP[extension];
      }
    }

    if (!type || !allowedTypes.includes(type)) {
      throw new BadRequestException(
        `File type ${type || "unknown"} is not allowed. Allowed types are: ${allowedTypes.join(
          ", ",
        )}`,
      );
    }

    return type;
  }

  private static validateSize(file: Express.Multer.File, maxSize: number) {
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
