import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import type { Competency, CompetencyCondition } from "../competencies.types";

export function CompetencyRevocationForm({
  competency,
  conditions,
  subjectId,
  onClose,
}: {
  competency: Competency;
  conditions: CompetencyCondition[];
  subjectId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [selected, setSelected] = useState(conditions.map((item) => item.id));
  const [reason, setReason] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("competencies.revokeConfirmation")}</DialogTitle>
          <DialogDescription>{t("competencies.revocationHelp")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await execute({
                operation: "revoke_confirmation",
                requestId,
                subjectId,
                competencyId: competency.id,
                revision: competency.revision,
                conditionIds: selected,
                reason,
              });
              onClose();
            } catch {
              /* Preserve the decision for retry. */
            }
          }}
        >
          <fieldset disabled={isPending} className="space-y-3">
            <legend className="mb-2 text-sm font-medium">{t("competencies.conditions")}</legend>
            {conditions.map((condition) => (
              <div key={condition.id} className="flex items-start gap-2">
                <Checkbox
                  id={`revoke-${condition.id}`}
                  checked={selected.includes(condition.id)}
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked === true
                        ? [...selected, condition.id]
                        : selected.filter((id) => id !== condition.id),
                    )
                  }
                />
                <Label htmlFor={`revoke-${condition.id}`}>{condition.description}</Label>
              </div>
            ))}
            <Label htmlFor="revocation-reason">{t("competencies.reasonLabel")}</Label>
            <Textarea
              id="revocation-reason"
              required
              maxLength={10000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </fieldset>
          <DialogFooter className="gap-2 border-t border-neutral-200 pt-4 sm:gap-0">
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              {t("competencies.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !reason.trim() || !selected.length}>
              {t("competencies.revokeConfirmation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
