import { Catch, PayloadTooLargeException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

import { UPLOAD_ERROR_KEYS } from "src/file/utils/uploadErrors";

import type { ArgumentsHost } from "@nestjs/common";

export const MULTER_FILE_TOO_LARGE_MESSAGE = "File too large";

@Catch(PayloadTooLargeException)
export class UploadTooLargeFilter extends BaseExceptionFilter {
  catch(exception: PayloadTooLargeException, host: ArgumentsHost) {
    if (exception.message !== MULTER_FILE_TOO_LARGE_MESSAGE) {
      return super.catch(exception, host);
    }

    return super.catch(new PayloadTooLargeException(UPLOAD_ERROR_KEYS.UPLOAD_TOO_LARGE), host);
  }
}
