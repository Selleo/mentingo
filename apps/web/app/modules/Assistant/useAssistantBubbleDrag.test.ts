import { describe, expect, it } from "vitest";

import { defaultBubblePosition, clampBubble, isBubbleOverDismiss } from "./useAssistantBubbleDrag";

const viewport = { width: 390, height: 844, left: 0, top: 0 };
describe("Assistant bubble bounds and dismissal", () => {
  it("defaults to the bottom-right corner on both narrow and wide screens", () => {
    expect(defaultBubblePosition(viewport)).toEqual({ x: 310, y: 764 });
    expect(defaultBubblePosition({ width: 1440, height: 960, left: 0, top: 0 })).toEqual({
      x: 1360,
      y: 880,
    });
  });
  it("keeps the complete bubble inside narrow screens", () => {
    expect(clampBubble({ x: -500, y: -300 }, viewport)).toEqual({ x: 12, y: 12 });
    expect(clampBubble({ x: 999, y: 999 }, viewport)).toEqual({ x: 322, y: 776 });
  });
  it("uses the same visual viewport for dragging and the close target", () => {
    const shifted = { ...viewport, left: 10, top: 200, height: 400 };
    expect(clampBubble({ x: 0, y: 0 }, shifted)).toEqual({ x: 22, y: 212 });
    expect(isBubbleOverDismiss({ x: 177, y: 512 }, shifted)).toBe(true);
    expect(isBubbleOverDismiss({ x: 22, y: 212 }, shifted)).toBe(false);
  });
  it("requires a release near the close target rather than any bottom edge", () => {
    expect(isBubbleOverDismiss({ x: 167, y: 756 }, viewport)).toBe(true);
    expect(isBubbleOverDismiss({ x: 12, y: 756 }, viewport)).toBe(false);
  });
});
