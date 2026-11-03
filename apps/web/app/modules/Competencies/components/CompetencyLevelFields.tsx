import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { CompetencyConditionRow } from "./CompetencyConditionRow";

import type { CompetencyLevel } from "../competencies.types";
import type { CompetencyEditorModel } from "../hooks/competencies-hook-models.types";

type CompetencyLevelFieldsProps = Pick<
  CompetencyEditorModel,
  "options" | "activeLevelId" | "updateLevel" | "updateCondition" | "pending"
> & { level: CompetencyLevel; index: number };

export function CompetencyLevelFields({
  options,
  activeLevelId,
  updateLevel,
  updateCondition,
  pending,
  level,
  index,
}: CompetencyLevelFieldsProps) {
  const { t } = useTranslation();
  return (
    <div
      key={level.id}
      hidden={activeLevelId !== level.id}
      data-level-id={level.id}
      className={cn(
        "min-w-0 flex-col gap-4 rounded-lg border border-neutral-200 p-4",
        activeLevelId === level.id && "flex",
        activeLevelId !== level.id && "hidden",
      )}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={level.id}>
            {t("competencies.editor.levelNameNumbered", { number: index + 1 })}
          </Label>
          <Input
            id={level.id}
            required
            value={level.name}
            onChange={(event) => updateLevel(level.id, { name: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="body-sm-md text-neutral-950">{t("competencies.editor.metWhen")}</p>
        <p className="details text-neutral-700">{t("competencies.conditionValidityHelp")}</p>
      </div>
      {level.conditions.length === 0 && (
        <p className="body-sm text-neutral-700">{t("competencies.editor.noConditions")}</p>
      )}
      <div
        className={cn(
          "flex flex-col divide-y divide-neutral-200",
          level.conditions.length > 0 && "border-y border-neutral-200",
        )}
      >
        {level.conditions.map((condition) => (
          <CompetencyConditionRow
            key={condition.id}
            condition={condition}
            options={options}
            pending={pending}
            onChange={(update) => updateCondition(level.id, condition.id, update)}
            onRemove={() =>
              updateLevel(level.id, {
                conditions: level.conditions.filter((item) => item.id !== condition.id),
              })
            }
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          updateLevel(level.id, {
            conditions: [
              ...level.conditions,
              {
                id: crypto.randomUUID(),
                kind: "observation",
                description: "",
                verifierIds: [],
              },
            ],
          })
        }
      >
        <Plus className="mr-2 size-4" aria-hidden="true" />
        {t("competencies.addCondition")}
      </Button>
    </div>
  );
}
