import { Bot, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { COURSE_GENERATION_HANDLES } from "../../../../../../e2e/data/curriculum/handles";

type CourseGenerationProgressStripProps = {
  currentMessageKey: string | null;
  visible: boolean;
};

const stripVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function CourseGenerationProgressStrip({
  currentMessageKey,
  visible,
}: CourseGenerationProgressStripProps) {
  const { t } = useTranslation();

  const statusLabel = useMemo(
    () => t(`adminCourseView.thinking.${currentMessageKey ?? "THINKING"}`),
    [currentMessageKey, t],
  );

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.section
          data-testid={COURSE_GENERATION_HANDLES.PROGRESS_STRIP}
          key="generation-progress-strip"
          variants={stripVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mb-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <Bot className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                  {t("adminCourseView.generation.processingTitle")}
                </p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={statusLabel}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="truncate text-sm font-medium text-neutral-900"
                  >
                    {statusLabel}
                  </motion.p>
                </AnimatePresence>
                <p className="truncate text-xs text-neutral-600">
                  {t("adminCourseView.generation.exitHint")}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center text-primary-700">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.4, ease: "linear" }}
              >
                <LoaderCircle className="size-4" />
              </motion.span>
            </div>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
