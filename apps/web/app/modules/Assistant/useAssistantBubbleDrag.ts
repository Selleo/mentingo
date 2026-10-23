import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { KeyboardEvent, PointerEvent } from "react";

export const BUBBLE_SIZE = 56;
const MARGIN = 12;
export type BubbleViewport = { width: number; height: number; left: number; top: number };
export type BubblePoint = { x: number; y: number };

export function clampBubble(point: BubblePoint, viewport: BubbleViewport): BubblePoint {
  return {
    x: Math.max(
      viewport.left + MARGIN,
      Math.min(point.x, viewport.left + viewport.width - BUBBLE_SIZE - MARGIN),
    ),
    y: Math.max(
      viewport.top + MARGIN,
      Math.min(point.y, viewport.top + viewport.height - BUBBLE_SIZE - MARGIN),
    ),
  };
}

export function defaultBubblePosition(viewport: BubbleViewport): BubblePoint {
  return clampBubble(
    {
      x: viewport.left + viewport.width - BUBBLE_SIZE - 24,
      y: viewport.top + viewport.height - BUBBLE_SIZE - 24,
    },
    viewport,
  );
}

export function isBubbleOverDismiss(point: BubblePoint, viewport: BubbleViewport) {
  return (
    Math.hypot(
      point.x + BUBBLE_SIZE / 2 - (viewport.left + viewport.width / 2),
      point.y + BUBBLE_SIZE / 2 - (viewport.top + viewport.height - 60),
    ) < 60
  );
}

export function useAssistantBubbleDrag(
  onDismiss: () => void,
  onDragStart: () => void,
  persistenceKey: string,
) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const [viewport, setViewport] = useState<BubbleViewport | null>(null);
  const [position, setPosition] = useState<BubblePoint>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [overDismiss, setOverDismiss] = useState(false);
  const gesture = useRef<{ id: number; start: BubblePoint; origin: BubblePoint; moved: boolean }>();
  const suppressClick = useRef(false);

  useEffect(() => {
    let initialized = false;
    const resize = () => {
      const visual = window.visualViewport;
      const next = {
        width: visual?.width ?? window.innerWidth,
        height: visual?.height ?? window.innerHeight,
        left: visual?.offsetLeft ?? 0,
        top: visual?.offsetTop ?? 0,
      };
      let stored: BubblePoint | null = null;
      if (!initialized) {
        try {
          const value: unknown = JSON.parse(
            window.sessionStorage.getItem(persistenceKey) ?? "null",
          );
          if (
            value &&
            typeof value === "object" &&
            "x" in value &&
            "y" in value &&
            typeof value.x === "number" &&
            typeof value.y === "number" &&
            Number.isFinite(value.x) &&
            Number.isFinite(value.y)
          )
            stored = { x: value.x, y: value.y };
        } catch {
          /* Position persistence is optional. */
        }
      }
      const point = clampBubble(
        initialized ? { x: x.get(), y: y.get() } : (stored ?? defaultBubblePosition(next)),
        next,
      );
      initialized = true;
      x.stop();
      y.stop();
      x.set(point.x);
      y.set(point.y);
      setPosition(point);
      setViewport(next);
    };
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      x.stop();
      y.stop();
    };
  }, [persistenceKey, x, y]);

  const settle = (point: BubblePoint) => {
    const transition = reducedMotion
      ? { duration: 0 }
      : { type: "spring" as const, stiffness: 600, damping: 42 };
    animate(x, point.x, transition);
    animate(y, point.y, transition);
    setPosition(point);
    try {
      window.sessionStorage.setItem(persistenceKey, JSON.stringify(point));
    } catch {
      /* Keep the in-memory position. */
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!viewport || event.button !== 0 || gesture.current) return;
    x.stop();
    y.stop();
    setPosition({ x: x.get(), y: y.get() });
    suppressClick.current = false;
    gesture.current = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: x.get(), y: y.get() },
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId || !viewport) return;
    const delta = { x: event.clientX - current.start.x, y: event.clientY - current.start.y };
    if (!current.moved && Math.hypot(delta.x, delta.y) < 6) return;
    if (!current.moved) {
      current.moved = true;
      setDragging(true);
      onDragStart();
    }
    const next = clampBubble(
      { x: current.origin.x + delta.x, y: current.origin.y + delta.y },
      viewport,
    );
    x.set(next.x);
    y.set(next.y);
    setPosition(next);
    setOverDismiss(isBubbleOverDismiss(next, viewport));
  };
  const finish = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = undefined;
    suppressClick.current = current.moved;
    setDragging(false);
    setOverDismiss(false);
    if (current.moved && viewport) {
      const point = { x: x.get(), y: y.get() };
      if (!cancelled && isBubbleOverDismiss(point, viewport)) onDismiss();
      else
        settle(
          clampBubble(
            {
              ...point,
              x:
                point.x + BUBBLE_SIZE / 2 < viewport.left + viewport.width / 2
                  ? viewport.left + MARGIN
                  : viewport.left + viewport.width - BUBBLE_SIZE - MARGIN,
            },
            viewport,
          ),
        );
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!viewport) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDismiss();
      return;
    }
    const offsets: Record<string, BubblePoint> = {
      ArrowLeft: { x: -24, y: 0 },
      ArrowRight: { x: 24, y: 0 },
      ArrowUp: { x: 0, y: -24 },
      ArrowDown: { x: 0, y: 24 },
    };
    const offset = offsets[event.key];
    if (offset) {
      event.preventDefault();
      settle(clampBubble({ x: x.get() + offset.x, y: y.get() + offset.y }, viewport));
    }
  };

  return {
    x,
    y,
    viewport,
    position,
    dragging,
    overDismiss,
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
    onKeyDown,
    shouldSuppressClick: () => suppressClick.current,
  };
}
