import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import type { CompetenciesReviewModel } from "../hooks/competencies-hook-models.types";

type CompetenciesReviewDecisionProps = Pick<
  CompetenciesReviewModel,
  | "isPending"
  | "decision"
  | "setDecision"
  | "reason"
  | "setReason"
  | "subjectName"
  | "submitReviewDecision"
>;

export function CompetenciesReviewDecision({
  isPending,
  decision,
  setDecision,
  reason,
  setReason,
  subjectName,
  submitReviewDecision,
}: CompetenciesReviewDecisionProps) {
  const { t } = useTranslation();
  if (!decision) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) setDecision(null);
      }}
    >
      <DialogContent
        className="flex max-w-lg flex-col gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b border-neutral-200 px-6 py-5 text-left">
          <DialogTitle>{t(`competencies.decision.${decision.status}`)}</DialogTitle>
          <p className="body-sm text-neutral-800">
            {subjectName(decision.evidence)} · {decision.evidence.competencyName}
          </p>
        </DialogHeader>
        <form onSubmit={submitReviewDecision}>
          <div className="space-y-2 px-6 py-5">
            <Label htmlFor="review-reason">{t("competencies.reasonLabel")}</Label>
            <Textarea
              id="review-reason"
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 border-t border-neutral-200 px-6 py-4 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDecision(null)}
            >
              {t("competencies.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !reason.trim()}>
              {t(`competencies.decision.${decision.status}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
