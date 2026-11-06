export type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export const PALETTE_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// WCAG 2 AA contrast for normal text
export const MIN_TEXT_CONTRAST = 4.5;

/**
 * Palette tuning. These are design choices, not standards: they were picked so the default
 * brand (#3f58b6) lands close to the static scale in index.css.
 */
export const SURFACE_SHADES = {
  50: { lightness: 0.975, maxChroma: 0.015 },
  100: { lightness: 0.945, maxChroma: 0.03 },
} as const;

export const SURFACE_LIGHTNESS_STEP = SURFACE_SHADES[50].lightness - SURFACE_SHADES[100].lightness;

// Position between the 700 anchor (0) and the 100 surface (1)
export const LIGHT_SHADES = {
  200: { position: 0.85, maxChroma: 0.06 },
  300: { position: 0.7, maxChroma: 0.1 },
  400: { position: 0.5, maxChroma: Infinity },
  500: { position: 0.3, maxChroma: Infinity },
  600: { position: 0.15, maxChroma: Infinity },
} as const;

// Lightness relative to the 700 anchor
export const DARK_SHADES = {
  800: 0.88,
  900: 0.72,
  950: 0.58,
} as const;

export const GAMUT_EPSILON = 0.0001;

// Each step halves the search range; 24 steps is far below one 8-bit channel step
export const BISECTION_STEPS = 24;

export const HEX_RADIX = 16;
export const MAX_CHANNEL_VALUE = 255;
export const FULL_TURN_DEGREES = 360;

export const SRGB_TRANSFER = {
  encodedThreshold: 0.04045,
  linearThreshold: 0.0031308,
  linearSlope: 12.92,
  offset: 0.055,
  gamma: 2.4,
} as const;

export const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

export const CONTRAST_FLARE = 0.05;

export const LINEAR_RGB_TO_LMS: Matrix3 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

export const LMS_TO_OKLAB: Matrix3 = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

export const OKLAB_TO_LMS: Matrix3 = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];

export const LMS_TO_LINEAR_RGB: Matrix3 = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];
