import { HttpStatus, Injectable, type PipeTransform } from "@nestjs/common";
import {
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from "@repo/shared";

import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";

export type LearningPathUploadFiles = {
  thumbnail?: Express.Multer.File[];
  certificateSignature?: Express.Multer.File[];
};

@Injectable()
export class ValidateLearningPathFilesPipe implements PipeTransform {
  private readonly image = getBaseFileTypePipe(
    buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES),
    MAX_IMAGE_FILE_SIZE_BYTES,
  ).build({ fileIsRequired: false, errorHttpStatusCode: HttpStatus.BAD_REQUEST });
  private readonly signature = getBaseFileTypePipe(
    buildFileTypeRegex(ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES),
    MAX_IMAGE_FILE_SIZE_BYTES,
  ).build({ fileIsRequired: false, errorHttpStatusCode: HttpStatus.BAD_REQUEST });

  async transform(files: LearningPathUploadFiles = {}) {
    await this.image.transform(files.thumbnail?.[0]);
    await this.signature.transform(files.certificateSignature?.[0]);
    return files;
  }
}
