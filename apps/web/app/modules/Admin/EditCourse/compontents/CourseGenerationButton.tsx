import { type PointerEvent as ReactPointerEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerContent } from "~/components/ui/drawer";
import { cn } from "~/lib/utils";
import { CourseGenerationChatPanel } from "~/modules/Admin/EditCourse/compontents/CourseGenerationChatPanel";

import type { GetCourseGenerationDraftResponse } from "~/api/generated-api";

const MIN_DRAWER_HEIGHT = 220;
const MAX_DRAWER_HEIGHT_RATIO = 0.9;
const BASE_DRAWER_HEIGHT = 360;
const HEIGHT_PER_MESSAGE = 72;

type CourseGenerationFabProps = {
  draft?: GetCourseGenerationDraftResponse;
  className?: string;
};

export function CourseGenerationButton({ draft, className }: CourseGenerationFabProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(300);

  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const previousBodyCursor = document.body.style.cursor;
    const previousHtmlCursor = document.documentElement.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "ns-resize";
    document.documentElement.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    const maxHeight = Math.round(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO);
    const initialHeight = Math.min(
      Math.max(window.innerHeight - event.clientY, MIN_DRAWER_HEIGHT),
      maxHeight,
    );
    setDrawerHeight(initialHeight);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = Math.min(
        Math.max(window.innerHeight - moveEvent.clientY, MIN_DRAWER_HEIGHT),
        maxHeight,
      );
      setDrawerHeight(nextHeight);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = previousBodyCursor;
      document.documentElement.style.cursor = previousHtmlCursor;
      document.body.style.userSelect = previousUserSelect;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleMessageCountChange = useCallback((count: number) => {
    const maxHeight = Math.round(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO);
    const autoHeight = Math.min(
      Math.max(BASE_DRAWER_HEIGHT + count * HEIGHT_PER_MESSAGE, MIN_DRAWER_HEIGHT),
      maxHeight,
    );
    setDrawerHeight((current) => Math.max(current, autoHeight));
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        aria-label={t("adminCourseView.curriculum.chapter.button.generateWithAI")}
        className={cn("gap-2 rounded-lg px-4 py-2", className)}
      >
        <Icon name="WandSparkles" className="size-4" />
        {t("adminCourseView.curriculum.chapter.button.generateWithAI")}
      </Button>
      {isOpen && <div className="fixed inset-0 z-10 bg-black opacity-50" />}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent
          style={{ height: `${drawerHeight}px` }}
          className="overflow-hidden rounded-t-3xl border-neutral-200 bg-white p-0 shadow-2xl [&>div:first-child]:hidden"
        >
          <button
            type="button"
            aria-label="Drag to resize drawer"
            data-vaul-no-drag
            onPointerDown={handleResizeStart}
            className="group relative flex h-8 w-full cursor-ns-resize items-center justify-center border-b border-neutral-200 bg-white transition-colors hover:bg-neutral-100"
          >
            <span className="grid grid-cols-3 gap-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  key={index}
                  className="size-1 rounded-full bg-neutral-400 transition-colors group-hover:bg-neutral-600"
                />
              ))}
            </span>
          </button>
          <div className="h-[calc(100%-2rem)]">
            <CourseGenerationChatPanel
              onMessageCountChange={handleMessageCountChange}
              onClose={() => setIsOpen(false)}
              draft={draft}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
