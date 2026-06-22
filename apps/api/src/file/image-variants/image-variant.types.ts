import type {
  IMAGE_QUALITY,
  IMAGE_VARIANT_DEFINITIONS,
  IMAGE_VARIANT_WIDTHS,
  SUPPORTED_IMAGE_VARIANT_MIME_TYPES,
} from "./image-variant.constants";

export type ImageQuality = (typeof IMAGE_QUALITY)[keyof typeof IMAGE_QUALITY];

export type ImageVariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[ImageQuality];

export type ImageVariantDefinition = (typeof IMAGE_VARIANT_DEFINITIONS)[number];

export type SupportedImageVariantMimeType = (typeof SUPPORTED_IMAGE_VARIANT_MIME_TYPES)[number];

export type ImageVariantDetails = {
  key: string;
  width: ImageVariantWidth;
  height: number;
  contentType: string;
};

export type ImageVariantBufferDetails = ImageVariantDetails & {
  buffer: Buffer;
};

export type ImageVariantMetadata = {
  originalWidth: number;
  originalHeight: number;
  variants: Record<ImageQuality, ImageVariantDetails>;
};

export type ImageVariantUploadResult = {
  referenceKey: string;
  contentType: string;
  metadata: ImageVariantMetadata;
};
