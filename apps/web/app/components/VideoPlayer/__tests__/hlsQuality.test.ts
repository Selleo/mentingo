import { describe, expect, it } from "vitest";

import {
  applyHlsQualitySelection,
  getHlsQualityOptions,
  HLS_AUTO_HD_VALUE,
  type HlsQualityLevel,
} from "../hlsQuality";

const createQualityLevel = (height: number): HlsQualityLevel => ({
  height,
  width: Math.round((height / 9) * 16),
  bitrate: height * 1000,
  enabled: true,
});

describe("hlsQuality", () => {
  it("builds auto and fixed quality options from available representation heights", () => {
    const options = getHlsQualityOptions([
      createQualityLevel(360),
      createQualityLevel(720),
      createQualityLevel(1080),
      createQualityLevel(720),
    ]);

    expect(options).toEqual([
      { value: HLS_AUTO_HD_VALUE, label: "Auto" },
      { value: "fixed:1080", label: "1080p", height: 1080 },
      { value: "fixed:720", label: "720p", height: 720 },
      { value: "fixed:360", label: "360p", height: 360 },
    ]);
  });

  it("hides quality options when only one representation height exists", () => {
    expect(getHlsQualityOptions([createQualityLevel(720), createQualityLevel(720)])).toEqual([]);
  });

  it("auto hd enables only 720p to 1080p representations when available", () => {
    const representations = [
      createQualityLevel(360),
      createQualityLevel(720),
      createQualityLevel(1080),
      createQualityLevel(1440),
    ];

    applyHlsQualitySelection(representations, HLS_AUTO_HD_VALUE);

    expect(representations.map((representation) => representation.enabled)).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it("auto hd falls back to the best lower representation when no hd representation exists", () => {
    const representations = [
      createQualityLevel(240),
      createQualityLevel(360),
      createQualityLevel(480),
    ];

    applyHlsQualitySelection(representations, HLS_AUTO_HD_VALUE);

    expect(representations.map((representation) => representation.enabled)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("fixed quality enables only matching representation heights", () => {
    const representations = [
      createQualityLevel(360),
      createQualityLevel(720),
      createQualityLevel(1080),
    ];

    applyHlsQualitySelection(representations, "fixed:720");

    expect(representations.map((representation) => representation.enabled)).toEqual([
      false,
      true,
      false,
    ]);
  });
});
