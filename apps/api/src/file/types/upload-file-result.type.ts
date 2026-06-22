import type { ImageVariantMetadata } from "src/file/image-variants/image-variant.types";

export type UploadFileResult = {
  fileKey: string;
  fileUrl: string;
  contentType: string;
  imageVariants?: ImageVariantMetadata;
};
