import { ChevronLeft, ChevronRight, LoaderCircle, PencilLine, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";

type Props = {
  outlineOnly: boolean;
  totalChanges: number;
  currentIndex: number | null;
  readOnly: boolean;
  streaming: boolean;
  applying: boolean;
  requiresAssessmentAcknowledgement: boolean;
  assessmentConfirmationOpen: boolean;
  onAssessmentConfirmationOpenChange: (open: boolean) => void;
  changesOnly: boolean;
  onChangesOnlyChange: (value: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onApply: (acknowledgeAssessmentChanges: boolean) => Promise<boolean>;
  onDiscard: () => void;
  onExit: () => void;
};

export const CurriculumReviewBar = ({
  outlineOnly,
  totalChanges,
  currentIndex,
  readOnly,
  streaming,
  applying,
  requiresAssessmentAcknowledgement,
  assessmentConfirmationOpen,
  onAssessmentConfirmationOpenChange,
  changesOnly,
  onChangesOnlyChange,
  onPrevious,
  onNext,
  onApply,
  onDiscard,
  onExit,
}: Props) => {
  const { t } = useTranslation();
  const applyBlocked = applying;
  const titleKey = outlineOnly
    ? "courseAuthoring.reviewMode.outlineTitle"
    : "courseAuthoring.reviewMode.title";
  const applyLabelKey = outlineOnly
    ? "courseAuthoring.reviewMode.approveOutline"
    : "courseAuthoring.reviewMode.applyChanges";
  let description = t("courseAuthoring.reviewMode.summaryLine", { count: totalChanges });
  if (readOnly) description = t("courseAuthoring.reviewMode.readOnlyHint");
  else if (outlineOnly) description = t("courseAuthoring.reviewMode.outlineHint");

  return (
    <div
      className="sticky top-0 z-20 flex flex-col gap-y-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm"
      data-testid="course-authoring-review-bar"
      role="region"
      aria-label={t(titleKey)}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 className="h6 flex items-center gap-2 text-neutral-950">
            {streaming && <LoaderCircle className="size-4 animate-spin text-primary-700" />}
            {streaming ? t("courseAuthoring.reviewMode.drafting") : t(titleKey)}
          </h2>
          <p className="body-sm text-neutral-600">{description}</p>
        </div>

        {totalChanges > 1 && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("courseAuthoring.reviewMode.previousChange")}
              onClick={onPrevious}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span
              className="body-sm min-w-14 text-center tabular-nums text-neutral-700"
              aria-live="polite"
            >
              {t("courseAuthoring.reviewMode.position", {
                current: currentIndex === null ? "–" : currentIndex + 1,
                total: totalChanges,
              })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("courseAuthoring.reviewMode.nextChange")}
              onClick={onNext}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <label className="body-sm inline-flex items-center gap-2.5 text-neutral-800">
          <Switch checked={changesOnly} onCheckedChange={onChangesOnlyChange} />
          {t("courseAuthoring.reviewMode.changesOnly")}
        </label>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              {!outlineOnly && (
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="gap-1.5" disabled={applying}>
                    <PencilLine className="size-4" aria-hidden="true" />
                    {t("courseAuthoring.reviewMode.requestChanges")}
                  </Button>
                </DialogTrigger>
              )}
              <Button type="button" variant="outline" disabled={applying} onClick={onDiscard}>
                {t("courseAuthoring.reviewMode.discard")}
              </Button>
              <Dialog
                open={assessmentConfirmationOpen}
                onOpenChange={(open) => {
                  if (!open && applying) return;
                  onAssessmentConfirmationOpenChange(open);
                }}
              >
                {requiresAssessmentAcknowledgement ? (
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      disabled={applyBlocked}
                      data-testid="course-authoring-review-apply"
                    >
                      {applying && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                      {t(applyLabelKey)}
                    </Button>
                  </DialogTrigger>
                ) : (
                  <Button
                    type="button"
                    disabled={applyBlocked}
                    onClick={() => void onApply(false)}
                    data-testid="course-authoring-review-apply"
                  >
                    {applying && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                    {t(applyLabelKey)}
                  </Button>
                )}
                <DialogContent noCloseButton={applying}>
                  <DialogHeader>
                    <DialogTitle>{t("courseAuthoring.review.assessmentImpactTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("courseAuthoring.review.assessmentImpactBody")}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={applying}
                      onClick={() => onAssessmentConfirmationOpenChange(false)}
                    >
                      {t("common.button.cancel")}
                    </Button>
                    <Button
                      type="button"
                      disabled={applying}
                      onClick={() => {
                        void onApply(true).then((applied) => {
                          if (applied) onAssessmentConfirmationOpenChange(false);
                        });
                      }}
                    >
                      {applying && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                      {t("courseAuthoring.reviewMode.applyChanges")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("courseAuthoring.reviewMode.exit")}
            title={t("courseAuthoring.reviewMode.exit")}
            onClick={onExit}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
