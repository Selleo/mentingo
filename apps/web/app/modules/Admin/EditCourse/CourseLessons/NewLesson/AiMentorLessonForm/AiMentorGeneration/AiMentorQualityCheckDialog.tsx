import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import type { AiMentorValidationResult } from "./aiMentorGeneration.types";

type AiMentorQualityCheckDialogProps = {
  open?: boolean;
  isLoading?: boolean;
  result?: AiMentorValidationResult;
  onOpenChange: (open: boolean) => void;
  onCancel?: () => void;
  onImprove?: () => void;
};

const INITIAL_VISIBLE_FINDINGS = 4;

export const AiMentorQualityCheckDialog = ({
  open,
  isLoading = false,
  result,
  onOpenChange,
  onCancel,
  onImprove,
}: AiMentorQualityCheckDialogProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visibleIssues = expanded
    ? result?.issues
    : result?.issues.slice(0, INITIAL_VISIBLE_FINDINGS);
  const hiddenIssueCount = (result?.issues.length ?? 0) - INITIAL_VISIBLE_FINDINGS;

  return (
    <Dialog
      open={open ?? (isLoading || Boolean(result))}
      onOpenChange={isLoading ? () => undefined : onOpenChange}
    >
      <DialogContent
        variant="mobileDrawer"
        className="!flex max-h-[85dvh] !flex-col sm:w-[min(92vw,36rem)] sm:!max-w-none"
        noCloseButton={isLoading}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>
            {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.resultTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.description")}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <>
            <div
              role="status"
              className="flex min-h-56 flex-1 flex-col items-center justify-center px-6 py-10 text-center"
            >
              <LoaderCircle className="size-7 animate-spin text-primary-700" aria-hidden />
              <p className="mt-4 font-medium text-neutral-900">
                {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.checking")}
              </p>
              <p className="mt-1 max-w-sm text-sm leading-5 text-neutral-600">
                {t(
                  "adminCourseView.curriculum.lesson.aiMentorGeneration.quality.checkingDescription",
                )}
              </p>
            </div>
            {onCancel && (
              <DialogFooter className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                  {t("common.button.cancel")}
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        {!isLoading && result && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
            <div>
              <p className="font-semibold text-neutral-950">{result.summary}</p>
              <p className="mt-1 text-sm leading-5 text-neutral-600">
                {t(
                  result.issues.length > 0
                    ? "adminCourseView.curriculum.lesson.aiMentorGeneration.quality.hasFindings"
                    : "adminCourseView.curriculum.lesson.aiMentorGeneration.quality.passed",
                )}
              </p>
            </div>
            {visibleIssues && visibleIssues.length > 0 && (
              <div>
                <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
                  {visibleIssues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`} className="px-4 py-3">
                      <p className="text-sm font-medium text-neutral-900">{issue.message}</p>
                      <p className="mt-1 text-sm leading-5 text-neutral-600">{issue.correction}</p>
                    </li>
                  ))}
                </ul>
                {hiddenIssueCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-2"
                    onClick={() => setExpanded((current) => !current)}
                  >
                    {expanded
                      ? t("adminCourseView.curriculum.lesson.aiMentorGeneration.showFewerFindings")
                      : t("adminCourseView.curriculum.lesson.aiMentorGeneration.showMoreFindings", {
                          count: hiddenIssueCount,
                        })}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {!isLoading && (
          <DialogFooter className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.button.close")}
            </Button>
            {result && result.issues.length > 0 && onImprove && (
              <Button type="button" onClick={onImprove}>
                {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.improve")}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
