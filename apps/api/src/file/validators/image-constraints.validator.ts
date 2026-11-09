import { FileValidator } from "@nestjs/common";

import { FileGuard } from "src/file/guards/file.guard";

import type { FileValidationOptions } from "src/file/guards/file.guard";

export type ImageConstraintsValidatorOptions = Pick<
  FileValidationOptions,
  "maxResolution" | "aspectRatio"
>;

export class ImageConstraintsValidator extends FileValidator<
  ImageConstraintsValidatorOptions,
  Express.Multer.File
> {
  // Throws a translated, parameterized error instead of returning false, because ParseFilePipe
  // only forwards a static message and the user needs to see which limit was exceeded.
  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file) return true;

    await FileGuard.validateImageConstraints(file, this.validationOptions);

    return true;
  }

  buildErrorMessage(): string {
    return "files.toast.invalidFileType";
  }
}
