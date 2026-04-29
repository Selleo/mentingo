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
    let resolvedType: Awaited<ReturnType<typeof FileGuard.getFileType>> | undefined;
    try {
      resolvedType = await FileGuard.getFileType(file as unknown as Express.Multer.File);
    } catch {
      resolvedType = undefined;
    }
    const resolvedMime = resolvedType?.mime ?? (fallbackToMimetype ? file.mimetype : undefined);

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
