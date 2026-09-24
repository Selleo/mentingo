import type { IMAGE_UPLOAD_SIZES } from "./imageUpload.constants";

export type ImageUploadSize = (typeof IMAGE_UPLOAD_SIZES)[keyof typeof IMAGE_UPLOAD_SIZES];
