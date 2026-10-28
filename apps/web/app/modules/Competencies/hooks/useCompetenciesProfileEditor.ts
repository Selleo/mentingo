import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useCompetencyCatalog } from "~/api/queries/useCompetencyCatalog";

import { COMPETENCY_OPTIONS_PAGE } from "../utils/competenciesProfiles.utils";

import type { CompetenciesProfileEditorOptions } from "./competencies-hooks.types";
import type { CompetencyProfileInput } from "../competencies.types";
import type { FormEvent } from "react";

export function useCompetenciesProfileEditor({ profile, close }: CompetenciesProfileEditorOptions) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const assigned = Boolean(profile?.assignedPeopleCount);
  const catalog = useCompetencyCatalog(COMPETENCY_OPTIONS_PAGE).data?.data ?? [];
  const [value, setValue] = useState<CompetencyProfileInput>({
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    requirements: (profile?.requirements ?? []).map(({ competencyId, levelId }) => ({
      competencyId,
      levelId,
    })),
  });
  const availableCompetencies = catalog.filter(
    (item) =>
      item.levels.length > 0 &&
      !value.requirements.some((requirement) => requirement.competencyId === item.id),
  );

  const saveProfileDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await execute({
        operation: "save_profile",
        id: profile?.id,
        revision: profile?.revision,
        value,
      });
      close();
    } catch {
      /* Retain the draft. */
    }
  };

  const addRequirement = (competencyId: string) => {
    const competency = catalog.find((item) => item.id === competencyId);
    if (!competency?.levels[0]) return;
    const levelId = competency.levels[0].id;
    setValue((current) => ({
      ...current,
      requirements: [...current.requirements, { competencyId, levelId }],
    }));
  };
  const removeRequirement = (competencyId: string) =>
    setValue((current) => ({
      ...current,
      requirements: current.requirements.filter((item) => item.competencyId !== competencyId),
    }));
  const updateRequirementLevel = (competencyId: string, levelId: string) =>
    setValue((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.competencyId === competencyId ? { ...item, levelId } : item,
      ),
    }));

  return {
    t,
    execute,
    isPending,
    confirmDelete,
    setConfirmDelete,
    assigned,
    catalog,
    value,
    setValue,
    availableCompetencies,
    profile,
    close,
    saveProfileDraft,
    addRequirement,
    removeRequirement,
    updateRequirementLevel,
  };
}
