import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AiMentorEvaluationLoader() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-live="polite" className="my-4 w-full border-y border-neutral-200 py-4">
      <div className="flex items-start gap-3">
        <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-primary-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-950">
            {t("studentCourseView.lesson.aiMentorLesson.evaluation.loadingTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            {t("studentCourseView.lesson.aiMentorLesson.evaluation.loadingDescription")}
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full w-1/3 animate-[evaluation-progress_1.4s_ease-in-out_infinite] rounded-full bg-primary-600 motion-reduce:w-full motion-reduce:animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
