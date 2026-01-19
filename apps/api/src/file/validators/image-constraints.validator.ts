import { FileValidator } from "@nestjs/common";
import { Jimp } from "jimp";

import type { IFile } from "@nestjs/common/pipes/file/interfaces";

export type ImageConstraintsValidatorOptions = {
  maxResolution?: {
    width: number;
    height: number;
  };
  aspectRatio?: number;
};

export class ImageConstraintsValidator extends FileValidator<ImageConstraintsValidatorOptions> {
  private errorMessage = "common.toast.somethingWentWrong";

  async isValid<TFile extends IFile = any>(file?: TFile): Promise<boolean> {
    if (!file) return true;

    const { maxResolution, aspectRatio } = this.validationOptions;

    if (!maxResolution && aspectRatio === undefined) {
      return true;
    }

    const {
      bitmap: { width, height },
    } = await Jimp.read((file as unknown as Express.Multer.File).buffer);

    if (maxResolution) {
      if (width > maxResolution.width || height > maxResolution.height) {
        return false;
      }
    }

    if (aspectRatio !== undefined) {
      if ((width / height).toFixed(2) !== aspectRatio.toFixed(2)) {
        return false;
      }
    }

    return true;
  }

  buildErrorMessage(): string {
    return this.errorMessage;
  }
}
