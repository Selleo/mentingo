import { ParseFilePipeBuilder } from "@nestjs/common";

import { MAX_FILE_SIZE } from "src/file/file.constants";
import { MagicFileTypeValidator } from "src/file/validators/magic-file-type.validator";

export function getBaseFileTypePipe(
  fileType: string | RegExp,
  maxSize: number = MAX_FILE_SIZE,
  fallbackToMimetype: boolean = false,
) {
  return new ParseFilePipeBuilder()
    .addValidator(
      new MagicFileTypeValidator({
        fileType,
        fallbackToMimetype,
      }),
    )
    .addMaxSizeValidator({ maxSize });
}
