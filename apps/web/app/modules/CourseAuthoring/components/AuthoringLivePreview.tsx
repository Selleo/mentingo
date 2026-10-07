/** Presents the latest durable provisional result as a read-only outline and content view. */
import { LoaderCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { AuthoringTaskStatus, PreviewView } from "../courseAuthoring.types";

type Props = {
  preview: PreviewView;
  onPreviewInCurriculum?: () => void;
};

const previewStatusVariant = (status: AuthoringTaskStatus, isGenerating: boolean) => {
  if (isGenerating) return "inProgress" as const;
  if (status === "failed") return "blocked" as const;
  return "success" as const;
};

/** Renders streamed preview data without writing it into the canonical course editor cache. */
export const AuthoringLivePreview = ({ preview, onPreviewInCurriculum }: Props) => {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const title = preview.lessonTitle ?? preview.title ?? t("courseAuthoring.livePreview.untitled");
  const isGenerating = ["queued", "running"].includes(preview.status);
  const statusKey: AuthoringTaskStatus | "complete" =
    preview.status === "succeeded" ? "complete" : preview.status;
  const statusLabel = isGenerating
    ? t("courseAuthoring.livePreview.generating")
    : t(`courseAuthoring.activityRail.taskStatus.${statusKey}`);
  const statusVariant = previewStatusVariant(preview.status, isGenerating);

  if (onPreviewInCurriculum) {
    return (
      <section
        aria-label={t("courseAuthoring.livePreview.label")}
        className="flex items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-2"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant} className="text-[10px]">
              {statusLabel}
            </Badge>
            <span className="truncate text-xs text-primary-800">
              {t("courseAuthoring.livePreview.forTitle", { title })}
            </span>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onPreviewInCurriculum}>
          {t("courseAuthoring.livePreview.previewInCurriculum")}
        </Button>
      </section>
    );
  }

  return (
    <motion.section
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" }}
      aria-label={t("courseAuthoring.livePreview.label")}
      className="rounded-xl border border-primary-200 bg-primary-50/60 p-4 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            <span className="text-xs text-primary-800">
              {t("courseAuthoring.livePreview.forTitle", { title })}
            </span>
          </div>
          <h3 className="mt-2 truncate font-semibold text-neutral-950">{title}</h3>
        </div>
        {isGenerating && (
          <LoaderCircle
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-primary-700",
              !shouldReduceMotion && "animate-spin",
            )}
          />
        )}
      </header>

      {preview.outline.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-primary-900">
            {t("courseAuthoring.livePreview.outline")}
          </h4>
          <ol className="mt-2 space-y-3 text-sm text-neutral-800">
            {preview.outline.map((chapter, chapterIndex) => (
              <li key={`${preview.taskId}:chapter:${chapterIndex}`}>
                <div className="font-medium">
                  {chapterIndex + 1}. {chapter.title}
                </div>
                {chapter.lessons.length > 0 && (
                  <ol className="mt-1 space-y-1 border-l border-primary-200 pl-4 text-neutral-700">
                    {chapter.lessons.map((lesson, lessonIndex) => (
                      <li key={`${preview.taskId}:chapter:${chapterIndex}:lesson:${lessonIndex}`}>
                        {chapterIndex + 1}.{lessonIndex + 1} {lesson.title}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {preview.contentText && (
        <div className="mt-4 border-t border-primary-100 pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-primary-900">
            {t("courseAuthoring.livePreview.content")}
          </h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
            {preview.contentText}
          </p>
        </div>
      )}
    </motion.section>
  );
};
