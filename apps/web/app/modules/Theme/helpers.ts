import {
  BISECTION_STEPS,
  CONTRAST_FLARE,
  DARK_SHADES,
  FULL_TURN_DEGREES,
  GAMUT_EPSILON,
  HEX_RADIX,
  LIGHT_SHADES,
  LINEAR_RGB_TO_LMS,
  LMS_TO_LINEAR_RGB,
  LMS_TO_OKLAB,
  LUMINANCE_WEIGHTS,
  MAX_CHANNEL_VALUE,
  MIN_TEXT_CONTRAST,
  OKLAB_TO_LMS,
  SRGB_TRANSFER,
  SURFACE_LIGHTNESS_STEP,
  SURFACE_SHADES,
} from "./theme.constants";

import type { Matrix3, PALETTE_SHADES } from "./theme.constants";
import type { ColorSchema } from "./theme.types";

type Vector3 = [number, number, number];
type Oklch = { lightness: number; chroma: number; hue: number };

export type PaletteShade = (typeof PALETTE_SHADES)[number];

export type ColorPalette = Record<PaletteShade, string>;

type PaletteOverrides = Partial<Pick<ColorSchema, "backgroundColor" | "accentColor">>;

export const readCssVariable = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const toRadians = (degrees: number) => (degrees * Math.PI) / (FULL_TURN_DEGREES / 2);

const toDegrees = (radians: number) => (radians * (FULL_TURN_DEGREES / 2)) / Math.PI;

const multiplyMatrix = (matrix: Matrix3, vector: Vector3): Vector3 =>
  matrix.map(
    ([first, second, third]) => first * vector[0] + second * vector[1] + third * vector[2],
  ) as Vector3;

