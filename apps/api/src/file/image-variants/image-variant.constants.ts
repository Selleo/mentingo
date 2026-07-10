export const IMAGE_VARIANT_CONTENT_TYPE = "image/webp";

export const IMAGE_RESIZE_MODES = ["contain", "cover-square"] as const;

export const IMAGE_QUALITY = {
  XXS: "160w",
  XS: "320w",
  SM: "640w",
  MD: "960w",
  LG: "1280w",
  XL: "1920w",
} as const;

export const IMAGE_VARIANT_WIDTHS = {
  [IMAGE_QUALITY.XXS]: 160,
  [IMAGE_QUALITY.XS]: 320,
  [IMAGE_QUALITY.SM]: 640,
  [IMAGE_QUALITY.MD]: 960,
  [IMAGE_QUALITY.LG]: 1280,
  [IMAGE_QUALITY.XL]: 1920,
} as const;

export const IMAGE_VARIANT_DEFINITIONS = [
  { quality: IMAGE_QUALITY.XXS, width: IMAGE_VARIANT_WIDTHS[IMAGE_QUALITY.XXS] },
  { quality: IMAGE_QUALITY.XS, width: IMAGE_VARIANT_WIDTHS[IMAGE_QUALITY.XS] },
  { quality: IMAGE_QUALITY.SM, width: IMAGE_VARIANT_WIDTHS[IMAGE_QUALITY.SM] },
  { quality: IMAGE_QUALITY.MD, width: IMAGE_VARIANT_WIDTHS[IMAGE_QUALITY.MD] },
  { quality: IMAGE_QUALITY.LG, width: IMAGE_VARIANT_WIDTHS[IMAGE_QUALITY.LG] },
  { quality: IMAGE_QUALITY.XL, width: IMAGE_VARIANT_WIDTHS[IMAGE_QUALITY.XL] },
] as const;

export const PWA_ICON_IMAGE_QUALITY = {
  ICON_192: "192w",
  ICON_512: "512w",
} as const;

export const PWA_ICON_IMAGE_VARIANT_DEFINITIONS = [
  { quality: PWA_ICON_IMAGE_QUALITY.ICON_192, width: 192 },
  { quality: PWA_ICON_IMAGE_QUALITY.ICON_512, width: 512 },
] as const;

export const ALL_IMAGE_VARIANT_DEFINITIONS = [
  ...IMAGE_VARIANT_DEFINITIONS,
  ...PWA_ICON_IMAGE_VARIANT_DEFINITIONS,
] as const;

export const ALL_IMAGE_QUALITY_VALUES = [
  ...Object.values(IMAGE_QUALITY),
  ...Object.values(PWA_ICON_IMAGE_QUALITY),
] as const;

export const SUPPORTED_IMAGE_VARIANT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const SUPPORTED_IMAGE_VARIANT_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_IMAGE_VARIANT_MIME_TYPES,
);
