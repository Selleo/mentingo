import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useUploadCompetenciesAttachment } from "~/api/mutations/useUploadCompetenciesAttachment";

import type { CompetencyEvidenceFormOptions } from "./competencies-hooks.types";
import type { FormEvent } from "react";

export function useCompetencyEvidenceForm({
  competency,
  subjectId,
  recognition = false,
  condition,
  onClose,
}: CompetencyEvidenceFormOptions) {
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

  const submitCompetencyEvidence = async (event: FormEvent<HTMLFormElement>) => {
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
          occurredAt: occurredAt ? new Date(occurredAt).toISOString() : defaultOccurrence,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
          note,
          ...(id ? { attachmentId: id } : {}),
        },
      });
      onClose();
    } catch {
      /* Preserve input and the uploaded attachment for a safe retry. */
    }
  };
  return {
    t,
    dialogContainer,
    setDialogContainer,
    kind,
    targetLevel,
    setTargetLevel,
    note,
    setNote,
    occurredAt,
    setOccurredAt,
    validUntil,
    setValidUntil,
    setFile,
    setAttachmentId,
    pending,
    covered,
    competency,
    subjectId,
    recognition,
    condition,
    onClose,
    submitCompetencyEvidence,
  };
}
