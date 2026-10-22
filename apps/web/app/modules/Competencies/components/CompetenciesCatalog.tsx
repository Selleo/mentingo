import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Button } from "~/components/ui/button";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";

import { CompetencyEditor } from "./CompetencyEditor";

import type { Competency, CompetenciesWorkspace } from "../competencies.types";

export function CompetenciesCatalog({
  workspace,
  onEdit,
}: {
  workspace: CompetenciesWorkspace;
  onEdit: (value: Competency) => void;
}) {
  const { t } = useTranslation();
  return (
    <div aria-label={t("competencies.catalog")} className="grid gap-3 lg:grid-cols-2">
      {workspace.catalog
        .filter((value) => !value.archived)
        .map((value) => (
          <Button
            key={value.id}
            variant="outline"
            aria-label={value.name}
            data-testid={COMPETENCIES_HANDLES.CATALOG_CARD(value.id)}
            className="h-full min-w-0 flex-col items-start justify-start gap-3 whitespace-normal p-5 text-left text-neutral-950 hover:bg-primary-50"
            onClick={() => onEdit(value)}
          >
            <h3 className="font-semibold">{value.name}</h3>
            <p className="text-sm font-normal text-neutral-800">
              {[
                ...new Set(
                  value.levels.flatMap((level) =>
                    level.conditions.map((condition) => condition.kind),
                  ),
                ),
              ]
                .map((kind) => t(`competencies.kind.${kind}`))
                .join(" + ") || value.description}
            </p>
            <span className="mt-auto flex w-full flex-wrap justify-between gap-2 text-xs font-normal text-neutral-800">
              <span>{value.category}</span>
              <span>
                {value.levels.length
                  ? t("competencies.maximumLevel", { number: value.levels.length })
                  : t("competencies.notConfigured")}
              </span>
            </span>
          </Button>
        ))}
    </div>
  );
}

export function CompetenciesCatalogEditor({
  workspace,
  value,
  onClose,
}: {
  workspace: CompetenciesWorkspace;
  value?: Competency;
  onClose: () => void;
}) {
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  return (
    <CompetencyEditor
      value={value}
      workspace={workspace}
      pending={isPending}
      onClose={onClose}
      onSave={(draft) =>
        execute({
          operation: "save_competency",
          id: value?.id,
          revision: value?.revision,
          value: draft,
        })
      }
      onArchive={
        value && !value.archived
          ? () =>
              execute({ operation: "archive_competency", id: value.id, revision: value.revision })
          : undefined
      }
    />
  );
}
