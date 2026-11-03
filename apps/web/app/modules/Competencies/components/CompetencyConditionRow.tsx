import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { CONDITION_KINDS } from "../utils/competencyEditor.utils";

import { CompetenciesMultiSelect } from "./CompetenciesMultiSelect";
import { CompetenciesSelect } from "./CompetenciesSelect";

import type { CompetencyCondition, CompetencyOptions } from "../competencies.types";

export function CompetencyConditionRow({
  condition,
  options,
  pending,
  onChange,
  onRemove,
}: {
  condition: CompetencyCondition;
  options: CompetencyOptions;
  pending: boolean;
  onChange: (update: Partial<CompetencyCondition>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isCourse = condition.kind === "course";

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
      <CompetenciesSelect
        label={t("competencies.conditionKind")}
        hideLabel
        value={condition.kind}
        onChange={(kind) =>
          onChange({
            kind: kind as CompetencyCondition["kind"],
            resourceId: undefined,
            verifierIds: [],
          })
        }
        options={CONDITION_KINDS.map((value) => ({
          value,
          label: t(`competencies.kind.${value}`),
        }))}
      />
      <Input
        id={`${condition.id}-description`}
        aria-label={t("competencies.conditionDescription")}
        placeholder={t("competencies.conditionDescription")}
        required
        value={condition.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="justify-self-end text-neutral-700 hover:text-error-700 md:row-span-2"
        aria-label={t("competencies.removeCondition")}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-col gap-2 md:col-span-2 md:flex-row">
        {isCourse && (
          <CompetenciesSelect
            label={t("competencies.learningResource")}
            hideLabel
            className="flex-1"
            value={condition.resourceId ?? ""}
            placeholder={t("competencies.learningResource")}
            emptyLabel={t("competencies.notConfigured")}
            onChange={(value) => onChange({ resourceId: value || undefined })}
            options={options.courses.map((item) => ({ value: item.id, label: item.name }))}
          />
        )}
        {!isCourse && (
          <CompetenciesMultiSelect
            label={t("competencies.verifiers")}
            disabled={pending}
            value={(condition.verifierIds ?? []).filter((id) =>
              options.people.some((person) => person.id === id),
            )}
            onChange={(ids) => onChange({ verifierIds: ids })}
            options={options.people.map((person) => ({ value: person.id, label: person.name }))}
          />
        )}
      </div>
    </div>
  );
}
