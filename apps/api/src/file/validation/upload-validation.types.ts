import type { UPLOAD_CONTENT_SOURCE } from "./upload-validation.constants";

export type UploadContentSource =
  (typeof UPLOAD_CONTENT_SOURCE)[keyof typeof UPLOAD_CONTENT_SOURCE];

export type VerifiedUpload = {
  sourceMime: string;
  source: UploadContentSource;
  mime: string;
  extension: string;
  buffer: Buffer;
};

export type DeclaredUpload = Pick<Express.Multer.File, "originalname" | "mimetype" | "size">;
