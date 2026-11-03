import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";

import { COMPETENCIES_COMMAND_OPERATIONS } from "../competenciesCommand.constants";

import { CompetencyEditor } from "./CompetencyEditor";

import type { CompetencyCatalogItem } from "../competencies.types";

export function CompetenciesCatalogEditor({
  value,
  onClose,
}: {
  value?: CompetencyCatalogItem;
  onClose: () => void;
}) {
  const { mutateAsync: changeCompetency, isPending } = useExecuteCompetenciesCommand();
  return (
    <CompetencyEditor
      value={value}
      pending={isPending}
      onClose={onClose}
      onSave={(draft) =>
        changeCompetency({
          operation: COMPETENCIES_COMMAND_OPERATIONS.SAVE_COMPETENCY,
          id: value?.id,
          revision: value?.revision,
          value: draft,
        })
      }
      onDelete={
        value
          ? () =>
              changeCompetency({
                operation: COMPETENCIES_COMMAND_OPERATIONS.DELETE_COMPETENCY,
                id: value.id,
                revision: value.revision,
              })
          : undefined
      }
    />
  );
}
