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

import {
  getLocalizedAiJudgeValidationIssueText,
  getLocalizedAiJudgeValidationSummary,
} from "./aiJudgeValidationLocalization";

import type { AiJudgeValidationResult } from "./aiJudgeConfiguration.types";

type AiJudgeValidationResultDialogProps = {
  validation?: AiJudgeValidationResult;
  isLoading?: boolean;
  onCancel?: () => void;
  onOpenChange: (open: boolean) => void;
  onImprove?: () => void;
};

const INITIAL_VISIBLE_FINDINGS = 4;

const getQualityCheckStatusKey = (validation: AiJudgeValidationResult) => {
  if (!validation.passed)
    return "adminCourseView.curriculum.lesson.aiJudge.qualityCheckNeedsChanges";
  if (validation.issues.length > 0)
    return "adminCourseView.curriculum.lesson.aiJudge.qualityCheckPassedWithSuggestions";

  return "adminCourseView.curriculum.lesson.aiJudge.qualityCheckPassed";
};

const AiJudgeValidationFindings = ({ validation }: { validation: AiJudgeValidationResult }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visibleIssues = expanded
    ? validation.issues
    : validation.issues.slice(0, INITIAL_VISIBLE_FINDINGS);
  const hiddenIssueCount = validation.issues.length - INITIAL_VISIBLE_FINDINGS;

  if (validation.issues.length === 0) return null;

  return (
    <div>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {visibleIssues.map((issue, index) => {
          const issueText = getLocalizedAiJudgeValidationIssueText(issue, t);

          return (
            <li key={`${issue.code}-${index}`} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900">
                  {issueText.message}
                </p>
                {"ref" in issue.target && (
                  <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-neutral-600">
                    {issue.target.ref}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-5 text-neutral-600">{issueText.correction}</p>
            </li>
          );
        })}
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
            ? t("adminCourseView.curriculum.lesson.aiJudge.generation.showFewerFindings")
            : t("adminCourseView.curriculum.lesson.aiJudge.generation.showMoreFindings", {
                count: hiddenIssueCount,
              })}
        </Button>
      )}
    </div>
  );
};

export const AiJudgeValidationResultDialog = ({
  validation,
  isLoading = false,
  onCancel,
  onOpenChange,
  onImprove,
}: AiJudgeValidationResultDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={isLoading || Boolean(validation)}
      onOpenChange={isLoading ? () => undefined : onOpenChange}
    >
      <DialogContent
        variant="mobileDrawer"
        className="!flex max-h-[85dvh] !flex-col sm:w-[min(92vw,36rem)] sm:!max-w-none"
        noCloseButton={isLoading}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>
            {t("adminCourseView.curriculum.lesson.aiJudge.qualityCheckResult")}
          </DialogTitle>
          <DialogDescription>
            {t("adminCourseView.curriculum.lesson.aiJudge.qualityCheckResultDescription")}
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
                {t("adminCourseView.curriculum.lesson.aiJudge.checkingQuality")}
              </p>
              <p className="mt-1 max-w-sm text-sm leading-5 text-neutral-600">
                {t("adminCourseView.curriculum.lesson.aiJudge.checkingQualityDescription")}
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

        {!isLoading && validation && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
            <div>
              <p className="font-semibold text-neutral-950">
                {getLocalizedAiJudgeValidationSummary(validation, t)}
              </p>
              <p className="mt-1 text-sm leading-5 text-neutral-600">
                {t(getQualityCheckStatusKey(validation))}
              </p>
            </div>

            <AiJudgeValidationFindings key={validation.summary} validation={validation} />
          </div>
        )}

        {!isLoading && (
          <DialogFooter className="shrink-0 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.button.close")}
            </Button>
            {validation && validation.issues.length > 0 && onImprove && (
              <Button type="button" onClick={onImprove}>
                {t("adminCourseView.curriculum.lesson.aiJudge.improveWithAi")}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
