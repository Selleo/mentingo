import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { CompetenciesSelect } from "./CompetenciesSelect";

import type { CompetenciesProfileEditorModel } from "../hooks/competencies-hook-models.types";

type CompetenciesProfileRequirementListProps = Pick<
  CompetenciesProfileEditorModel,
  "catalog" | "value" | "removeRequirement" | "updateRequirementLevel"
>;

export function CompetenciesProfileRequirementList({
  catalog,
  value,
  removeRequirement,
  updateRequirementLevel,
}: CompetenciesProfileRequirementListProps) {
  const { t } = useTranslation();
  return (
    <ul
      aria-labelledby="profile-requirements-label"
      className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200"
    >
      {value.requirements.map((requirement) => {
        const competency = catalog.find((item) => item.id === requirement.competencyId);
        if (!competency)
          return (
            <li
              key={requirement.competencyId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <p className="body-sm text-neutral-700">{t("competencies.archived")}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-neutral-700 hover:text-error-700"
                aria-label={t("competencies.remove")}
                onClick={() => removeRequirement(requirement.competencyId)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          );
        return (
          <li
            key={requirement.competencyId}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1 basis-48">
              <p className="body-sm-md truncate text-neutral-950">{competency.name}</p>
              <p className="details text-neutral-700">{competency.categoryName}</p>
            </div>
            {competency.levels.length > 0 && (
              <CompetenciesSelect
                label={`${t("competencies.requiredLevel")}: ${competency.name}`}
                hideLabel
                className="w-full sm:w-56"
                value={requirement.levelId}
                options={competency.levels.map((level, index) => ({
                  value: level.id,
                  label: t("competencies.numberedLevel", {
                    number: index + 1,
                    name: level.name,
                  }),
                }))}
                onChange={(levelId) => updateRequirementLevel(requirement.competencyId, levelId)}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-neutral-700 hover:text-error-700"
              aria-label={`${t("competencies.remove")}: ${competency.name}`}
              onClick={() => removeRequirement(requirement.competencyId)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
