import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCanvasControls } from "../useCanvasControls";

describe("useCanvasControls", () => {
  describe("zoom", () => {
    it("starts at zoom level 1", () => {
      const { result } = renderHook(() => useCanvasControls());
      expect(result.current.zoom).toBe(1);
    });

    it("zooms in by 0.05 per step", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        result.current.handleZoomIn();
      });

      expect(result.current.zoom).toBeCloseTo(1.05);
    });

    it("zooms out by 0.05 per step", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        result.current.handleZoomOut();
      });

      expect(result.current.zoom).toBeCloseTo(0.95);
    });

    it("clamps zoom to maximum of 2", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        // Call zoomIn enough times to exceed max
        for (let i = 0; i < 30; i++) {
          result.current.handleZoomIn();
        }
      });

      expect(result.current.zoom).toBe(2);
    });

    it("clamps zoom to minimum of 0.25", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        // Call zoomOut enough times to go below min
        for (let i = 0; i < 30; i++) {
          result.current.handleZoomOut();
        }
      });

      expect(result.current.zoom).toBe(0.25);
    });

    it("resets zoom to 1 and pan to origin", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        result.current.handleZoomIn();
        result.current.handleZoomIn();
      });

      act(() => {
        result.current.handleZoomReset();
      });

      expect(result.current.zoom).toBe(1);
      expect(result.current.pan).toEqual({ x: 0, y: 0 });
    });
  });

  describe("wheel zoom", () => {
    it("zooms in on scroll up (negative deltaY)", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        result.current.handleWheel({
          deltaY: -100,
          preventDefault: () => {},
        } as unknown as React.WheelEvent);
      });

      expect(result.current.zoom).toBeCloseTo(1.05);
    });

    it("zooms out on scroll down (positive deltaY)", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        result.current.handleWheel({
          deltaY: 100,
          preventDefault: () => {},
        } as unknown as React.WheelEvent);
      });

      expect(result.current.zoom).toBeCloseTo(0.95);
    });

    it("respects zoom bounds via wheel", () => {
      const { result } = renderHook(() => useCanvasControls());

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.handleWheel({
            deltaY: -100,
            preventDefault: () => {},
          } as unknown as React.WheelEvent);
        }
      });

      expect(result.current.zoom).toBe(2);
    });
  });

  describe("pan", () => {
    it("starts with pan at origin", () => {
      const { result } = renderHook(() => useCanvasControls());
      expect(result.current.pan).toEqual({ x: 0, y: 0 });
    });

    it("starts not panning", () => {
      const { result } = renderHook(() => useCanvasControls());
      expect(result.current.isPanning).toBe(false);
    });
  });
});
