import type {
  ALL_IMAGE_QUALITY_VALUES,
  IMAGE_RESIZE_MODES,
  SUPPORTED_IMAGE_VARIANT_MIME_TYPES,
} from "./image-variant.constants";

export type ImageResizeMode = (typeof IMAGE_RESIZE_MODES)[number];

export type ImageQuality = (typeof ALL_IMAGE_QUALITY_VALUES)[number];

export type ImageVariantWidth = number;

export type ImageVariantDefinition<TQuality extends ImageQuality = ImageQuality> = {
  quality: TQuality;
  width: ImageVariantWidth;
};

export type ImageVariantCreationOptions = {
  variantDefinitions?: readonly ImageVariantDefinition[];
  resizeMode?: ImageResizeMode;
};

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
  variants: Partial<Record<ImageQuality, ImageVariantDetails>>;
};

export type ImageVariantUploadResult = {
  referenceKey: string;
  contentType: string;
  metadata: ImageVariantMetadata;
};
