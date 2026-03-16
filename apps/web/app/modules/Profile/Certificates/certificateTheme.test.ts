import { describe, expect, it } from "vitest";

import {
  applyUniformCertificateColor,
  defaultCertificateColorTheme,
  getCertificateColorTheme,
} from "./certificateTheme";

describe("certificateTheme", () => {
  it("applies the same color to all theme fields", () => {
    const color = "#123abc";
    const theme = applyUniformCertificateColor(color, defaultCertificateColorTheme);

    expect(theme).toEqual({
      titleColor: color,
      certifyTextColor: color,
      nameColor: color,
      courseNameColor: color,
      bodyTextColor: color,
      labelTextColor: color,
      lineColor: color,
      logoColor: color,
    });
  });

  it("returns default theme when certificate color is missing", () => {
    expect(getCertificateColorTheme(null)).toEqual(defaultCertificateColorTheme);
    expect(getCertificateColorTheme(undefined)).toEqual(defaultCertificateColorTheme);
  });
});
