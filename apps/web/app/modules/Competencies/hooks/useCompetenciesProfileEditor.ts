import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useCompetencyCatalog } from "~/api/queries/useCompetencyCatalog";

import { SELECTED_RECORDS_PAGE } from "../utils/competenciesPicker.utils";

import type { CompetenciesProfileEditorOptions } from "./competencies-hooks.types";
import type { CompetencyCatalogItem, CompetencyProfileInput } from "../competencies.types";
import type { FormEvent } from "react";

export function useCompetenciesProfileEditor({ profile, close }: CompetenciesProfileEditorOptions) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const assigned = Boolean(profile?.assignedPeopleCount);
  const [savedRequirementIds] = useState(() =>
    (profile?.requirements ?? []).map((requirement) => requirement.competencyId),
  );
  const savedRequirements = useCompetencyCatalog(
    { ...SELECTED_RECORDS_PAGE, ids: savedRequirementIds },
    savedRequirementIds.length > 0,
  );
  const [pickedCompetencies, setPickedCompetencies] = useState<CompetencyCatalogItem[]>([]);
  const catalog = [...pickedCompetencies, ...(savedRequirements.data?.data ?? [])];
  const isResolvingRequirements = savedRequirements.isPending && savedRequirements.isFetching;
  const [value, setValue] = useState<CompetencyProfileInput>({
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    requirements: (profile?.requirements ?? []).map(({ competencyId, levelId }) => ({
      competencyId,
      levelId,
    })),
  });
  const isAvailableCompetency = (item: CompetencyCatalogItem) =>
    item.levels.length > 0 &&
    !value.requirements.some((requirement) => requirement.competencyId === item.id);

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

  const addRequirement = (competencyId: string, competency?: CompetencyCatalogItem) => {
    if (!competency?.levels[0]) return;
    const levelId = competency.levels[0].id;
    setPickedCompetencies((current) => [competency, ...current]);
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
    isResolvingRequirements,
    value,
    setValue,
    isAvailableCompetency,
    profile,
    close,
    saveProfileDraft,
    addRequirement,
    removeRequirement,
    updateRequirementLevel,
  };
}
