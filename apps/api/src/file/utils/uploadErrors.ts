import { BadRequestException } from "@nestjs/common";
import { formatFileSize } from "@repo/shared";

// Upload errors carry translation keys (plus params) that the web app renders for the user.
export const UPLOAD_ERROR_KEYS = {
  EMPTY: "files.toast.fileEmpty",
  INVALID_TYPE: "files.toast.invalidFileType",
  INVALID_IMAGE_REFERENCE: "files.toast.invalidImageReference",
  TOO_LARGE: "files.toast.fileTooLarge",
  UPLOAD_TOO_LARGE: "files.toast.uploadTooLarge",
  IMAGE_RESOLUTION_TOO_LARGE: "files.toast.imageResolutionTooLarge",
  IMAGE_ASPECT_RATIO_MISMATCH: "files.toast.imageAspectRatioMismatch",
} as const;

export const fileTooLargeException = (maxSizeBytes: number) =>
  new BadRequestException({
    message: UPLOAD_ERROR_KEYS.TOO_LARGE,
    translationParams: { maxSize: formatFileSize(maxSizeBytes) },
  });

export const imageResolutionTooLargeException = (maxResolution: {
  width: number;
  height: number;
}) =>
  new BadRequestException({
    message: UPLOAD_ERROR_KEYS.IMAGE_RESOLUTION_TOO_LARGE,
    translationParams: maxResolution,
  });

export const imageAspectRatioMismatchException = (aspectRatio: number) =>
  new BadRequestException({
    message: UPLOAD_ERROR_KEYS.IMAGE_ASPECT_RATIO_MISMATCH,
    translationParams: { aspectRatio: `${Number(aspectRatio.toFixed(2))}:1` },
  });
