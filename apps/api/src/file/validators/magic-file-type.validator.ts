import { FileValidator } from "@nestjs/common";

import { FileGuard } from "src/file/guards/file.guard";

import type { IFile } from "@nestjs/common/pipes/file/interfaces";

export type MagicFileTypeValidatorOptions = {
  fileType: string | RegExp;
  fallbackToMimetype?: boolean;
};

export class MagicFileTypeValidator extends FileValidator<MagicFileTypeValidatorOptions> {
  private errorMessage = "files.toast.invalidFileType";

  async isValid<TFile extends IFile = any>(file?: TFile): Promise<boolean> {
    if (!file) return true;

    const { fileType, fallbackToMimetype = true } = this.validationOptions;
    const resolvedType = await FileGuard.getFileType(file as unknown as Express.Multer.File);
    const detectedMime = resolvedType?.mime ?? (fallbackToMimetype ? file.mimetype : undefined);
    const resolvedMime = detectedMime?.split(";")[0].trim();

    if (!resolvedMime) return false;

    if (typeof fileType === "string") {
      return resolvedMime === fileType;
    }

    return fileType.test(resolvedMime);
  }

  buildErrorMessage(): string {
    return this.errorMessage;
  }
}
