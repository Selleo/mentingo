import { HttpStatus, Injectable } from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";

import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";

import type { PipeTransform } from "@nestjs/common";

export const SCORM_PACKAGE_FIELD = "scormPackage";
export const SCORM_THUMBNAIL_FIELD = "thumbnail";

const MAX_SCORM_PACKAGE_SIZE = 500 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 20 * 1024 * 1024;
const ALLOWED_SCORM_PACKAGE_MIME_TYPES = ["application/zip", "application/x-zip-compressed"];

export type CreateScormCourseFiles = {
  [SCORM_PACKAGE_FIELD]?: Express.Multer.File[];
  [SCORM_THUMBNAIL_FIELD]?: Express.Multer.File[];
};

@Injectable()
export class ValidateScormCourseFilesPipe implements PipeTransform {
  private readonly scormPackagePipe = getBaseFileTypePipe(
    buildFileTypeRegex(ALLOWED_SCORM_PACKAGE_MIME_TYPES),
    MAX_SCORM_PACKAGE_SIZE,
    true,
  ).build({
    fileIsRequired: true,
    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  });

  private readonly thumbnailPipe = getBaseFileTypePipe(
    buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES),
    MAX_THUMBNAIL_SIZE,
  ).build({
    fileIsRequired: false,
    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  });

  async transform(files: CreateScormCourseFiles = {}) {
    await this.scormPackagePipe.transform(files[SCORM_PACKAGE_FIELD]?.[0]);
    await this.thumbnailPipe.transform(files[SCORM_THUMBNAIL_FIELD]?.[0]);

    return files;
  }
}
