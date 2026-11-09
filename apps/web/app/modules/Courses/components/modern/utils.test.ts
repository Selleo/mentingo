import { describe, expect, it } from "vitest";

import { doesExpandedCardCoverRowEdge, getExpandedCardOffset } from "./utils";

const VIEWPORT_BOUNDS = { top: 0, right: 1200, bottom: 800, left: 0 };
const BASE_INPUT = {
  panelHeight: 200,
  bounds: VIEWPORT_BOUNDS,
  scale: 1.25,
  margin: 12,
  minLift: 8,
};

describe("getExpandedCardOffset", () => {
  it("lifts a card with room around it only by the minimum lift", () => {
    const offset = getExpandedCardOffset({
      ...BASE_INPUT,
      cardRect: { top: 100, right: 700, bottom: 325, left: 300 },
    });

    expect(offset).toEqual({ x: 0, y: -8 });
  });

  it("shifts a card near the right edge back inside the bounds", () => {
    const offset = getExpandedCardOffset({
      ...BASE_INPUT,
      cardRect: { top: 100, right: 1250, bottom: 325, left: 850 },
    });

    expect(offset.x).toBe(-112);
  });

  it("shifts a card near the left edge back inside the bounds", () => {
    const offset = getExpandedCardOffset({
      ...BASE_INPUT,
      cardRect: { top: 100, right: 400, bottom: 325, left: 0 },
    });

    expect(offset.x).toBe(62);
  });

  it("moves a card near the bottom up so the expanded panel stays visible", () => {
    const offset = getExpandedCardOffset({
      ...BASE_INPUT,
      cardRect: { top: 500, right: 700, bottom: 725, left: 300 },
    });

    expect(500 + offset.y + (225 + 200) * 1.25).toBeLessThanOrEqual(800 - 12);
  });

  it("never moves a card above the top of the bounds", () => {
    const offset = getExpandedCardOffset({
      ...BASE_INPUT,
      bounds: { ...VIEWPORT_BOUNDS, bottom: 400 },
      cardRect: { top: 100, right: 700, bottom: 325, left: 300 },
    });

    expect(offset.y).toBe(-88);
  });
});

describe("doesExpandedCardCoverRowEdge", () => {
  const ROW_RECT = { top: 0, right: 1200, bottom: 300, left: 0 };
  const BASE_COVERAGE_INPUT = { rowRect: ROW_RECT, scale: 1.25, edgeWidth: 112 };

  it("returns false for a card expanding away from the row edges", () => {
    const coversRowEdge = doesExpandedCardCoverRowEdge({
      ...BASE_COVERAGE_INPUT,
      cardRect: { top: 0, right: 700, bottom: 225, left: 300 },
      offsetX: 0,
    });

    expect(coversRowEdge).toBe(false);
  });

  it("returns true for a card expanding into the right arrow zone", () => {
    const coversRowEdge = doesExpandedCardCoverRowEdge({
      ...BASE_COVERAGE_INPUT,
      cardRect: { top: 0, right: 1100, bottom: 225, left: 700 },
      offsetX: 0,
    });

    expect(coversRowEdge).toBe(true);
  });

  it("returns true for a card expanding into the left arrow zone", () => {
    const coversRowEdge = doesExpandedCardCoverRowEdge({
      ...BASE_COVERAGE_INPUT,
      cardRect: { top: 0, right: 432, bottom: 225, left: 32 },
      offsetX: 62,
    });

    expect(coversRowEdge).toBe(true);
  });
});
