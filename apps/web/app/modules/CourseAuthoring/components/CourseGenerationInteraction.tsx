/**
 * Text-first generation surface shared by the course page and future inline entry points.
 * The host supplies durable results and command controls; this view owns no routing,
 * API calls or authoring state and can fit a narrow editor panel.
 */
import { FileUp, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CourseGenerationFileDropContext } from "./CourseGenerationFileDropContext";

import type { ReactNode } from "react";

type Props = {
  hasExistingContent: boolean;
  hasWork: boolean;
  activity: "working" | "waiting" | "failed" | "saved" | null;
  history?: ReactNode;
  review: ReactNode;
  activityAndQuestions: ReactNode;
  composer: ReactNode;
};

/** Places the request, actionable results and composer in one reading order without dashboard rails. */
export const CourseGenerationInteraction = ({
  hasExistingContent,
  hasWork,
  activity,
  history,
  review,
  activityAndQuestions,
  composer,
}: Props) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const dropHandler = useRef<((files: File[]) => void) | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const dragDepth = useRef(0);
  const resetDrag = useCallback(() => {
    dragDepth.current = 0;
    setDraggingFiles(false);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") resetDrag();
    };
    window.addEventListener("drop", resetDrag);
    window.addEventListener("dragend", resetDrag);
    window.addEventListener("blur", resetDrag);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("drop", resetDrag);
      window.removeEventListener("dragend", resetDrag);
      window.removeEventListener("blur", resetDrag);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [resetDrag]);
  const registerDropHandler = useCallback(
    (handler: ((files: File[]) => void) | null) => {
      dropHandler.current = handler;
      if (!handler) resetDrag();
    },
    [resetDrag],
  );
  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport && followLatest.current) viewport.scrollTop = viewport.scrollHeight;
  }, [review, activityAndQuestions, history, activity]);
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    const keepLatestVisible = () => {
      if (followLatest.current) viewport.scrollTop = viewport.scrollHeight;
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(keepLatestVisible);
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) resizeObserver?.observe(node);
        });
      });
      keepLatestVisible();
    });

    resizeObserver?.observe(viewport);
    Array.from(viewport.children).forEach((child) => resizeObserver?.observe(child));
    mutationObserver.observe(viewport, { childList: true, characterData: true, subtree: true });

    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
    };
  }, []);
  return (
    <CourseGenerationFileDropContext.Provider value={registerDropHandler}>
      <main
        className="flex min-h-0 w-full flex-1 flex-col"
        onDragEnter={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          dragDepth.current += 1;
          if (dropHandler.current) setDraggingFiles(true);
        }}
        onDragLeave={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
          if (nextTarget || dragDepth.current === 0) resetDrag();
        }}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = dropHandler.current ? "copy" : "none";
        }}
        onDrop={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          setDraggingFiles(false);
          dropHandler.current?.(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="relative flex min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4"
            onScroll={(event) => {
              const viewport = event.currentTarget;
              followLatest.current =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
            }}
          >
            <div className="mx-auto w-full max-w-3xl space-y-4">
              {!hasWork && (
                <div className="pb-2 pt-4">
                  <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                    {t(
                      hasExistingContent
                        ? "courseAuthoring.conversation.emptyEdit"
                        : "courseAuthoring.conversation.emptyCreate",
                    )}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">
                    {t("courseAuthoring.conversation.intro")}
                  </p>
                </div>
              )}
              {history}
              {activity && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 text-sm text-neutral-600"
                >
                  {activity === "working" && (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  )}
                  <span>{t(`courseAuthoring.conversation.${activity}`)}</span>
                </div>
              )}
              {hasWork && review}
              {hasWork && activityAndQuestions}
            </div>
          </div>
          {draggingFiles && (
            <div
              data-testid="course-authoring-file-drop-overlay"
              role="status"
              className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary-500 bg-primary-50 p-6 text-center text-primary-800"
            >
              <FileUp className="size-10" aria-hidden="true" />
              <span className="text-lg font-semibold">
                {t("courseAuthoring.tools.attachFiles")}
              </span>
              <span className="text-sm">{t("courseAuthoring.sources.fileHint")}</span>
            </div>
          )}
        </div>
        <div className="scrollbar-hide mx-auto w-full max-w-3xl max-h-full shrink-0 overflow-y-auto overscroll-contain bg-white pb-1 pt-2">
          {composer}
        </div>
      </main>
    </CourseGenerationFileDropContext.Provider>
  );
};
