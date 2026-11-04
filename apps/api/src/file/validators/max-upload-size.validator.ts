import { FileValidator } from "@nestjs/common";

import { fileTooLargeException } from "src/file/utils/uploadErrors";

export type MaxUploadSizeValidatorOptions = { maxSize: number };

export class MaxUploadSizeValidator extends FileValidator<
  MaxUploadSizeValidatorOptions,
  Express.Multer.File
> {
  // Throws instead of returning false so the error carries the formatted limit as a param;
  // ParseFilePipe would otherwise report Nest's raw byte-count message.
  isValid(file?: Express.Multer.File): boolean {
    if (file && file.size > this.validationOptions.maxSize) {
      throw fileTooLargeException(this.validationOptions.maxSize);
    }

    return true;
  }

  buildErrorMessage(): string {
    return "files.toast.fileTooLarge";
  }
}
