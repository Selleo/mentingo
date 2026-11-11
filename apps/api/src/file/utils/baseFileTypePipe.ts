import { ParseFilePipeBuilder } from "@nestjs/common";
import { MAX_FILE_SIZE_BYTES } from "@repo/shared";

import { MagicFileTypeValidator } from "src/file/validators/magic-file-type.validator";
import { MaxUploadSizeValidator } from "src/file/validators/max-upload-size.validator";

export function getBaseFileTypePipe(
  fileType: string | RegExp,
  maxSize: number = MAX_FILE_SIZE_BYTES,
) {
  return new ParseFilePipeBuilder()
    .addValidator(new MaxUploadSizeValidator({ maxSize }))
    .addValidator(new MagicFileTypeValidator({ fileType }));
}
