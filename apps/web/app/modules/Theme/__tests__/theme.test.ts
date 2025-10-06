import { describe, it, expect } from "vitest";

import { hexToHslTuple, hslToHex } from "../helpers";

describe("hexToHslTuple", () => {
  it("should convert hex black to HSL tuple", () => {
    expect(hexToHslTuple("#000000")).toEqual([0, 0, 0]);
  });

  it("should convert hex white to HSL tuple", () => {
    expect(hexToHslTuple("#ffffff")).toEqual([0, 0, 100]);
  });

  it("should convert hex red to HSL tuple", () => {
    expect(hexToHslTuple("#ff0000")).toEqual([0, 100, 50]);
  });

  it("should convert hex green to HSL tuple", () => {
    expect(hexToHslTuple("#00ff00")).toEqual([120, 100, 50]);
  });

  it("should convert hex blue to HSL tuple", () => {
    expect(hexToHslTuple("#0000ff")).toEqual([240, 100, 50]);
  });

  it("should support shorthand hex (#fff)", () => {
    expect(hexToHslTuple("#fff")).toEqual([0, 0, 100]);
  });
});

describe("hslToHex", () => {
  it("should convert HSL black to hex", () => {
    expect(hslToHex(0, 0, 0)).toBe("#000000");
  });

  it("should convert HSL white to hex", () => {
    expect(hslToHex(0, 0, 100)).toBe("#ffffff");
  });

  it("should convert HSL red to hex", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
  });

  it("should convert HSL green to hex", () => {
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");
  });

  it("should convert HSL blue to hex", () => {
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");
  });
});
