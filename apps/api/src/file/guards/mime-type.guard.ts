import { BadRequestException } from "@nestjs/common";

import { ALLOWED_MIME_TYPES } from "../file.constants";

export class MimeTypeGuard {
  static validateMimeType(mimetype: string | undefined): asserts mimetype is string {
    if (!mimetype || !this.isAllowedMimeType(mimetype)) {
      throw new BadRequestException(
        `File type ${
          mimetype || "unknown"
        } is not allowed. Allowed types are: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }
  }

  private static isAllowedMimeType(mimetype: string): boolean {
    return ALLOWED_MIME_TYPES.includes(mimetype as (typeof ALLOWED_MIME_TYPES)[number]);
  }
}
