import { Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "~/components/ui/drawer";
import { cn } from "~/lib/utils";

import { COURSE_AUTHORING_HANDLES } from "../../../e2e/data/curriculum/handles";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react";

type CourseAuthoringDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  background?: ReactNode;
  headerAction?: ReactNode;
  keepMounted?: boolean;
  contentRef?: RefObject<HTMLDivElement>;
};

const MIN_DRAWER_HEIGHT = 360;
const MAX_DRAWER_HEIGHT_RATIO = 0.9;
const RESIZE_STEP = 48;

/** Lets the focused authoring popup consume Escape before Vaul dismisses the drawer. */
const handleAuthoringDrawerEscape = (event: KeyboardEvent) => {
  if (!(event.target instanceof Element)) return;
  const popup = event.target.closest("[data-course-authoring-popup]");
  if (!popup) return;
  event.preventDefault();
  popup.dispatchEvent(new Event("course-authoring-popup-escape"));
};

/** Provides the same drawer, resize controls, and conversation layout for both authoring flows. */
export const CourseAuthoringDrawer = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  background,
  headerAction,
  keepMounted = false,
  contentRef,
}: CourseAuthoringDrawerProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const internalDrawerRef = useRef<HTMLDivElement>(null);
  const drawerRef = contentRef ?? internalDrawerRef;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
    },
    [],
  );
  useEffect(() => {
    if (!open) resizeCleanupRef.current?.();
  }, [open]);

  /** Caps the drawer at ninety percent of the viewport while remaining usable on short screens. */
  const getMaxDrawerHeight = () =>
    Math.min(
      window.innerHeight,
      Math.max(MIN_DRAWER_HEIGHT, Math.round(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO)),
    );

  /** Clamps a requested drawer height to the current viewport bounds. */
  const clampDrawerHeight = (height: number) =>
    Math.min(Math.max(height, MIN_DRAWER_HEIGHT), getMaxDrawerHeight());

  /** Starts pointer resizing from the grab handle and restores global interaction styles on exit. */
  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();
    setExpanded(false);
    setDrawerHeight(clampDrawerHeight(window.innerHeight - event.clientY));
    const previousBodyCursor = document.body.style.cursor;
    const previousHtmlCursor = document.documentElement.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "ns-resize";
    document.documentElement.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setDrawerHeight(clampDrawerHeight(window.innerHeight - moveEvent.clientY));
    };
    /** Ends pointer resizing for both normal release and browser cancellation. */
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = previousBodyCursor;
      document.documentElement.style.cursor = previousHtmlCursor;
      document.body.style.userSelect = previousUserSelect;
      resizeCleanupRef.current = null;
    };

    resizeCleanupRef.current = handlePointerUp;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  /** Adjusts the drawer height from the keyboard without starting Vaul’s swipe gesture. */
  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    let nextHeight: number | null = null;
    const currentHeight =
      drawerHeight ?? drawerRef.current?.getBoundingClientRect().height ?? getMaxDrawerHeight();
    switch (event.key) {
      case "ArrowUp":
        nextHeight = currentHeight + RESIZE_STEP;
        break;
      case "ArrowDown":
        nextHeight = currentHeight - RESIZE_STEP;
        break;
      case "Home":
        nextHeight = MIN_DRAWER_HEIGHT;
        break;
      case "End":
        nextHeight = getMaxDrawerHeight();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    setExpanded(false);
    setDrawerHeight(clampDrawerHeight(nextHeight));
  };

  return (
    <Drawer open={open} modal={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      {background}
      {(open || keepMounted) && (
        <DrawerContent
          ref={drawerRef}
          forceMount={keepMounted || undefined}
          renderOverlay={open}
          data-testid={COURSE_AUTHORING_HANDLES.DRAWER}
          overlayClassName="z-[49] bg-[rgba(0,0,0,0.3)]"
          onEscapeKeyDown={handleAuthoringDrawerEscape}
          onOpenAutoFocus={() => closeButtonRef.current?.focus({ preventScroll: true })}
          style={!expanded && drawerHeight !== null ? { height: `${drawerHeight}px` } : undefined}
          className={cn(
            "scrollbar-hide overflow-visible rounded-t-2xl border-neutral-200 bg-white p-0 shadow-2xl [&>div:first-child]:hidden",
            !open && "pointer-events-none invisible",
            expanded ? "h-[90dvh]" : "h-[min(32rem,82dvh)]",
          )}
          aria-hidden={!open}
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
          <div
            data-vaul-no-drag
            className="relative flex h-10 shrink-0 items-center justify-center border-b border-neutral-100"
          >
            <button
              type="button"
              data-vaul-no-drag
              data-testid={COURSE_AUTHORING_HANDLES.RESIZE_HANDLE}
              aria-label={t("courseAuthoring.conversation.resize", {
                defaultValue: "Resize drawer",
              })}
              onPointerDown={handleResizeStart}
              onKeyDown={handleResizeKeyDown}
              className="group absolute inset-0 flex h-10 w-full cursor-ns-resize touch-none items-center justify-center"
            >
              <span
                aria-hidden="true"
                className="h-1 w-10 rounded-full bg-neutral-300 transition-colors group-hover:bg-neutral-500"
              />
            </button>
            <div className="pointer-events-auto absolute left-2 z-10 max-w-[calc(100%-7rem)]">
              {headerAction ?? (
                <span className="body-sm-md truncate px-2 text-neutral-950">{title}</span>
              )}
            </div>
            <div className="pointer-events-auto absolute right-2 z-10 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                data-testid={COURSE_AUTHORING_HANDLES.RESIZE_TOGGLE}
                onClick={() => setExpanded((value) => !value)}
                aria-label={t(
                  expanded
                    ? "courseAuthoring.conversation.collapse"
                    : "courseAuthoring.conversation.expand",
                )}
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onOpenChange(false)}
                aria-label={t("courseAuthoring.conversation.close")}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div
            data-vaul-no-drag
            className={cn("min-h-0 flex-1 overflow-hidden", !open && "hidden")}
          >
            <div className="h-full min-w-0">{children}</div>
          </div>
        </DrawerContent>
      )}
    </Drawer>
  );
};