export const hexToRgb = (hex: string): Vector3 => {
  const value = hex.replace(/^#/, "");
  const fullHex =
    value.length === 3
      ? value
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : value;

  return [
    parseInt(fullHex.slice(0, 2), HEX_RADIX) / MAX_CHANNEL_VALUE,
    parseInt(fullHex.slice(2, 4), HEX_RADIX) / MAX_CHANNEL_VALUE,
    parseInt(fullHex.slice(4, 6), HEX_RADIX) / MAX_CHANNEL_VALUE,
  ];
};

export const rgbToHex = (rgb: Vector3) =>
  `#${rgb
    .map((channel) =>
      Math.round(clampUnit(channel) * MAX_CHANNEL_VALUE)
        .toString(HEX_RADIX)
        .padStart(2, "0"),
    )
    .join("")}`;

const toLinear = (channel: number) => {
  const { encodedThreshold, linearSlope, offset, gamma } = SRGB_TRANSFER;

  return channel <= encodedThreshold
    ? channel / linearSlope
    : ((channel + offset) / (1 + offset)) ** gamma;
};

const fromLinear = (channel: number) => {
  const { linearThreshold, linearSlope, offset, gamma } = SRGB_TRANSFER;

  return channel <= linearThreshold
    ? channel * linearSlope
    : (1 + offset) * channel ** (1 / gamma) - offset;
};

export const rgbToOklch = (rgb: Vector3): Oklch => {
  const linearRgb = rgb.map(toLinear) as Vector3;
  const lms = multiplyMatrix(LINEAR_RGB_TO_LMS, linearRgb).map(Math.cbrt) as Vector3;
  const [lightness, greenRed, blueYellow] = multiplyMatrix(LMS_TO_OKLAB, lms);

  const hue = toDegrees(Math.atan2(blueYellow, greenRed));

  return {
    lightness,
    chroma: Math.hypot(greenRed, blueYellow),
    hue: hue < 0 ? hue + FULL_TURN_DEGREES : hue,
  };
};

const oklchToLinearRgb = ({ lightness, chroma, hue }: Oklch): Vector3 => {
  const oklab: Vector3 = [
    lightness,
    chroma * Math.cos(toRadians(hue)),
    chroma * Math.sin(toRadians(hue)),
  ];
  const lms = multiplyMatrix(OKLAB_TO_LMS, oklab).map((value) => value ** 3) as Vector3;

  return multiplyMatrix(LMS_TO_LINEAR_RGB, lms);
};

const isInGamut = (linearRgb: Vector3) =>
  linearRgb.every((channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);

// Out-of-gamut colors lose chroma so lightness and hue are preserved
export const oklchToHex = (color: Oklch): string => {
  const lightness = clampUnit(color.lightness);
  let linearRgb = oklchToLinearRgb({ ...color, lightness });

  if (!isInGamut(linearRgb)) {
    let inGamutChroma = 0;
    let outOfGamutChroma = color.chroma;

    for (let step = 0; step < BISECTION_STEPS; step++) {
      const chroma = (inGamutChroma + outOfGamutChroma) / 2;

      if (isInGamut(oklchToLinearRgb({ ...color, lightness, chroma }))) inGamutChroma = chroma;
      else outOfGamutChroma = chroma;
    }

    linearRgb = oklchToLinearRgb({ ...color, lightness, chroma: inGamutChroma });
  }

  return rgbToHex(linearRgb.map((channel) => fromLinear(clampUnit(channel))) as Vector3);
};

export const getRelativeLuminance = (hex: string) => {
  const linearRgb = hexToRgb(hex).map(toLinear);

  return linearRgb.reduce(
    (luminance, channel, index) => luminance + channel * LUMINANCE_WEIGHTS[index],
    0,
  );
};

export const getContrastRatio = (firstHex: string, secondHex: string) => {
  const first = getRelativeLuminance(firstHex);
  const second = getRelativeLuminance(secondHex);

  return (Math.max(first, second) + CONTRAST_FLARE) / (Math.min(first, second) + CONTRAST_FLARE);
};

export const pickMostReadableColor = (backgroundHex: string, candidateHexes: string[]) =>
  candidateHexes.reduce((mostReadable, candidate) =>
    getContrastRatio(candidate, backgroundHex) > getContrastRatio(mostReadable, backgroundHex)
      ? candidate
      : mostReadable,
  );

// Brand colors that are already readable are returned unchanged
const getReadableAnchor = (brand: Oklch, brandHex: string, surfaceHex: string) => {
  if (getContrastRatio(brandHex, surfaceHex) >= MIN_TEXT_CONTRAST) {
    return { hex: brandHex, lightness: brand.lightness };
  }

  let readableLightness = 0;
  let unreadableLightness = brand.lightness;

  for (let step = 0; step < BISECTION_STEPS; step++) {
    const lightness = (readableLightness + unreadableLightness) / 2;
    const candidate = oklchToHex({ ...brand, lightness });

    if (getContrastRatio(candidate, surfaceHex) >= MIN_TEXT_CONTRAST) readableLightness = lightness;
    else unreadableLightness = lightness;
  }

  return {
    hex: oklchToHex({ ...brand, lightness: readableLightness }),
    lightness: readableLightness,
  };
};

const hexToOklch = (hex: string) => rgbToOklch(hexToRgb(hex));

/**
 * - 50/100 are soft surfaces with capped chroma, or the custom background and a step darker.
 * - 700 is the custom accent, or the brand darkened only when needed to stay readable on 100.
 * - Every other shade sits between those anchors, so the scale always gets darker.
 */
export const buildColorPalette = (
  brandHex: string,
  { backgroundColor, accentColor }: PaletteOverrides = {},
): ColorPalette => {
  const brand = hexToOklch(brandHex);
  const accent = accentColor ? hexToOklch(accentColor) : brand;

  const buildSurfaceShade = (shade: keyof typeof SURFACE_SHADES) =>
    oklchToHex({
      ...brand,
      lightness: SURFACE_SHADES[shade].lightness,
      chroma: Math.min(brand.chroma, SURFACE_SHADES[shade].maxChroma),
    });

  const buildCustomSurfaceShade = (background: Oklch) =>
    oklchToHex({ ...background, lightness: background.lightness - SURFACE_LIGHTNESS_STEP });

  const shade50 = backgroundColor ? backgroundColor.toLowerCase() : buildSurfaceShade(50);
  const shade100 = backgroundColor
    ? buildCustomSurfaceShade(hexToOklch(backgroundColor))
    : buildSurfaceShade(100);
  const surfaceLightness = hexToOklch(shade100).lightness;

  const anchor = accentColor
    ? { hex: accentColor.toLowerCase(), lightness: accent.lightness }
    : getReadableAnchor(brand, brandHex.toLowerCase(), shade100);

  const buildLightShade = (shade: keyof typeof LIGHT_SHADES) =>
    oklchToHex({
      ...accent,
      lightness:
        anchor.lightness + (surfaceLightness - anchor.lightness) * LIGHT_SHADES[shade].position,
      chroma: Math.min(accent.chroma, LIGHT_SHADES[shade].maxChroma),
    });

  const buildDarkShade = (shade: keyof typeof DARK_SHADES) =>
    oklchToHex({ ...accent, lightness: anchor.lightness * DARK_SHADES[shade] });

  return {
    50: shade50,
    100: shade100,
    200: buildLightShade(200),
    300: buildLightShade(300),
    400: buildLightShade(400),
    500: buildLightShade(500),
    600: buildLightShade(600),
    700: anchor.hex,
    800: buildDarkShade(800),
    900: buildDarkShade(900),
    950: buildDarkShade(950),
  };
};
