import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useUploadCompetenciesAttachment } from "~/api/mutations/useUploadCompetenciesAttachment";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { TooltipProvider } from "~/components/ui/tooltip";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";

import { CompetenciesSelect } from "./CompetenciesSelect";

import type { Competency, CompetencyCondition } from "../competencies.types";

export function CompetencyEvidenceForm({
  competency,
  subjectId,
  recognition = false,
  condition,
  actionId,
  onClose,
}: {
  competency: Competency;
  subjectId: string;
  recognition?: boolean;
  condition?: CompetencyCondition;
  actionId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending: saving } = useExecuteCompetenciesCommand();
  const { mutateAsync: upload, isPending: uploading } = useUploadCompetenciesAttachment();
  const [dialogContainer, setDialogContainer] = useState<HTMLDivElement | null>(null);
  const kind = condition?.kind === "observation" ? "observation" : "document";
  const [targetLevel, setTargetLevel] = useState(competency.levels[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [attachmentId, setAttachmentId] = useState<string>();
  const [requestId] = useState(() => crypto.randomUUID());
  const [defaultOccurrence] = useState(() => new Date().toISOString());
  const pending = saving || uploading;
  const covered = competency.levels
    .slice(0, competency.levels.findIndex((level) => level.id === targetLevel) + 1)
    .flatMap((level) => level.conditions.map((condition) => condition.id));
  return (
    <TooltipProvider>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !pending) onClose();
        }}
      >
        <DialogContent ref={setDialogContainer} className="max-h-[90vh]">
          <div className="flex max-h-[calc(90vh-3rem)] flex-col gap-4 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t(recognition ? "competencies.recognize" : `competencies.evidenceAction.${kind}`)}
              </DialogTitle>
              <DialogDescription>{competency.name}</DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!recognition && !condition) return;
                try {
                  let id = attachmentId;
                  if (file && !id) {
                    id = (await upload({ file, subjectId, competencyId: competency.id })).id;
                    setAttachmentId(id);
                  }
                  await execute({
                    operation: "submit_evidence",
                    value: {
                      requestId,
                      subjectId,
                      competencyId: competency.id,
                      conditionIds: recognition ? covered : [condition!.id],
                      kind: recognition ? "recognition" : kind,
                      occurredAt: occurredAt
                        ? new Date(occurredAt).toISOString()
                        : defaultOccurrence,
                      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
                      note,
                      ...(id ? { attachmentId: id } : {}),
                      ...(actionId ? { actionId } : {}),
                    },
                  });
                  onClose();
                } catch {
                  /* Preserve input and the uploaded attachment for a safe retry. */
                }
              }}
            >
              <fieldset disabled={pending} className="flex flex-col gap-4">
                {recognition ? (
                  <CompetenciesSelect
                    label={t("competencies.targetLevel")}
                    value={targetLevel}
                    options={competency.levels.map((level) => ({
                      value: level.id,
                      label: level.name,
                    }))}
                    onChange={setTargetLevel}
                  />
                ) : (
                  <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs font-medium text-neutral-700">
                      {t(`competencies.kind.${kind}`)}
                    </p>
                    <p className="text-sm font-medium text-neutral-950">{condition?.description}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="evidence-note">{t("competencies.note")}</Label>
                  <Textarea
                    id="evidence-note"
                    required
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
                <EvidenceDateField
                  portalContainer={dialogContainer}
                  label={t("competencies.occurredAt")}
                  tooltip={t("competencies.occurrenceHelp")}
                  value={occurredAt}
                  onChange={setOccurredAt}
                />
                <EvidenceDateField
                  portalContainer={dialogContainer}
                  label={t("competencies.optionalExpiry")}
                  tooltip={t("competencies.expiryHelp")}
                  value={validUntil}
                  onChange={setValidUntil}
                />
                <div className="space-y-2">
                  <Label htmlFor="evidence-file">{t("competencies.optionalFile")}</Label>
                  <Input
                    id="evidence-file"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setAttachmentId(undefined);
                    }}
                  />
                  <p className="mt-1 text-sm text-muted-foreground">{t("competencies.fileHelp")}</p>
                </div>
              </fieldset>
              <DialogFooter className="gap-2 border-t border-neutral-200 pt-4 sm:gap-0">
                <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
                  {t("competencies.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={pending || (recognition ? !covered.length : !condition)}
                  aria-busy={pending}
                >
                  {t(pending ? "competencies.saving" : "competencies.submit")}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function EvidenceDateField({
  portalContainer,
  label,
  tooltip,
  value,
  onChange,
}: {
  portalContainer: HTMLElement | null;
  label: string;
  tooltip: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [date = "", time = ""] = value.split("T");
  return (
    <div className="space-y-2">
      <CalendarDateTimeField
        datePickerPortalContainer={portalContainer}
        label={label}
        tooltip={tooltip}
        date={date}
        time={time}
        onDateChange={(next) => onChange(`${next}T${time || "00:00"}`)}
        onTimeChange={(next) => {
          if (date) onChange(`${date}T${next}`);
        }}
      />
      {value && (
        <Button type="button" variant="link" size="sm" onClick={() => onChange("")}>
          {t("competencies.clearDate")}
        </Button>
      )}
    </div>
  );
}
