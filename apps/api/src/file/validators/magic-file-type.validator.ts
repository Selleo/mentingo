import { FileValidator } from "@nestjs/common";

import { normalizeUploadedFile } from "src/file/validation/normalizeUploadedFile";

import type { IFile } from "@nestjs/common/pipes/file/interfaces";

export type MagicFileTypeValidatorOptions = {
  fileType: string | RegExp;
  maxSize: number;
  fallbackToMimetype?: boolean;
};

export class MagicFileTypeValidator extends FileValidator<MagicFileTypeValidatorOptions> {
  async isValid<TFile extends IFile = any>(file?: TFile): Promise<boolean> {
    if (!file) return true;
    const { fileType, maxSize } = this.validationOptions;
    const upload = file as unknown as Express.Multer.File;
    if (!Buffer.isBuffer(upload.buffer) || !upload.buffer.length || upload.buffer.length > maxSize)
      return false;
    try {
      const { sourceMime } = await normalizeUploadedFile(upload);
      if (upload.buffer.length > maxSize) return false;
      return typeof fileType === "string"
        ? sourceMime === fileType
        : new RegExp(fileType.source, fileType.flags.replace(/[gy]/g, "")).test(sourceMime);
    } catch {
      return false;
    }
  }

  buildErrorMessage(): string {
    return "files.toast.invalidFileType";
  }
}
