import { HttpStatus } from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, MAX_FILE_SIZE_BYTES } from "@repo/shared";

import { ALLOWED_MIME_TYPES } from "src/file/file.constants";
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
  MAX_FILE_SIZE_BYTES,
).build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST });
