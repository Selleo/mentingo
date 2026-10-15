/**
 * Text-first generation surface shared by the course page and future inline entry points.
 * The host supplies durable results and command controls; this view owns no routing,
 * API calls or authoring state and can fit a narrow editor panel.
 */
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

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
    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <div
        ref={scrollRef}
        className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4"
        onScroll={(event) => {
          const viewport = event.currentTarget;
          followLatest.current =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
        }}
      >
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
      <div className="scrollbar-hide max-h-full shrink-0 overflow-y-auto overscroll-contain bg-white pb-1 pt-2">
        {composer}
      </div>
    </main>
  );
};
