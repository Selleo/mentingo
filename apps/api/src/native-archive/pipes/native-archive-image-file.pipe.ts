import { HttpStatus } from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";

import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "src/file/file.constants";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";

const imageMimeTypes = [
  ...new Set([
    ...ALLOWED_MIME_TYPES.filter((mimeType) => mimeType.startsWith("image/")),
    ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ]),
];

export const nativeArchiveImageFilePipe = getBaseFileTypePipe(
  buildFileTypeRegex(imageMimeTypes),
  MAX_FILE_SIZE,
  true,
).build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST });
