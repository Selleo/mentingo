import { useCallback, useEffect, useRef, useState } from "react";

import type { PointerEvent } from "react";

export const CANVAS_ZOOM_STEP = 0.05;
export const CANVAS_ZOOM_MIN = 0.25;
export const CANVAS_ZOOM_MAX = 2;

export function useCanvasControls() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleZoomIn = useCallback(() => {
    setZoom((current) => Math.min(current + CANVAS_ZOOM_STEP, CANVAS_ZOOM_MAX));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((current) => Math.max(current - CANVAS_ZOOM_STEP, CANVAS_ZOOM_MIN));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      const delta = event.deltaY > 0 ? -CANVAS_ZOOM_STEP : CANVAS_ZOOM_STEP;

      setZoom((current) => Math.min(Math.max(current + delta, CANVAS_ZOOM_MIN), CANVAS_ZOOM_MAX));
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target;
      const isBackground = target instanceof HTMLElement && Boolean(target.dataset.canvasBg);

      if (event.button !== 1 && !(event.button === 0 && isBackground)) return;

      event.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pan],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isPanning) return;

      const differenceX = event.clientX - panStartRef.current.x;
      const differenceY = event.clientY - panStartRef.current.y;

      setPan({
        x: panStartRef.current.panX + differenceX,
        y: panStartRef.current.panY + differenceY,
      });
    },
    [isPanning],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return {
    canvasRef,
    zoom,
    pan,
    isPanning,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
