import { FileValidator } from "@nestjs/common";

import { UPLOAD_ERROR_KEYS } from "src/file/utils/uploadErrors";
import { normalizeUploadedFile } from "src/file/validation/normalizeUploadedFile";

export type MagicFileTypeValidatorOptions = {
  fileType: string | RegExp;
};

export class MagicFileTypeValidator extends FileValidator<
  MagicFileTypeValidatorOptions,
  Express.Multer.File
> {
  private errorMessage = UPLOAD_ERROR_KEYS.INVALID_TYPE;

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file) return true;

    try {
      const { sourceMime } = await normalizeUploadedFile(file);
      const { fileType } = this.validationOptions;

      return typeof fileType === "string" ? sourceMime === fileType : fileType.test(sourceMime);
    } catch {
      return false;
    }
  }

  buildErrorMessage(): string {
    return this.errorMessage;
  }
}
