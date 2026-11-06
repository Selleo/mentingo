import { describe, it, expect } from "vitest";

import {
  buildColorPalette,
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  oklchToHex,
  rgbToHex,
  rgbToOklch,
} from "../helpers";
import { MIN_TEXT_CONTRAST, PALETTE_SHADES } from "../theme.constants";

const DEFAULT_BRAND = "#3f58b6";
const PROBLEMATIC_BRANDS = ["#fffb00", "#00ff00", "#ffd6e7", "#00e5ff", "#ffffff"];

describe("hex conversion", () => {
  it("should parse full and shorthand hex", () => {
    expect(hexToRgb("#ff0000")).toEqual([1, 0, 0]);
    expect(hexToRgb("#fff")).toEqual([1, 1, 1]);
  });

  it("should round-trip through OKLCH", () => {
    ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", DEFAULT_BRAND].forEach((hex) => {
      expect(oklchToHex(rgbToOklch(hexToRgb(hex)))).toBe(hex);
    });
  });

  it("should clamp out-of-range channels", () => {
    expect(rgbToHex([1.2, -0.1, 0.5])).toBe("#ff0080");
  });
});

describe("getContrastRatio", () => {
  it("should match WCAG reference values", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(getContrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});

describe("buildColorPalette", () => {
  it("should keep an already readable brand color as the 700 shade", () => {
    expect(buildColorPalette(DEFAULT_BRAND)[700]).toBe(DEFAULT_BRAND);
  });

  it.each([DEFAULT_BRAND, ...PROBLEMATIC_BRANDS])(
    "should keep 700 and darker shades readable on light surfaces for %s",
    (brand) => {
      const palette = buildColorPalette(brand);

      [700, 800, 900, 950].forEach((shade) => {
        expect(getContrastRatio(palette[shade as 700], palette[100])).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
        expect(getContrastRatio(palette[shade as 700], palette[50])).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
      });
    },
  );

  it.each([DEFAULT_BRAND, ...PROBLEMATIC_BRANDS, "#000000", "#121212"])(
    "should produce a scale that gets darker with every step for %s",
    (brand) => {
      const palette = buildColorPalette(brand);
      const luminances = PALETTE_SHADES.map((shade) => getRelativeLuminance(palette[shade]));

      luminances.slice(1).forEach((luminance, index) => {
        expect(luminance).toBeLessThanOrEqual(luminances[index]);
      });
    },
  );

  it.each(PROBLEMATIC_BRANDS)("should keep surface shades lightly tinted for %s", (brand) => {
    const palette = buildColorPalette(brand);

    expect(rgbToOklch(hexToRgb(palette[50])).chroma).toBeLessThanOrEqual(0.02);
    expect(rgbToOklch(hexToRgb(palette[100])).chroma).toBeLessThanOrEqual(0.035);
  });
});
