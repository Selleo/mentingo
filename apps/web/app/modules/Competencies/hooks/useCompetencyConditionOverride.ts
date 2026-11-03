import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";

import { COMPETENCY_OVERRIDE_STATUSES } from "../competencyOverrides.constants";
import { getCompetencyOverrideOptions } from "../utils/competencyOverrides.utils";

import type { CompetencyConditionOverrideOptions } from "./competencies-hooks.types";
import type { CompetencyConditionOverride as ConditionOverrideRecord } from "../competencies.types";
import type { FormEvent } from "react";

export function useCompetencyConditionOverride({
  workspace,
  subjectId,
  competency,
  condition,
}: CompetencyConditionOverrideOptions) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const overrides = workspace.overrides;
  const history = overrides
    .filter(
      (item) =>
        item.subjectId === subjectId &&
        item.competencyId === competency.id &&
        item.conditionId === condition.id,
    )
    .reverse();
  const current = history.find((item) => item.isCurrent);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ConditionOverrideRecord["status"]>(
    current?.status ?? COMPETENCY_OVERRIDE_STATUSES.AUTOMATIC,
  );
  const [comment, setComment] = useState(current?.comment ?? "");
  useEffect(() => {
    setStatus(current?.status ?? COMPETENCY_OVERRIDE_STATUSES.AUTOMATIC);
    setComment(current?.comment ?? "");
  }, [
    subjectId,
    competency.id,
    competency.revision,
    condition.id,
    current?.id,
    current?.status,
    current?.comment,
  ]);

  const saveConditionOverride = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await execute({
        operation: "set_condition_override",
        requestId: crypto.randomUUID(),
        subjectId,
        competencyId: competency.id,
        revision: competency.revision,
        conditionId: condition.id,
        status,
        comment: comment.trim(),
      });
      setOpen(false);
    } catch {
      // The mutation reports the error; retain the draft for correction.
    }
  };

  return {
    confirmationOptions: getCompetencyOverrideOptions(condition),
    t,
    i18n,
    open,
    setOpen,
    saveConditionOverride,
    isPending,
    history,
    status,
    setStatus,
    comment,
    setComment,
    workspace,
    subjectId,
    competency,
    condition,
  };
}
