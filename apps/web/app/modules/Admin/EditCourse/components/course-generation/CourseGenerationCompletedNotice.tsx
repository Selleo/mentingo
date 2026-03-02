import { CheckCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

type CourseGenerationCompletedNoticeProps = {
  onDismiss: () => void;
  visible: boolean;
};

export function CourseGenerationCompletedNotice({
  onDismiss,
  visible,
}: CourseGenerationCompletedNoticeProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.section
          key="course-generation-completed-notice"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="mb-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCheck className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-900">
                  {t("adminCourseView.generation.finishedTitle")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {t("adminCourseView.generation.finishedDescription")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
              {t("common.button.close")}
            </Button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
